"use client";

import { log } from "@/lib/util/logger";

/**
 * 장비창 (별도 Tauri 윈도우) 오픈 헬퍼.
 *
 * 단일 인스턴스 — 라벨 'equip' 고정. 다른 캐릭터 클릭 시 새 창 X, URL navigate 이벤트만 emit.
 * 다중 윈도우 동시 오픈 시 리소스 누적/cross-window sync 폭주 차단.
 *
 * Tauri 비실행 환경에선 false 반환 — 호출 측이 다이얼로그 fallback.
 */
export async function openEquipWindow(charId: string): Promise<boolean> {
  try {
    const mod = await import("@tauri-apps/api/webviewWindow");
    const label = "equip";
    const existing = await mod.WebviewWindow.getByLabel(label);
    if (existing) {
      // 기존 윈도우 — Tauri event로 navigate 요청 (location.href는 외부 API에서 직접 접근 불가)
      try {
        const evMod = await import("@tauri-apps/api/event");
        await evMod.emit("equip-window-navigate", { charId });
      } catch (e) {
        log.warn("equip navigate emit fail", e);
      }
      await existing.show();
      await existing.setFocus();
      return true;
    }
    const win = new mod.WebviewWindow(label, {
      url: `/overlay/equip?charId=${encodeURIComponent(charId)}`,
      title: "장비 · 스킬",
      width: 1200,
      height: 820,
      resizable: true,
      decorations: true,
      transparent: false,
      center: true,
    });
    await new Promise<void>((resolve, reject) => {
      const unlistenP = win.once("tauri://created", () => {
        unlistenP.then((f) => f());
        resolve();
      });
      win.once("tauri://error", (e) => {
        reject(e);
      });
    });
    return true;
  } catch {
    return false;
  }
}
