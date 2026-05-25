"use client";

import { useEffect, useState } from "react";
import { X, Minimize2, LogOut } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/lib/tauri";
import { exitApp, closeOverlay } from "@/lib/overlay/tauri";
import { log } from "@/lib/util/logger";

/**
 * 메인/오버레이 윈도우 X 클릭 시 표시되는 종료 확인 다이얼로그.
 *
 * Rust 측 `WindowEvent::CloseRequested` 인터셉트 → prevent_close + emit
 * `window-close-requested` (payload = "main" | "overlay") → 이 컴포넌트 listener
 * → 사용자 선택:
 *  - 프로그램 종료 → exit_app (앱 완전 종료)
 *  - 트레이로 최소화 → 모든 윈도우 hide (트레이만 유지)
 *  - 취소 → 다이얼로그 닫기 (아무 동작 없음)
 *
 * root layout에서 1회 마운트.
 */
export function CloseConfirmDialog() {
  const [open, setOpen] = useState(false);
  const [origin, setOrigin] = useState<string>("");

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const mod = await import("@tauri-apps/api/event");
        const unsub = await mod.listen<string>("window-close-requested", (e) => {
          setOrigin(e.payload || "");
          setOpen(true);
        });
        unlisten = unsub;
      } catch (err) {
        log.warn("[close-confirm] listen fail", err);
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  async function handleExit() {
    setOpen(false);
    try { await exitApp(); } catch (e) { log.error("exit fail", e); }
  }

  async function handleMinimizeToTray() {
    setOpen(false);
    if (!isTauri()) return;
    try {
      // 메인 윈도우 hide
      const mod = await import("@tauri-apps/api/webviewWindow");
      const main = await mod.WebviewWindow.getByLabel("main");
      if (main) await main.hide();
      // 오버레이도 hide (Rust close_overlay는 실제 닫음 — hide만 원하면 별도 처리)
      const overlay = await mod.WebviewWindow.getByLabel("overlay");
      if (overlay) await overlay.hide();
    } catch (e) {
      log.error("minimize fail", e);
    }
  }

  function handleCancel() {
    setOpen(false);
  }

  void origin; // 향후 origin별 분기 가능 (현재는 동일 처리)
  void closeOverlay; // 미사용 경고 회피 — 추후 단순 닫기 옵션 추가 시 사용

  return (
    <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
      <DialogContent className="max-w-md p-4 gap-3" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <X className="h-4 w-4" /> 창 닫기
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          창을 닫으면 어떻게 처리할까요?
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Button
            onClick={handleExit}
            variant="ghost"
            className="w-full justify-start border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
          >
            <LogOut className="h-4 w-4" /> 프로그램 종료
            <span className="ml-auto text-[10px] text-muted-foreground">앱 완전 종료</span>
          </Button>
          <Button
            onClick={handleMinimizeToTray}
            variant="ghost"
            className="w-full justify-start border border-cat-arcana/40 bg-cat-arcana/10 text-cat-arcana hover:bg-cat-arcana/20"
          >
            <Minimize2 className="h-4 w-4" /> 트레이로 최소화
            <span className="ml-auto text-[10px] text-muted-foreground">트레이 아이콘 유지</span>
          </Button>
          <Button onClick={handleCancel} variant="ghost" className="w-full justify-start border">
            취소
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
