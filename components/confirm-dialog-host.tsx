"use client";

import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfirmStore } from "@/lib/util/confirm";
import { cn } from "@/lib/utils";

/**
 * confirm 다이얼로그 호스트 — `confirmDialog()` 호출 시 표시.
 * layout.tsx에 1회 마운트.
 */
export function ConfirmDialogHost() {
  const open = useConfirmStore((s) => s.open);
  const options = useConfirmStore((s) => s.options);
  const respond = useConfirmStore((s) => s.respond);

  const {
    title = "확인",
    description,
    confirmText = "확인",
    cancelText = "취소",
    variant = "default",
  } = options;

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) respond(false); }}>
      <DialogContent className="max-w-sm" hideCloseButton>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && (
            <DialogDescription className="whitespace-pre-wrap">
              {description}
            </DialogDescription>
          )}
        </DialogHeader>
        <DialogFooter className="flex flex-row gap-2 sm:justify-end">
          <Button
            variant="ghost"
            onClick={() => respond(false)}
            className="flex-[3]"
          >
            {cancelText}
          </Button>
          <Button
            onClick={() => respond(true)}
            autoFocus
            className={cn(
              "flex-[7]",
              variant === "destructive" && "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            )}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
