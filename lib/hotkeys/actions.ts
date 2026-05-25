"use client";

/**
 * 단축키 명령 실제 액션 dispatcher.
 *
 * 호출 위치:
 *  - lib/hotkeys/runtime.tsx — window keydown/mousedown/wheel 매칭 시 실행
 *
 * 키보드 단독 combo는 in-app 포커스 상태에서만 동작. 진정한 글로벌 단축키는
 * passthrough/headerHidden 두 개만 Rust로 등록되어 있음 (별도 경로).
 */

import { isTauri } from "@/lib/tauri";
import { useOverlayStore } from "@/lib/overlay/store";
import { useBarrackStore } from "@/lib/barrack/store";
import { useNotifierStore } from "@/lib/notifier/store";
import { toggleOverlay, setOverlayPosition, setOverlaySize } from "@/lib/overlay/tauri";
import { CONTENTS } from "@/lib/barrack/constants";
import type { RaidType } from "@/lib/barrack/types";
import { log } from "@/lib/util/logger";

const OVERLAY_CONTENT_IDS = [
  "expedition", "transcend", "sanctuary_ludra", "sanctuary_bagot", "etc",
] as const;
type OverlayContentId = (typeof OVERLAY_CONTENT_IDS)[number];

/** 메인 액션 dispatcher — cmd id에 따라 실제 동작 실행. */
export async function executeHotkeyAction(cmd: string, n?: number): Promise<void> {
  try {
    switch (cmd) {
      case "passthrough":
      case "headerHidden":
        // 기존 Rust 글로벌 단축키로 처리됨 — dispatcher 무시
        return;

      case "overlayToggle":
        if (isTauri()) await toggleOverlay();
        return;

      case "overlayCenter":
        await centerOverlay();
        return;

      case "mainCenter":
        await centerMain();
        return;

      case "overlayScaleUp": {
        const cur = useOverlayStore.getState().scale;
        useOverlayStore.getState().setScale(Math.min(2.0, +(cur + 0.1).toFixed(2)));
        return;
      }
      case "overlayScaleDown": {
        const cur = useOverlayStore.getState().scale;
        useOverlayStore.getState().setScale(Math.max(0.5, +(cur - 0.1).toFixed(2)));
        return;
      }
      case "overlayOpacityUp": {
        const cur = useOverlayStore.getState().overallOpacity;
        useOverlayStore.getState().setOverallOpacity(Math.min(1.0, +(cur + 0.1).toFixed(2)));
        return;
      }
      case "overlayOpacityDown": {
        const cur = useOverlayStore.getState().overallOpacity;
        useOverlayStore.getState().setOverallOpacity(Math.max(0.1, +(cur - 0.1).toFixed(2)));
        return;
      }

      case "collapsedModeToggle": {
        const s = useOverlayStore.getState();
        s.setCollapsedMode(s.collapsedMode === "party" ? "normal" : "party");
        return;
      }

      case "notifierDbRefresh": {
        const p = (useNotifierStore as unknown as { persist?: { rehydrate: () => Promise<void> | void } }).persist;
        if (p?.rehydrate) await Promise.resolve(p.rehydrate());
        return;
      }

      case "notifierMuteN": {
        if (typeof n !== "number" || n < 1) return;
        const s = useNotifierStore.getState();
        // 정렬된 표시 항목 — store itemOrder 우선
        const items = sortNotifierItems(s.items, s.itemOrder);
        const target = items[n - 1];
        if (!target) return;
        // 알림 토글 (잡음 처리)
        s.toggleNotify(target.id);
        return;
      }

      case "barrackContentNext":
      case "barrackContentPrev": {
        const dir = cmd === "barrackContentNext" ? 1 : -1;
        const cur = useOverlayStore.getState().barrack.selectedContentId ?? "expedition";
        const idx = OVERLAY_CONTENT_IDS.indexOf(cur as OverlayContentId);
        const safeIdx = idx < 0 ? 0 : idx;
        const next = (safeIdx + dir + OVERLAY_CONTENT_IDS.length) % OVERLAY_CONTENT_IDS.length;
        useOverlayStore.getState().patchBarrack({ selectedContentId: OVERLAY_CONTENT_IDS[next] });
        return;
      }

      case "barrackCharDoneN":
      case "barrackCharBossN": {
        if (typeof n !== "number" || n < 1) return;
        const overlay = useOverlayStore.getState();
        const contentId = overlay.barrack.selectedContentId ?? "expedition";
        // 기타 페이지(etc) 또는 raidType 아님 → skip (spec: 기타 페이지 제외)
        if (!isRaidContent(contentId)) return;
        // Nth 표시 캐릭터 결정
        const barrack = useBarrackStore.getState();
        const visible = barrack.characters.filter((c) => !c.hidden);
        // 다중 모드 — selectedCharIds 사용, 없으면 visible 순서
        const slotIds = overlay.barrack.selectedCharIds ?? [];
        let pickId: string | undefined;
        if (slotIds[n - 1] && visible.find((c) => c.id === slotIds[n - 1])) {
          pickId = slotIds[n - 1];
        } else {
          pickId = visible[n - 1]?.id;
        }
        if (!pickId) return;
        const raidKey = contentId as RaidType;
        const target = cmd === "barrackCharDoneN" ? "both" : "boss";
        barrack.doRaid(pickId, raidKey, target, -1);
        return;
      }

      default:
        log.warn("[hotkey] unknown command:", cmd);
    }
  } catch (e) {
    log.error("[hotkey] action error", cmd, e);
  }
}

