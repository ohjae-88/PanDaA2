"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { isTauri } from "@/lib/tauri";
import { restartApp } from "@/lib/overlay/tauri";
import { log } from "@/lib/util/logger";

/**
 * 두 번째 인스턴스 감지 다이얼로그.
 *
 *  - Tauri single-instance 플러그인이 두 번째 실행 차단 → 기존 인스턴스에 이벤트 emit
 *  - 사용자 선택:
 *    - "기존 종료 + 재실행" → restartApp() (현재 프로세스 종료 후 새 프로세스 spawn)
 *    - "기존 유지" → 다이얼로그 닫기 (두 번째 실행 무시)
 */
export function SecondInstanceDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const mod = await import("@tauri-apps/api/event");
        const unsub = await mod.listen("second-instance-detected", () => {
          setOpen(true);
        });
        unlisten = unsub;
      } catch (e) {
        log.warn("[second-instance] listen fail", e);
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  async function handleRestart() {
    setOpen(false);
    try { await restartApp(); } catch (e) { log.error("restart fail", e); }
  }

  function handleKeep() {
    setOpen(false);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && setOpen(false)}>
      <DialogContent className="max-w-md p-4 gap-3" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-400" /> 이미 실행 중인 프로그램 감지
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          판다의 A2가 이미 실행 중입니다. 어떻게 처리할까요?
        </p>
        <div className="flex flex-col gap-2 pt-1">
          <Button
            onClick={handleRestart}
            variant="ghost"
            className="w-full justify-start border border-destructive/40 bg-destructive/10 text-destructive hover:bg-destructive/20"
          >
            <RefreshCw className="h-4 w-4" /> 기존 종료 후 재실행
            <span className="ml-auto text-[10px] text-muted-foreground">앱 재시작</span>
          </Button>
          <Button
            onClick={handleKeep}
            variant="ghost"
            className="w-full justify-start border border-cat-arcana/40 bg-cat-arcana/10 text-cat-arcana hover:bg-cat-arcana/20"
          >
            기존 유지
            <span className="ml-auto text-[10px] text-muted-foreground">두 번째 실행 무시</span>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
