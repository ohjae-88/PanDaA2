"use client";

import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { useBarrackStore } from "@/lib/barrack/store";
import {
  getNextChargeTs,
  getNextWeeklyResetTs,
  fmtCountdown,
  fmtCountdownLong,
} from "@/lib/barrack/charge";
import {
  OD_CHARGE_HOURS,
  EXP_REWARD_HOURS,
  TRA_REWARD_HOURS,
  NIGHTMARE_CHARGE_HOURS,
  SHUGO_CHARGE_HOURS,
} from "@/lib/barrack/constants";
import { subscribeSecondTick } from "@/lib/util/global-tick";
import { cn } from "@/lib/utils";

type Entry = {
  icon: string;
  name: string;
  next: number;
  weekly?: boolean;
  colorClass: string;
};

export function ChargePanel({ page = "dash" }: { page?: "dash" | "simple" }) {
  const db = useBarrackStore((s) => s.dbSettings);
  const [open, setOpen] = useState(true);
  const [tick, setTick] = useState(0);

  // 1초 갱신 — 글로벌 visibility-aware tick 공유
  useEffect(() => subscribeSecondTick(() => setTick((t) => t + 1)), []);

  // 펼침 상태 영속화
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`a2-cpanel-${page}`);
      if (saved === "closed") setOpen(false);
    } catch {}
  }, [page]);

  function toggle() {
    const next = !open;
    setOpen(next);
    try {
      localStorage.setItem(`a2-cpanel-${page}`, next ? "open" : "closed");
    } catch {}
  }

  const now = Date.now();
  const entries: Entry[] = [
    { icon: "🔷", name: "오드 충전",   next: getNextChargeTs(db.od?.chargeHours ?? OD_CHARGE_HOURS), colorClass: "text-cat-barrack" },
    { icon: "🗺", name: "원정 보상",   next: getNextChargeTs(db.expedition?.chargeHours ?? EXP_REWARD_HOURS), colorClass: "text-gold" },
    { icon: "⚡", name: "초월 보상",   next: getNextChargeTs(db.transcend?.chargeHours ?? TRA_REWARD_HOURS), colorClass: "text-cat-arcana" },
    { icon: "👁", name: "악몽 적립",   next: getNextChargeTs(NIGHTMARE_CHARGE_HOURS), colorClass: "text-cat-party" },
    { icon: "🐾", name: "슈고 적립",   next: getNextChargeTs(SHUGO_CHARGE_HOURS), colorClass: "text-cat-notifier" },
    { icon: "🔄", name: "주간 초기화", next: getNextWeeklyResetTs(), weekly: true, colorClass: "text-emerald-400" },
  ];
  void tick; // 매초 리렌더 트리거 사용

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30">
        <span className="text-sm font-extrabold flex items-center gap-1.5">
          <span className="text-base">⏱</span> 자동 충전 타이머
        </span>
        <button
          onClick={toggle}
          className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1"
        >
          {open ? <><ChevronUp className="h-3 w-3" /> 접기</> : <><ChevronDown className="h-3 w-3" /> 펼치기</>}
        </button>
      </div>
      {open && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 p-3">
          {entries.map((e) => {
            const ms = e.next - now;
            const text = e.weekly ? fmtCountdownLong(ms) : fmtCountdown(ms);
            const isSoon = ms > 0 && ms < 60 * 60 * 1000;
            return (
              <div
                key={e.name}
                className={cn(
                  "rounded-md border bg-background/60 px-3 py-2 flex flex-col gap-0.5",
                  isSoon && "border-gold/40 bg-gold/5"
                )}
              >
                <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                  <span className="text-base leading-none">{e.icon}</span>
                  <span className="font-bold">{e.name}</span>
                </div>
                <div className={cn("text-sm font-extrabold tabular-nums", e.colorClass)}>
                  {text}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