function isRaidContent(id: string): id is RaidType {
  return id === "expedition" || id === "transcend" || id === "sanctuary_ludra" || id === "sanctuary_bagot";
}

function sortNotifierItems<T extends { id: string }>(items: T[], order: string[] | undefined): T[] {
  if (!order || order.length === 0) return items;
  const idx = new Map(order.map((id, i) => [id, i]));
  return items.slice().sort((a, b) => {
    const ai = idx.has(a.id) ? idx.get(a.id)! : Infinity;
    const bi = idx.has(b.id) ? idx.get(b.id)! : Infinity;
    return ai - bi;
  });
}

/** 오버레이 윈도우 화면 중앙 이동 — geometry 기반 */
async function centerOverlay(): Promise<void> {
  if (!isTauri()) return;
  try {
    const winMod = await import("@tauri-apps/api/window");
    const monitor = await winMod.currentMonitor();
    if (!monitor) return;
    const sf = monitor.scaleFactor || 1;
    const screenW = monitor.size.width / sf;
    const screenH = monitor.size.height / sf;
    const sizeBase = useOverlayStore.getState().collapsedSize;
    const scale = useOverlayStore.getState().scale;
    const w = sizeBase.w * scale;
    const h = sizeBase.h * scale;
    const x = Math.round((screenW - w) / 2);
    const y = Math.round((screenH - h) / 2);
    await setOverlaySize(w, h);
    await setOverlayPosition(x, y);
    // 저장된 위치도 갱신
    useOverlayStore.getState().setCollapsedPos({ x, y });
  } catch (e) {
    log.warn("centerOverlay failed", e);
  }
}

/** 메인 윈도우 화면 중앙 이동 */
async function centerMain(): Promise<void> {
  if (!isTauri()) return;
  try {
    const winMod = await import("@tauri-apps/api/window");
    const mod = await import("@tauri-apps/api/webviewWindow");
    const main = await mod.WebviewWindow.getByLabel("main");
    if (!main) return;
    const monitor = await winMod.currentMonitor();
    if (!monitor) return;
    const sf = monitor.scaleFactor || 1;
    const screenW = monitor.size.width / sf;
    const screenH = monitor.size.height / sf;
    const size = await main.outerSize();
    const w = size.width / sf;
    const h = size.height / sf;
    const x = Math.round((screenW - w) / 2);
    const y = Math.round((screenH - h) / 2);
    await main.setPosition(new winMod.LogicalPosition(x, y));
    await main.show();
    await main.setFocus();
  } catch (e) {
    log.warn("centerMain failed", e);
  }
}

void CONTENTS; // 미사용 경고 방지 — 추후 카탈로그 확장 시 사용
