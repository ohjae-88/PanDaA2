"use client";

import { useEffect, useState } from "react";
import { useBarrackStore } from "@/lib/barrack/store";
import type { Character } from "@/lib/barrack/types";
import { subscribeSecondTick } from "@/lib/util/global-tick";
import { cn } from "@/lib/utils";
import { RaidEditDialog } from "./raid-edit-dialog";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { formatLogLine, RAID_NAME_KO } from "@/lib/barrack/content-log";

type RaidKey = "expedition" | "transcend" | "sanctuary_ludra" | "sanctuary_bagot";

// 카테고리별 색상 토큰 (V4.0.9 색상 매핑)
// 라이트 모드 가시성: bg /30, 진한 텍스트(700) + dark:기존 색상
const RAID_COLORS: Record<RaidKey, { headBg: string; headFg: string; border: string }> = {
  expedition:      { headBg: "bg-cat-barrack/30",  headFg: "text-cat-barrack",                        border: "border-cat-barrack/50" },
  transcend:       { headBg: "bg-cat-arcana/30",   headFg: "text-cat-arcana",                         border: "border-cat-arcana/50" },
  sanctuary_ludra: { headBg: "bg-yellow-500/30",   headFg: "text-yellow-700 dark:text-yellow-300",    border: "border-yellow-500/50" },
  sanctuary_bagot: { headBg: "bg-amber-500/30",    headFg: "text-amber-700  dark:text-amber-300",     border: "border-amber-500/50" },
};

const RAID_LABELS: Record<RaidKey, { icon: string; name: string }> = {
  expedition:      { icon: "🗺",  name: "원정" },
  transcend:       { icon: "⚡",  name: "초월" },
  sanctuary_ludra: { icon: "✨",  name: "루드라" },
  sanctuary_bagot: { icon: "🌙",  name: "바고트" },
};

function preventCtxMenu(e: React.MouseEvent) {
  e.preventDefault();
}

function xbadge(n: number) {
  return n > 0 ? <span className="text-emerald-400 font-bold text-[11px] ml-0.5">(+{n})</span> : null;
}

