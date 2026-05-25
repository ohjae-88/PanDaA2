"use client";

import { useEffect, useState } from "react";
import { subscribeSecondTick } from "@/lib/util/global-tick";
import { formatLogLine } from "@/lib/barrack/content-log";
import type { Character } from "@/lib/barrack/types";
import { cn } from "@/lib/utils";

/**
 * 배럭 오버레이 패널 leaf 셀 컴포넌트 모음.
 *
 * barrack-panel.tsx 1000 LOC 감소를 위해 의존성 적은 표시 전용 컴포넌트만 분리.
 * ContentBody / FourContentCards / CharCompactRow 는 store dep가 깊어 panel에 유지.
 */

/** 콘텐츠별 카드 컨테이너 — 아이콘 + 라벨 + 자식 */
export function ContentCard({ icon, label, children }: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded border border-border/60 bg-background/30 overflow-hidden">
      <div className="flex items-center gap-1 px-1.5 py-1 border-b border-border/40 bg-muted/20">
        <span className="text-sm">{icon}</span>
        <span className="text-[11px] font-extrabold text-foreground/90">{label}</span>
      </div>
      <div className="p-1 space-y-1">
        {children}
      </div>
    </div>
  );
}

/** 카드 내부 sub-action — 좌클릭 -1 / 우클릭 +1.
 *  잔여/최대 표기, done 시 emerald 강조. */
export function SubAction({
  label, value, max, extra = 0, done, onConsume, onReturn,
}: {
  label: string;
  value: number;
  max: number;
  extra?: number;
  done: boolean;
  onConsume: () => void;
  onReturn: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onConsume(); }}
      onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onReturn(); }}
      className={cn(
        "w-full flex items-center gap-1.5 px-1.5 py-1 rounded border text-left transition-colors",
        done
          ? "border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300"
          : "border-border/40 bg-card/40 hover:bg-accent/10"
      )}
      title="좌:사용(-1) / 우:반환(+1)"
    >
      <span className="text-[10px] text-muted-foreground flex-shrink-0">{label}</span>
      <span className="ml-auto font-extrabold tabular-nums" style={{ fontSize: "13px" }}>
        {value}/{max}
      </span>
      {extra > 0 && (
        <span className="font-bold tabular-nums text-emerald-400" style={{ fontSize: "10px" }}>
          +{extra}
        </span>
      )}
    </button>
  );
}

/** 통계 박스 (라벨 + 값 + 추가치) — 일반 톤 */
export function Stat({ label, value, extra, done }: {
  label: string;
  value: string;
  extra: number;
  done: boolean;
}) {
  return (
    <div className="rounded border border-border/40 bg-background/30 px-2 py-1.5 flex flex-col">
      <span className="text-[10px] text-muted-foreground">{label}</span>
      <span className={cn("font-extrabold tabular-nums", done && "text-muted-foreground line-through")}>
        {value}{extra > 0 && <span className="text-[10px] text-gold-light ml-1">+{extra}</span>}
      </span>
    </div>
  );
}

/** 한 행 통계 카드 — 아이콘 + 잔여(기본/추가). 노란색(amber) 톤 통일 — 보상/보스 카드 */
export function StatRow({ icon, value, extra, done }: {
  icon: React.ReactNode;
  value: string;
  extra: number;
  done: boolean;
}) {
  return (
    <div className="rounded border border-amber-400/50 bg-amber-400/10 px-2 py-1 flex items-center gap-2">
      <span className="text-amber-400 flex-shrink-0">{icon}</span>
      <span className={cn("ml-auto font-extrabold tabular-nums text-amber-200", done && "text-muted-foreground line-through")}
            style={{ fontSize: "13px" }}>
        {value}
      </span>
      {extra > 0 && (
        <span className="font-extrabold tabular-nums text-amber-100" style={{ fontSize: "12px" }}>
          [+{extra}]
        </span>
      )}
    </div>
  );
}

/** 액션 버튼 — 아이콘 + 라벨 + 서브 텍스트. accent="green" 시 emerald 톤. */
export function ActionBtn({ icon, label, sub, accent, onClick, onContextMenu }: {
  icon?: React.ReactNode;
  label: string;
  sub?: string;
  accent?: "green";
  onClick: (e: React.MouseEvent) => void;
  onContextMenu?: (e: React.MouseEvent) => void;
}) {
  const cls = accent === "green"
    ? "border-emerald-500/60 bg-emerald-500/15 hover:bg-emerald-500/30 hover:border-emerald-400 text-emerald-300"
    : "border-border/50 bg-background/30 hover:bg-cat-barrack/20 hover:border-cat-barrack/60";
  return (
    <button
      onClick={onClick}
      onContextMenu={onContextMenu}
      className={cn(
        "px-2 py-1.5 rounded border transition-colors text-center flex flex-col items-center justify-center gap-0.5",
        cls
      )}
    >
      <div className="flex items-center gap-1 font-bold text-xs">
        {icon}
        <span>{label}</span>
      </div>
      {sub && <div className="text-[9px] text-muted-foreground">{sub}</div>}
    </button>
  );
}

/** 빈 상태 표시 */
export function Empty() {
  return (
    <div className="text-center text-[11px] text-muted-foreground italic py-4">
      — 표시할 데이터 없음 —
    </div>
  );
}

/** 최근 콘텐츠 변경 1건 박스 — 매초 tick으로 경과 시간 자동 갱신. */
export function RecentLogRow({ char }: { char: Character }) {
  const [, setTick] = useState(0);
  useEffect(() => subscribeSecondTick(() => setTick((t) => t + 1)), []);
  const log = (char.contentChangeLog ?? [])[0];
  if (!log) {
    return (
      <div className="rounded border border-border/40 bg-background/20 px-2 py-2 flex items-center justify-center text-[10px] text-muted-foreground italic">
        — 최근 변경 기록 없음 —
      </div>
    );
  }
  const text = formatLogLine(log, Date.now());
  return (
    <div
      className="rounded border border-cat-barrack/40 bg-background/30 px-2 py-2 flex items-center justify-center"
      title={text}
    >
      <span className="text-[11px] font-bold tabular-nums truncate text-foreground/90">
        {text}
      </span>
    </div>
  );
}
