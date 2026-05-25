"use client";

import { create } from "zustand";
import type { NotifierItem } from "@/lib/notifier/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

type AlertState = {
  open: boolean;
  item: NotifierItem | null;
  remMs: number;
  show: (item: NotifierItem, remMs: number) => void;
  close: () => void;
};

export const useNotifierAlert = create<AlertState>((set) => ({
  open: false,
  item: null,
  remMs: 0,
  show: (item, remMs) => set({ open: true, item, remMs }),
  close: () => set({ open: false }),
}));

export function NotifierAlertModal() {
  const { open, item, remMs, close } = useNotifierAlert();
  if (!item) return null;
  const minLeft = Math.max(1, Math.ceil(remMs / 60_000));
  const dueNow = remMs <= 0;
  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className="max-w-sm border-cat-notifier text-center">
        <DialogTitle className="text-sm uppercase tracking-wider text-cat-notifier">🔔 알리미</DialogTitle>
        <div className="text-2xl font-extrabold">{item.name}</div>
        <div className="text-xs text-muted-foreground">
          {item.type} · {item.area || "-"}
        </div>
        <div className="text-base">
          {dueNow ? (
            <span className="text-gold-light font-extrabold">지금 등장</span>
          ) : (
            <>
              <b className="text-2xl text-gold-light">{minLeft}</b>분 후 등장
            </>
          )}
        </div>
        <div className="flex justify-center">
          <Button onClick={close} className="bg-gold text-primary-foreground hover:bg-gold/90">
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