/** 자리 표시자 [ - ] — c.hiddenContents[id] 일 때 */
export function HiddenPlaceholder() {
  return (
    <div className="rounded border border-dashed bg-background/30 flex items-center justify-center text-muted-foreground text-xs opacity-50">
      [ − ]
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  레이드 박스 — 원정 / 초월 / 성역(루드라/바고트)
// ─────────────────────────────────────────────────────────
export function RaidBox({ char, raidKey }: { char: Character; raidKey: RaidKey }) {
  const doRaid = useBarrackStore((s) => s.doRaid);
  const [editOpen, setEditOpen] = useState(false);
  const r = char[raidKey];
  if (!r) return <HiddenPlaceholder />;

  const rB = r.rewardBase || 0;
  const bB = r.bossBase || 0;
  const rEx = r.rewardExtra || 0;
  const bEx = r.bossExtra || 0;
  const allDone = (r.reward + rEx) <= 0 && (r.boss + bEx) <= 0;
  const started = r.reward < rB || r.boss < bB;
  const labels = RAID_LABELS[raidKey];
  const colors = RAID_COLORS[raidKey];

  function btnHandlers(target: "reward" | "boss" | "both") {
    return {
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); doRaid(char.id, raidKey, target, -1); },
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); doRaid(char.id, raidKey, target, +1); },
    };
  }

  return (
    <div className={cn(
      "rounded border flex flex-col overflow-hidden transition-colors",
      colors.border,
      allDone ? "opacity-40" : started ? "" : "opacity-90"
    )}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={cn("flex items-center justify-center gap-1 px-1.5 py-1 text-xs font-extrabold border-b cursor-help", colors.headBg, colors.headFg, colors.border)}>
            <span className="text-sm">{labels.icon}</span>
            <span className="truncate">{labels.name}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-[280px] p-3 bg-card text-card-foreground">
          <RaidRecentLogTooltip char={char} raidKey={raidKey} />
        </TooltipContent>
      </Tooltip>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setEditOpen(true); }}
        onContextMenu={(e) => e.preventDefault()}
        title="클릭하여 잔여/기본/추가 수량 수정"
        className="flex-1 px-1 py-1.5 flex flex-col items-center justify-center gap-1 text-xs min-w-0 hover:bg-accent/10 transition-colors"
      >
        <div className="flex items-center tabular-nums gap-1">
          <span className="flex-shrink-0">🎁</span>
          <span className={cn("font-bold truncate", r.reward <= 0 && "text-muted-foreground line-through")}>
            {r.reward}/{rB}{xbadge(rEx)}
          </span>
        </div>
        <div className="flex items-center tabular-nums gap-1">
          <span className="flex-shrink-0">{(raidKey === "sanctuary_ludra" || raidKey === "sanctuary_bagot") ? "🎫" : "💀"}</span>
          <span className={cn("font-bold truncate", r.boss <= 0 && "text-muted-foreground line-through")}>
            {r.boss}/{bB}{xbadge(bEx)}
          </span>
        </div>
      </button>
      <div
        className="grid border-t"
        style={{ gridTemplateColumns: "2fr 1fr" }}
        onContextMenu={preventCtxMenu}
      >
        <button
          {...btnHandlers("both")}
          className="text-xs py-2 hover:bg-cat-arcana/10 border-r transition-colors"
          title={(raidKey === "sanctuary_ludra" || raidKey === "sanctuary_bagot")
            ? "🎁+🎫  좌:사용 / 우:반환"
            : "🎁+💀  좌:사용 / 우:반환"}
        >
          {(raidKey === "sanctuary_ludra" || raidKey === "sanctuary_bagot") ? "🎁🎫" : "🎁💀"}
        </button>
        <button
          {...btnHandlers("boss")}
          className="text-xs py-2 hover:bg-rose-500/10 transition-colors"
          title={(raidKey === "sanctuary_ludra" || raidKey === "sanctuary_bagot")
            ? "🎫 입장권 좌:사용 / 우:반환"
            : "💀 좌:사용 / 우:반환"}
        >
          {(raidKey === "sanctuary_ludra" || raidKey === "sanctuary_bagot") ? "🎫" : "💀"}
        </button>
      </div>
      <RaidEditDialog
        open={editOpen}
        charId={char.id}
        raidKey={raidKey}
        onClose={() => setEditOpen(false)}
      />
    </div>
  );
}

/** RaidBox 헤더 hover 시 표시 — 해당 raidKey 최근 5건 로그.
 *  매초 tick으로 경과시간 갱신. */
