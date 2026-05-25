"use client";

import { useEffect, useState } from "react";
import { Star, Pencil, RotateCw, Clock, Bell, Eye, EyeOff } from "lucide-react";
import { useNotifierStore } from "@/lib/notifier/store";
import type { NotifierItem } from "@/lib/notifier/types";
import {
  formatAbsTime,
  formatRemaining,
  nextSpawnList,
  nextSpawnMs,
  nextWedReset,
  remainingPhase,
  typeKey,
} from "@/lib/notifier/time";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { serverNow } from "@/lib/notifier/time-sync";

type Props = {
  item: NotifierItem;
  onEdit: (id: string) => void;
  onTimeInput: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
  fixedHeight?: boolean;
};

const TYPE_BG_MAP: Record<string, string> = {
  event: "bg-gold/10 text-gold-light border-gold/30",
  abyss: "bg-cat-party/10 text-cat-party border-cat-party/30",
  cheon: "bg-cat-barrack/10 text-cat-barrack border-cat-barrack/30",
  mok:   "bg-cat-notifier/10 text-cat-notifier border-cat-notifier/30",
  etc:   "bg-muted text-muted-foreground border-border",
};

const TIER_MAP: Record<number, string> = {
  1: "text-rose-400 bg-rose-400/10 border-rose-400/30",
  2: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  3: "text-yellow-300 bg-yellow-300/10 border-yellow-300/30",
  4: "text-emerald-400 bg-emerald-400/10 border-emerald-400/30",
  5: "text-sky-300 bg-sky-300/10 border-sky-300/30",
};

