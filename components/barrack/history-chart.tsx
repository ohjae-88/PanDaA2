"use client";

import { useMemo } from "react";
import { useBarrackStore } from "@/lib/barrack/store";
import { RAID_NAME_KO } from "@/lib/barrack/content-log";
import type { ContentChangeLog, RaidType } from "@/lib/barrack/types";

/**
 * 컨텐츠 진행 히스토리 차트 — 의존성 없는 SVG 라인그래프.
 *
 * 데이터: 모든 캐릭터의 contentChangeLog (max 50/char) 통합 → 최근 N일 일별 컨텐츠 진행 횟수.
 * x축: 날짜, y축: 진행 수 (delta < 0 카운트, 환급 제외).
 * 4개 라인: 원정/초월/루드라/바고트.
 */

const RAIDS: { key: RaidType; color: string }[] = [
  { key: "expedition",      color: "#60a5fa" }, // blue-400
  { key: "transcend",       color: "#fbbf24" }, // amber-400
  { key: "sanctuary_ludra", color: "#a78bfa" }, // violet-400
  { key: "sanctuary_bagot", color: "#34d399" }, // emerald-400
];

const W = 640;
const H = 220;
const PAD_X = 36;
const PAD_Y = 24;

function ymd(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgoLabels(n: number): string[] {
  const out: string[] = [];
  const now = Date.now();
  for (let i = n - 1; i >= 0; i--) {
    const t = now - i * 86_400_000;
    out.push(ymd(t));
  }
  return out;
}

type Series = Record<RaidType, number[]>;

function aggregate(logs: ContentChangeLog[], days: number): { labels: string[]; series: Series } {
  const labels = daysAgoLabels(days);
  const idx = new Map(labels.map((l, i) => [l, i]));
  const series: Series = {
    expedition: new Array(days).fill(0),
    transcend: new Array(days).fill(0),
    sanctuary_ludra: new Array(days).fill(0),
    sanctuary_bagot: new Array(days).fill(0),
  };
  for (const l of logs) {
    // 진행만 카운트 — 환급(delta > 0) 제외, target=reward는 절반 가중치
    if (l.delta >= 0) continue;
    const day = ymd(l.ts);
    const i = idx.get(day);
    if (i == null) continue;
    const weight = l.target === "reward" ? 0.5 : 1;
    if (l.raidKey in series) {
      series[l.raidKey][i] += weight;
    }
  }
  return { labels, series };
}

export function ContentHistoryChart({ days = 14 }: { days?: number }) {
  const characters = useBarrackStore((s) => s.characters);

  const { labels, series, yMax } = useMemo(() => {
    const allLogs: ContentChangeLog[] = [];
    for (const c of characters) {
      if (c.contentChangeLog) allLogs.push(...c.contentChangeLog);
    }
    const { labels, series } = aggregate(allLogs, days);
    const max = Math.max(1, ...Object.values(series).flatMap((arr) => arr));
    return { labels, series, yMax: Math.ceil(max) };
  }, [characters, days]);

  const innerW = W - PAD_X * 2;
  const innerH = H - PAD_Y * 2;
  const stepX = labels.length > 1 ? innerW / (labels.length - 1) : 0;

  function ptPath(arr: number[]): string {
    return arr
      .map((v, i) => {
        const x = PAD_X + i * stepX;
        const y = PAD_Y + innerH - (v / yMax) * innerH;
        return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  }

  // x축 라벨 — 4개 정도만 표시 (혼잡 방지)
  const xTickStride = Math.max(1, Math.floor(labels.length / 5));

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-sm font-bold">📊 컨텐츠 진행 히스토리 (최근 {days}일)</h3>
        <div className="flex gap-3 text-xs">
          {RAIDS.map((r) => (
            <div key={r.key} className="flex items-center gap-1">
              <span className="inline-block h-2 w-3 rounded" style={{ background: r.color }} />
              <span className="text-muted-foreground">{RAID_NAME_KO[r.key]}</span>
            </div>
          ))}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* y축 그리드 */}
        {[0, 0.25, 0.5, 0.75, 1].map((p) => {
          const y = PAD_Y + innerH - p * innerH;
          const v = Math.round(p * yMax * 10) / 10;
          return (
            <g key={p}>
              <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="currentColor" strokeOpacity={0.1} />
              <text x={PAD_X - 4} y={y + 3} textAnchor="end" fontSize={10} fill="currentColor" opacity={0.6}>{v}</text>
            </g>
          );
        })}
        {/* x축 라벨 */}
        {labels.map((l, i) => {
          if (i % xTickStride !== 0 && i !== labels.length - 1) return null;
          const x = PAD_X + i * stepX;
          return (
            <text key={i} x={x} y={H - 6} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.6}>
              {l.slice(5)}
            </text>
          );
        })}
        {/* 라인 */}
        {RAIDS.map((r) => (
          <path
            key={r.key}
            d={ptPath(series[r.key])}
            fill="none"
            stroke={r.color}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ))}
        {/* 점 */}
        {RAIDS.map((r) =>
          series[r.key].map((v, i) => {
            const x = PAD_X + i * stepX;
            const y = PAD_Y + innerH - (v / yMax) * innerH;
            return v > 0 ? <circle key={`${r.key}-${i}`} cx={x} cy={y} r={2} fill={r.color} /> : null;
          })
        )}
      </svg>
      <p className="mt-2 text-xs text-muted-foreground">
        * 캐릭터별 최근 50개 로그 통합. 보상 단독 진행은 0.5회로 가중.
      </p>
    </div>
  );
}