function RaidRecentLogTooltip({ char, raidKey }: { char: Character; raidKey: RaidKey }) {
  const [, setTick] = useState(0);
  useEffect(() => subscribeSecondTick(() => setTick((t) => t + 1)), []);
  const list = (char.contentChangeLog ?? [])
    .filter((l) => l.raidKey === raidKey)
    .slice(0, 5);
  const name = RAID_NAME_KO[raidKey];
  return (
    <div>
      <div className="border-b pb-1.5 mb-1.5">
        <div className="text-sm font-extrabold">{name} 최근 변경 기록</div>
        <div className="text-[10px] text-muted-foreground">최근 5건까지 표시</div>
      </div>
      {list.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic py-1">기록 없음</div>
      ) : (
        <div className="flex flex-col gap-0.5">
          {list.map((log, i) => (
            <div key={i} className="text-xs tabular-nums">
              <span className="text-muted-foreground font-bold mr-1.5">{i + 1}.</span>
              <span>{formatLogLine(log, Date.now())}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  오드(상점) 박스 — 변환 / 상점
// ─────────────────────────────────────────────────────────
export function ShopBox({ char }: { char: Character }) {
  const doShop = useBarrackStore((s) => s.doShop);
  const db = useBarrackStore((s) => s.dbSettings);
  const convMax = db.charConvert?.max ?? 4;
  const buyMax = db.charBuy?.max ?? 4;
  const conv = char.shop?.convert ?? 0;
  const buy = char.shop?.buy ?? 0;
  const allDone = conv >= convMax && buy >= buyMax;

  function btn(kind: "convert" | "buy") {
    return {
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); doShop(char.id, kind, +1); },
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); doShop(char.id, kind, -1); },
    };
  }

  return (
    <div className={cn("rounded border border-orange-500/30 flex flex-col overflow-hidden", allDone && "opacity-40")}>
      <div className="flex items-center justify-center gap-1 px-1.5 py-1 text-xs font-extrabold border-b border-orange-500/50 bg-orange-500/30 text-orange-700 dark:text-orange-300">
        <span className="text-sm">💎</span>
        <span className="truncate">오드</span>
      </div>
      <div className="flex-1 px-1.5 py-1.5 flex flex-col items-center justify-center gap-1.5 text-xs">
        <div className="flex items-center justify-center gap-1.5">
          <button
            {...btn("convert")}
            className={cn(
              "text-xs font-bold px-2.5 py-1 rounded border transition-colors min-w-[44px]",
              conv >= convMax ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-700 dark:text-emerald-300" : "bg-card hover:bg-orange-500/10 border-border"
            )}
            title="좌:사용(잔여 -1, +오드40) / 우:반환(잔여 +1)"
          >변환</button>
          {/* 잔여/최대 — 초기화 시 max/max → 사용 시 1씩 감소 → 0/max 완료 */}
          <span className={cn("tabular-nums font-bold", conv >= convMax && "text-emerald-700 dark:text-emerald-300")}>
            {Math.max(0, convMax - conv)}/{convMax}
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <button
            {...btn("buy")}
            className={cn(
              "text-xs font-bold px-2.5 py-1 rounded border transition-colors min-w-[44px]",
              buy >= buyMax ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-700 dark:text-emerald-300" : "bg-card hover:bg-orange-500/10 border-border"
            )}
            title="좌:사용(잔여 -1, +오드40) / 우:반환(잔여 +1)"
          >상점</button>
          <span className={cn("tabular-nums font-bold", buy >= buyMax && "text-emerald-700 dark:text-emerald-300")}>
            {Math.max(0, buyMax - buy)}/{buyMax}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  회랑 박스 — 하층 / 중층
// ─────────────────────────────────────────────────────────
export function CorridorBox({ char, onEdit }: { char: Character; onEdit?: () => void }) {
  const doCorridor = useBarrackStore((s) => s.doCorridor);
  const cr = char.corridor ?? { lower: 0, lowerMax: 3, middle: 0, middleMax: 3 };
  const allDone = cr.lower <= 0 && cr.middle <= 0;

  function btn(tier: "lower" | "middle") {
    return {
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); doCorridor(char.id, tier, -1); },
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); doCorridor(char.id, tier, +1); },
    };
  }

  return (
    <div className={cn("rounded border border-emerald-500/30 flex flex-col overflow-hidden", allDone && "opacity-40")}>
      <div className="flex items-center justify-center gap-1 px-1.5 py-1 text-xs font-extrabold border-b border-emerald-500/50 bg-emerald-500/30 text-emerald-700 dark:text-emerald-300">
        <span className="text-sm">🏛</span>
        <button
          className="truncate hover:underline"
          onClick={(e) => { e.stopPropagation(); onEdit?.(); }}
          title="회랑 결과 입력"
        >
          회랑
        </button>
      </div>
      <div className="flex-1 px-1.5 py-1.5 flex flex-col items-center justify-center gap-1.5 text-xs">
        <div className="flex items-center justify-center gap-1.5">
          <button
            {...btn("lower")}
            className={cn(
              "text-xs font-bold px-2.5 py-1 rounded border transition-colors min-w-[44px]",
              cr.lower <= 0 ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-700 dark:text-emerald-300" : "bg-card hover:bg-emerald-500/10 border-border"
            )}
            title="좌:-1 / 우:+1"
          >하층</button>
          <span className={cn("tabular-nums font-bold", cr.lower <= 0 && "text-emerald-700 dark:text-emerald-300")}>
            {cr.lower}/{cr.lowerMax}
          </span>
        </div>
        <div className="flex items-center justify-center gap-1.5">
          <button
            {...btn("middle")}
            className={cn(
              "text-xs font-bold px-2.5 py-1 rounded border transition-colors min-w-[44px]",
              cr.middle <= 0 ? "bg-emerald-500/30 border-emerald-500/50 text-emerald-700 dark:text-emerald-300" : "bg-card hover:bg-emerald-500/10 border-border"
            )}
            title="좌:-1 / 우:+1"
          >중층</button>
          <span className={cn("tabular-nums font-bold", cr.middle <= 0 && "text-emerald-700 dark:text-emerald-300")}>
            {cr.middle}/{cr.middleMax}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  악몽 박스 — 7+7 dots
// ─────────────────────────────────────────────────────────
export function NightmareBox({ char }: { char: Character }) {
  const doNightmare = useBarrackStore((s) => s.doNightmare);
  const db = useBarrackStore((s) => s.dbSettings);
  const tk = char.nightmare?.tickets ?? 0;
  const tkEx = char.nightmare?.ticketsExtra ?? 0;
  const max = db.nightmare?.maxTickets ?? 14;
  const allDone = (tk + tkEx) <= 0;
  const dailyGain = db.nightmare?.dailyGain ?? 2;

  const dotRow = (start: number, cnt: number) =>
    Array.from({ length: cnt }, (_, i) => {
      const filled = (start + i) < tk;
      return (
        <div
          key={start + i}
          className={cn("w-2 h-2 rounded-full transition-colors", filled ? "bg-cat-party" : "bg-muted")}
        />
      );
    });

  return (
    <div
      className={cn("rounded border border-cat-party/30 flex flex-col overflow-hidden cursor-pointer transition-colors hover:bg-cat-party/5", allDone && "opacity-40")}
      onClick={(e) => { e.stopPropagation(); doNightmare(char.id, -1); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); doNightmare(char.id, +1); }}
      title={`좌:소모 / 우:반환 (일일 +${dailyGain})`}
    >
      <div className="flex items-center justify-center gap-1 px-1.5 py-1 text-xs font-extrabold border-b border-cat-party/50 bg-cat-party/30 text-cat-party">
        <span className="text-sm">👁</span>
        <span className="truncate">악몽</span>
      </div>
      <div className="flex-1 px-1.5 py-2 flex flex-col items-center justify-center gap-1.5">
        <div className="text-lg font-extrabold tabular-nums leading-none">
          <span className="text-cat-party">{tk}</span>
          <span className="text-muted-foreground text-sm">/{max}</span>
          {xbadge(tkEx)}
        </div>
        <div className="flex gap-0.5">{dotRow(0, 7)}</div>
        <div className="flex gap-0.5">{dotRow(7, 7)}</div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────
//  각성전 박스 — dots
// ─────────────────────────────────────────────────────────
export function AwakeningBox({ char }: { char: Character }) {
  const doAwakening = useBarrackStore((s) => s.doAwakening);
  const db = useBarrackStore((s) => s.dbSettings);
  const tk = char.awakening?.tickets ?? 0;
  const tkEx = char.awakening?.ticketsExtra ?? 0;
  const max = db.awakening?.weeklyTickets ?? 3;
  const allDone = (tk + tkEx) <= 0;

  const dots = Array.from({ length: max }, (_, i) => {
    const used = i < (max - tk);
    return (
      <div key={i} className={cn("w-2 h-2 rounded-full transition-colors", used ? "bg-muted" : "bg-cyan-400")} />
    );
  });

  return (
    <div
      className={cn("rounded border border-cyan-500/30 flex flex-col overflow-hidden cursor-pointer transition-colors hover:bg-cyan-500/5", allDone && "opacity-40")}
      onClick={(e) => { e.stopPropagation(); doAwakening(char.id, -1); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); doAwakening(char.id, +1); }}
      title="좌:소모 / 우:반환"
    >
      <div className="flex items-center justify-center gap-1 px-1.5 py-1 text-xs font-extrabold border-b border-cyan-500/50 bg-cyan-500/30 text-cyan-700 dark:text-cyan-300">
        <span className="text-sm">💫</span>
        <span className="truncate">각성전</span>
      </div>
      <div className="flex-1 px-1.5 py-2 flex flex-col items-center justify-center gap-1.5">
        <div className="text-lg font-extrabold tabular-nums leading-none">
          <span className="text-cyan-700 dark:text-cyan-300">{tk}</span>
          <span className="text-muted-foreground text-sm">/{max}</span>
          {xbadge(tkEx)}
        </div>
        <div className="flex gap-1">{dots}</div>
      </div>
    </div>
  );
}
