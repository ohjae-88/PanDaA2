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
import { useUpdateStore } from "@/lib/util/update-store";

export function UpdateDialog() {
  const { open, info, installing, progress, closeDialog, install } = useUpdateStore();

  if (!info?.available) return null;

  const pct =
    progress && progress.total
      ? Math.round((progress.downloaded / progress.total) * 100)
      : null;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v && !installing) closeDialog(); }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🎉 새 버전이 있습니다!</DialogTitle>
          <DialogDescription asChild>
            <div className="space-y-1 text-sm text-muted-foreground">
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
            </div>
          </DialogDescription>
        </DialogHeader>

        {installing && (
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

        <DialogFooter>
          <Button
            variant="outline"
            onClick={closeDialog}
            disabled={installing}
          >
            나중에
          </Button>
          <Button
            onClick={install}
            disabled={installing}
          >
            {installing ? "설치 중…" : "다운로드 및 설치"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
