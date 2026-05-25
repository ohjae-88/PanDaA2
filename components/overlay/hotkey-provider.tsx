"use client";

import { useEffect } from "react";
import { isTauri } from "@/lib/tauri";
import { useOverlayStore } from "@/lib/overlay/store";
import {
  registerOverlayPassthroughHotkey,
  unregisterOverlayPassthroughHotkey,
  registerOverlayHeaderToggleHotkey,
  unregisterOverlayHeaderToggleHotkey,
} from "@/lib/overlay/tauri";
import { log } from "@/lib/util/logger";

/**
 * 클릭 통과 글로벌 단축키 등록. 메인이 기본 hidden인 환경에서도 작동하도록
 * 메인/오버레이 어디서 마운트되든 등록 시도. Rust 측이 unregister-then-register
 * 패턴이므로 중복 등록은 안전 (마지막에 마운트된 윈도우 기준).
 *
 * 우선순위:
 *  - 메인 윈도우가 활성이면 메인이 등록 (안정적 / 항상 alive)
 *  - 오버레이만 떠 있으면 오버레이가 등록
 */
export function HotkeyProvider() {
  const hotkey = useOverlayStore((s) => s.passthroughHotkey);
  const headerHotkey = useOverlayStore((s) => s.headerHiddenHotkey);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        if (!hotkey || !hotkey.trim()) {
          await unregisterOverlayPassthroughHotkey();
          return;
        }
        await registerOverlayPassthroughHotkey(hotkey.trim());
      } catch (e) {
        log.warn("[hotkey:passthrough] register failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [hotkey]);

  useEffect(() => {
    if (!isTauri()) return;
    let cancelled = false;
    (async () => {
      try {
        if (cancelled) return;
        if (!headerHotkey || !headerHotkey.trim()) {
          await unregisterOverlayHeaderToggleHotkey();
          return;
        }
        await registerOverlayHeaderToggleHotkey(headerHotkey.trim());
      } catch (e) {
        log.warn("[hotkey:headerToggle] register failed:", e);
      }
    })();
    return () => { cancelled = true; };
  }, [headerHotkey]);

  return null;
}
