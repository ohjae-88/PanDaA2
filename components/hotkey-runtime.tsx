"use client";

import { useEffect, useRef } from "react";
import { useOverlayStore } from "@/lib/overlay/store";
import type { HotkeyBinding } from "@/lib/overlay/store";
import { executeHotkeyAction } from "@/lib/hotkeys/actions";
import { isTauri } from "@/lib/tauri";
import {
  registerCustomHotkey,
  unregisterCustomHotkey,
  unregisterAllCustomHotkeys,
} from "@/lib/overlay/tauri";
import { log } from "@/lib/util/logger";

/**
 * 단축키 런타임 — customHotkeys 활성 바인딩을 실제 동작에 연결.
 *
 *  1) 키보드 단독 combo (Ctrl+Shift+K 등) → Rust 글로벌 단축키로 등록.
 *     게임 창 포커스 시에도 OS 레벨에서 캡처. `custom-hotkey-fired` 이벤트 listener
 *     수신 시 binding id로 매핑하여 executeHotkeyAction 호출.
 *
 *  2) 마우스/휠 combo (Ctrl+WheelUp / MouseRight 등) → window 이벤트 listener.
 *     OS-global 마우스 hook은 미구현 — 앱 윈도우 포커스/커서 위치에서만 동작.
 *
 *  passthrough/headerHidden 두 명령은 legacy HotkeyProvider에서 별도 등록 — 중복
 *  방지 위해 이 런타임은 두 cmd 무시.
 */
export function HotkeyRuntime(): null {
  const customHotkeys = useOverlayStore((s) => s.customHotkeys);
  const lastRegisteredRef = useRef<Set<string>>(new Set());

  // ── (1) 키보드 combo — Rust 글로벌 단축키 reconcile ──
  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;

    (async () => {
      const desired = new Map<string, HotkeyBinding>();
      for (const b of customHotkeys) {
        if (!b.enabled || !b.combo) continue;
        if (b.cmd === "passthrough" || b.cmd === "headerHidden") continue;
        if (isMouseCombo(b.combo)) continue; // 마우스 combo는 window listener
        desired.set(b.id, b);
      }

      const prev = lastRegisteredRef.current;
      const next = new Set<string>(desired.keys());

      // 제거 — 이전 등록 중 desired에 없는 것
      for (const id of prev) {
        if (!next.has(id)) {
          try { await unregisterCustomHotkey(id); } catch (e) { log.warn("[hotkey] unregister fail", id, e); }
        }
      }
      // 등록 — desired 전체 재등록 (combo 변경 대응)
      for (const [id, b] of desired) {
        try {
          await registerCustomHotkey(id, b.combo);
        } catch (e) {
          log.warn("[hotkey] register fail", id, b.combo, e);
        }
        if (cancelled) return;
      }
      lastRegisteredRef.current = next;
    })();

    return () => { cancelled = true; };
  }, [customHotkeys]);

  // ── Rust 이벤트 listener — 'custom-hotkey-fired' → action dispatch ──
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const mod = await import("@tauri-apps/api/event");
        const unsub = await mod.listen<string>("custom-hotkey-fired", (e) => {
          const id = e.payload;
          const binding = useOverlayStore.getState().customHotkeys.find((b) => b.id === id);
          if (!binding || !binding.enabled) return;
          void executeHotkeyAction(binding.cmd, binding.n);
        });
        unlisten = unsub;
      } catch (e) {
        log.warn("[hotkey] event listen fail", e);
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  // ── 앱 종료 시 모든 사용자 단축키 정리 ──
  useEffect(() => {
    if (!isTauri()) return;
    return () => { void unregisterAllCustomHotkeys(); };
  }, []);

  // ── (2) 마우스/휠 combo — window 이벤트 listener ──
  useEffect(() => {
    if (typeof window === "undefined") return;
    const active = customHotkeys.filter(
      (b) => b.enabled && b.combo &&
        b.cmd !== "passthrough" && b.cmd !== "headerHidden" &&
        isMouseCombo(b.combo)
    );
    if (active.length === 0) return;

    const comboMap = new Map<string, HotkeyBinding>();
    for (const b of active) comboMap.set(b.combo.toLowerCase(), b);

    function focusBlocksHotkey(): boolean {
      const t = document.activeElement;
      if (!t) return false;
      const tag = (t.tagName || "").toLowerCase();
      if (tag === "input" || tag === "textarea" || tag === "select") return true;
      if ((t as HTMLElement).isContentEditable) return true;
      return false;
    }

    function buildMods(e: MouseEvent | WheelEvent): string[] {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Meta");
      return parts;
    }

    function tryDispatch(combo: string, preventDefault: () => void): boolean {
      const hit = comboMap.get(combo.toLowerCase());
      if (!hit) return false;
      preventDefault();
      void executeHotkeyAction(hit.cmd, hit.n);
      return true;
    }

    const MOUSE_BTN_NAME: Record<number, string> = {
      0: "MouseLeft",
      1: "MouseMiddle",
      2: "MouseRight",
      3: "MouseBack",
      4: "MouseForward",
    };

    function onMouseDown(e: MouseEvent) {
      if (focusBlocksHotkey()) return;
      // modifier 없는 좌클릭은 UI 동작 보호 — 캡처 무시
      const hasMod = e.ctrlKey || e.altKey || e.shiftKey || e.metaKey;
      if (!hasMod && e.button === 0) return;
      const name = MOUSE_BTN_NAME[e.button];
      if (!name) return;
      const parts = buildMods(e);
      parts.push(name);
      const combo = parts.join("+");
      tryDispatch(combo, () => { e.preventDefault(); e.stopPropagation(); });
    }

    function onWheel(e: WheelEvent) {
      if (focusBlocksHotkey()) return;
      if (Math.abs(e.deltaY) < 1) return;
      const parts = buildMods(e);
      parts.push(e.deltaY < 0 ? "WheelUp" : "WheelDown");
      const combo = parts.join("+");
      tryDispatch(combo, () => { e.preventDefault(); e.stopPropagation(); });
    }

    window.addEventListener("mousedown", onMouseDown, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener("mousedown", onMouseDown, true);
      window.removeEventListener("wheel", onWheel, true);
    };
  }, [customHotkeys]);

  return null;
}

/** combo에 Mouse_ 또는 Wheel_ 토큰 포함 시 마우스 combo로 분류 */
function isMouseCombo(combo: string): boolean {
  return /(?:Mouse|Wheel)(?:Left|Right|Middle|Back|Forward|Up|Down)/i.test(combo);
}
