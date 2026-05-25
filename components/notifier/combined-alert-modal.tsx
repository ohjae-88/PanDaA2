"use client";

import { useEffect, useState } from "react";
import { create } from "zustand";
import { Bell, Users, Layers } from "lucide-react";
import type { NotifierItem } from "@/lib/notifier/types";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { nextSpawnMs, formatRemaining } from "@/lib/notifier/time";
import { serverNow } from "@/lib/notifier/time-sync";
import { subscribeSecondTick } from "@/lib/util/global-tick";
import { cn } from "@/lib/utils";

export type CombinedAlertKind = "group" | "combine";

type CombinedState = {
  open: boolean;
  kind: CombinedAlertKind;
  title: string;
  items: NotifierItem[];
  show: (kind: CombinedAlertKind, title: string, items: NotifierItem[]) => void;
  close: () => void;
};

export const useCombinedAlert = create<CombinedState>((set) => ({
  open: false,
  kind: "group",
  title: "",
  items: [],
  show: (kind, title, items) => set({ open: true, kind, title, items }),
  close: () => set({ open: false }),
}));

export function CombinedAlertModal() {
  const { open, kind, title, items, close } = useCombinedAlert();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!open) return;
    return subscribeSecondTick(() => setTick((t) => t + 1));
  }, [open]);

  const Icon = kind === "group" ? Users : Layers;
  const accent = kind === "group" ? "border-cat-notifier" : "border-gold";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && close()}>
      <DialogContent className={cn("max-w-md border-2", accent)}>
        <DialogTitle className="text-sm uppercase tracking-wider text-cat-notifier flex items-center gap-2">
          <Icon className="h-4 w-4" /> {kind === "group" ? "그룹 알림" : "합산 알림"}
        </DialogTitle>
        <div className="text-base font-extrabold">{title}</div>
        <div className="text-xs text-muted-foreground -mt-2">
          {kind === "group" ? "그룹 내 항목 잔여 시간" : "임박 항목 합산 알림"}
        </div>

        <div className="max-h-[50vh] overflow-auto divide-y border rounded-md">
          {items.map((it) => {
            const next = nextSpawnMs(it);
            const rem = next == null ? null : next - serverNow();
            const isDue = rem != null && rem <= 0;
            return (
              <div key={it.id} className="flex items-center gap-2 px-3 py-2 text-sm">
                <Bell className={cn("h-3 w-3 flex-shrink-0", isDue ? "text-emerald-500" : "text-muted-foreground")} />
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold truncate">{it.name}</div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {it.type} · {it.area || "-"}
                  </div>
                </div>
                <div
                  className={cn(
                    "text-base font-black tabular-nums flex-shrink-0",
                    isDue ? "text-emerald-500" : (rem ?? Infinity) < 60_000 ? "text-rose-500" : "text-gold-light"
                  )}
                >
                  {isDue ? "지금" : formatRemaining(rem)}
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-end">
          <Button onClick={close} className="bg-gold text-primary-foreground hover:bg-gold/90">
            확인
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
