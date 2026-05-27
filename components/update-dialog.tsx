"use client";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useUpdateStore, RELEASES_URL } from "@/lib/util/update-store";
import { revealInExplorer } from "@/lib/tauri";
import { toast } from "@/lib/util/toast";

async function openReleasesPage() {
  try {
    const { open } = await import("@tauri-apps/plugin-shell");
    await open(RELEASES_URL);
  } catch {
    window.open(RELEASES_URL, "_blank");
  }
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    toast.success("경로가 복사되었습니다.");
  } catch {
    toast.error("복사에 실패했습니다.");
  }
}

export function UpdateDialog() {
  const {
    open, info, failed, installing, progress,
    errorLogPath, closeDialog, install,
  } = useUpdateStore();

  const shouldShow = open && (info?.available || failed);
  if (!shouldShow) return null;

  const pct =
    progress && progress.total
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null;

  // 업데이트 있음 + 아직 실패 전
  const isUpdateMode = info?.available && !failed;
  // 업데이트 있음 + 설치 실패
  const isInstallFailed = info?.available && failed;
  // 서버 연결 실패 (업데이트 정보 자체를 못 가져온 경우)
  const isCheckFailed = !info?.available && failed;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !installing) closeDialog(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isUpdateMode && "🎉 새 버전이 있습니다!"}
            {isInstallFailed && "⚠️ 업데이트 설치 실패"}
            {isCheckFailed && "⚠️ 업데이트 확인 실패"}
          </DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-sm text-muted-foreground">
              {isUpdateMode && (
                <>
                  <p>
                    <span className="line-through opacity-60">v{info.currentVersion}</span>
                    <span className="mx-2">→</span>
                    <span className="text-foreground font-semibold">v{info.newVersion}</span>
                  </p>
                  {info.notes && (
                    <p className="mt-2 rounded bg-muted p-2 text-xs whitespace-pre-wrap max-h-32 overflow-y-auto">
                      {info.notes}
                    </p>
                  )}
                </>
              )}
              {isInstallFailed && (
                <p>
                  자동 설치 중 오류가 발생했습니다.<br />
                  로그 파일을 개발자에게 전달하거나, 직접 다운로드해 주세요.
                </p>
              )}
              {isCheckFailed && (
                <p>
                  업데이트 서버에 연결할 수 없습니다.<br />
                  잠시 후 다시 시도하거나, 직접 다운로드해 주세요.
                </p>
              )}
            </div>
          </DialogDescription>
        </DialogHeader>

        {/* 다운로드 진행 바 */}
        {isUpdateMode && installing && (
          <div className="space-y-1.5">
            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
              <div
                className={
                  pct !== null
                    ? "h-full bg-primary transition-all duration-300"
                    : "h-full bg-primary animate-pulse w-full"
                }
                style={pct !== null ? { width: `${pct}%` } : undefined}
              />
            </div>
            <p className="text-xs text-center text-muted-foreground">
              {pct !== null ? `다운로드 중… ${pct}%` : "다운로드 준비 중…"}
            </p>
          </div>
        )}

        {/* 실패 로그 파일 정보 */}
        {(isInstallFailed || isCheckFailed) && errorLogPath && (
          <div className="rounded-md border border-border bg-muted/40 p-3 space-y-2">
            <p className="text-xs font-semibold text-foreground">📄 실패 로그가 저장되었습니다</p>
            <p className="text-[11px] font-mono break-all text-muted-foreground leading-relaxed">
              {errorLogPath}
            </p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => revealInExplorer(errorLogPath)}
              >
                📂 폴더 열기
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="text-xs h-7"
                onClick={() => copyToClipboard(errorLogPath)}
              >
                📋 경로 복사
              </Button>
            </div>
          </div>
        )}

        <DialogFooter>
          {isUpdateMode ? (
            <>
              <Button variant="outline" onClick={closeDialog} disabled={installing}>
                나중에
              </Button>
              <Button onClick={install} disabled={installing}>
                {installing ? "설치 중…" : "다운로드 및 설치"}
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" onClick={closeDialog}>
                닫기
              </Button>
              <Button onClick={openReleasesPage}>
                GitHub에서 다운로드
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