export function NotifierCard({
  item,
  onEdit,
  onTimeInput,
  draggable,
  onDragStart,
  onDragOver,
  onDrop,
  isDragging,
  isDragOver,
  fixedHeight,
}: Props) {
  const toggleImportant = useNotifierStore((s) => s.toggleImportant);
  const markSpawned = useNotifierStore((s) => s.markSpawned);
  const toggleNotify = useNotifierStore((s) => s.toggleNotify);
  const toggleDisplayHidden = useNotifierStore((s) => s.toggleDisplayHidden);
  const shown = !item.displayHidden;

  // 매초 리렌더 트리거 — 벽시계 초 경계에 정렬하여 메인/오버레이 동기화
  const [, setNow] = useState(() => Date.now());
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const schedule = () => {
      if (stopped) return;
      const ms = Date.now();
      const delay = 1000 - (ms % 1000);
      timer = setTimeout(() => {
        setNow(Date.now());
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const next = nextSpawnMs(item);
  const rem = next == null ? null : next - serverNow();
  const phase = remainingPhase(item, rem);
  const isCooldown = item.cycleType === "cooldown";
  const tk = typeKey(item.type);
  const tooltipList = nextSpawnList(item, 5);
  const cutoffLabel = formatAbsTime(nextWedReset());

  const remColor =
    phase === "near" ? "text-rose-400" :
    phase === "due"  ? "text-emerald-400" :
    phase === "na"   ? "text-muted-foreground text-sm font-semibold" :
                       "text-gold-light";
  const remAnim = phase === "soon" || phase === "near" ? "animate-pulse-soft" : "";

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          draggable={draggable}
          onDragStart={(e) => onDragStart?.(e, item.id)}
          onDragOver={(e) => onDragOver?.(e, item.id)}
          onDrop={(e) => onDrop?.(e, item.id)}
          data-id={item.id}
          className={cn(
            "relative flex flex-col overflow-hidden rounded-lg border bg-card text-card-foreground transition-colors",
            "min-h-[92px]",
            fixedHeight && "h-[108px]",
            item.important && "border-gold/55 shadow-[0_0_0_1px_hsl(var(--gold)/0.25),0_0_12px_hsl(var(--gold)/0.15)] bg-gradient-to-br from-gold/10 to-card",
            isDragging && "opacity-50",
            isDragOver && "outline-2 outline-dashed outline-accent -outline-offset-2",
            draggable && "cursor-grab active:cursor-grabbing"
          )}
        >
          {/* main row */}
          <div className="flex flex-1 items-center gap-2 px-3 py-2 min-w-0">
            <div className="flex-1 min-w-0 flex flex-col gap-0.5">
              <div className="flex items-center gap-1.5">
                {item.tier > 0 && (
                  <span className={cn("text-[9px] font-extrabold px-1 py-0.5 rounded border leading-none", TIER_MAP[item.tier] ?? "")}>
                    T{item.tier}
                  </span>
                )}
                <span className="text-base font-extrabold truncate">{item.name}</span>
              </div>
              <div className="flex items-center gap-1.5 min-w-0">
                <span className={cn("text-[10px] font-extrabold px-1.5 py-0.5 rounded-full border tracking-wider leading-none", TYPE_BG_MAP[tk])}>
                  {item.type}
                </span>
                <span className="text-[11px] text-muted-foreground truncate">{item.area || "-"}</span>
              </div>
            </div>
            <div className="flex flex-col items-end gap-0.5 flex-shrink-0">
              <div className="text-xs font-extrabold text-gold-light tabular-nums">
                {next == null ? "" : formatAbsTime(next)}
              </div>
              <div className={cn("text-lg font-black tabular-nums tracking-wide leading-tight", remColor, remAnim)}>
                {formatRemaining(rem)}
              </div>
            </div>
          </div>

          {/* bottom actions */}
          <div className="grid grid-cols-6 border-t">
            <button
              onClick={() => toggleDisplayHidden(item.id)}
              className={cn(
                "flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold border-r transition-colors",
                shown
                  ? "text-cat-notifier bg-cat-notifier/5 hover:bg-cat-notifier/15"
                  : "text-muted-foreground hover:text-cat-notifier hover:bg-cat-notifier/5"
              )}
              title={shown ? "사용자설정 모드에서 표시 중 — 클릭하여 숨기기" : "사용자설정 모드에서 숨김 — 클릭하여 표시"}
            >
              {shown ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
              <span>{shown ? "표시" : "숨김"}</span>
            </button>
            <button
              onClick={() => toggleNotify(item.id)}
              className={cn(
                "flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold border-r transition-colors",
                item.notifyEnabled
                  ? "text-gold bg-gold/5 hover:bg-gold/15"
                  : "text-muted-foreground hover:text-gold hover:bg-gold/5"
              )}
              title={item.notifyEnabled ? `알림 켜짐 (${item.notifyBeforeMin}분 전) — 클릭하여 끄기` : "알림 꺼짐 — 클릭하여 켜기"}
            >
              <Bell className={cn("h-3 w-3", item.notifyEnabled && "fill-current")} />
              <span>{item.notifyEnabled ? `${item.notifyBeforeMin}분` : "꺼짐"}</span>
            </button>
            <button
              onClick={() => toggleImportant(item.id)}
              className={cn(
                "flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold border-r transition-colors hover:bg-gold/10 hover:text-gold",
                item.important ? "bg-gold/10 text-gold-light" : "text-muted-foreground"
              )}
              title="중요 표시"
            >
              <Star className={cn("h-3 w-3", item.important && "fill-current")} />
              <span>중요</span>
            </button>
            <button
              onClick={() => onEdit(item.id)}
              className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold border-r text-muted-foreground transition-colors hover:bg-gold/10 hover:text-gold"
              title="편집"
            >
              <Pencil className="h-3 w-3" />
              <span>편집</span>
            </button>
            {isCooldown ? (
              <>
                <button
                  onClick={() => markSpawned(item.id)}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold border-r text-muted-foreground transition-colors hover:bg-gold/10 hover:text-gold"
                  title="방금 잡음 → 쿨타임 재시작"
                >
                  <RotateCw className="h-3 w-3" />
                  <span>잡음</span>
                </button>
                <button
                  onClick={() => onTimeInput(item.id)}
                  className="flex items-center justify-center gap-1 px-2 py-1.5 text-xs font-bold text-muted-foreground transition-colors hover:bg-gold/10 hover:text-gold"
                  title="잡은 시간 / 남은 시간 입력"
                >
                  <Clock className="h-3 w-3" />
                  <span>시간</span>
                </button>
              </>
            ) : (
              <>
                <span className="flex items-center justify-center px-2 py-1.5 text-xs text-muted-foreground border-r opacity-40">[ - ]</span>
                <span className="flex items-center justify-center px-2 py-1.5 text-xs text-muted-foreground opacity-40">[ - ]</span>
              </>
            )}
          </div>
        </div>
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[260px] p-3 bg-card text-card-foreground">
        <div className="border-b pb-1.5 mb-1.5">
          <div className="text-sm font-extrabold">{item.name}</div>
          <div className="text-[11px] text-muted-foreground">
            {item.type} · {isCooldown ? `쿨 ${item.cycleMinutes}분` : "특정시간"}
          </div>
        </div>
        <div className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">다음 완료 시간</div>
        <div className="flex flex-col gap-0.5">
          {tooltipList.length ? (
            tooltipList.map((t, i) => (
              <div key={t} className="flex items-center gap-2 text-xs tabular-nums">
                <span className="text-muted-foreground font-bold w-4">{i + 1}.</span>
                <span className="font-bold">{formatAbsTime(t)}</span>
              </div>
            ))
          ) : (
            <span className="text-[11px] text-muted-foreground italic">예정된 완료 시간 없음</span>
          )}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5 pt-1.5 border-t border-dotted">
          ~ {cutoffLabel} 주간 리셋 전까지
        </div>
      </TooltipContent>
    </Tooltip>
  );
}
