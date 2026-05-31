"use client";

import { useMemo } from "react";
import { useBarrackStore } from "@/lib/barrack/store";
import { RAID_NAME_KO } from "@/lib/barrack/content-log";
import type { ContentChangeLog, RaidType } from "@/lib/barrack/types";

/**
 * 컨텐츠 진행 히스토리 차트 — SVG 막대형 그래프.
 *
 * x축: 최근 7일, 요일(월화수…) + 일자(DD).
 * y축: 정수, 5단위 주 그리드(라벨) + 1단위 보조 그리드(연한 선).
 * 4개 그룹막대: 원정/초월/루드라/바고트 (delta < 0 카운트).
 */

const RAIDS: { key: RaidType; color: string; name: string }[] = [
  { key: "expedition",      color: "#60a5fa", name: "원정"  },
  { key: "transcend",       color: "#fbbf24", name: "초월"  },
  { key: "sanctuary_ludra", color: "#a78bfa", name: "루드라" },
  { key: "sanctuary_bagot", color: "#34d399", name: "바고트" },
];

const KO_WD = ["일", "월", "화", "수", "목", "금", "토"];
const DAYS = 7;

const W = 600;
const H = 240;
const PAD_L = 40;  // y축 라벨 공간
const PAD_R = 12;
const PAD_T = 16;
const PAD_B = 44;  // 요일 + 일자
const BAR_N = RAIDS.length;          // 그룹당 막대 수
const GROUP_GAP = 10;                // 그룹 간격
const BAR_GAP = 2;                   // 막대 간격

function ymd(ts: number): string {
  const d = new Date(ts);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function last7Labels(): { ymd: string; wd: string; dd: string }[] {
  const out = [];
  const now = Date.now();
  for (let i = DAYS - 1; i >= 0; i--) {
    const t = now - i * 86_400_000;
    const d = new Date(t);
    out.push({
      ymd: ymd(t),
      wd: KO_WD[d.getDay()],
      dd: String(d.getDate()).padStart(2, "0"),
    });
  }
  return out;
}

function aggregate(logs: ContentChangeLog[], labels: string[]): Record<RaidType, number[]> {
  const idx = new Map(labels.map((l, i) => [l, i]));
  const series: Record<RaidType, number[]> = {
    expedition:      new Array(DAYS).fill(0),
    transcend:       new Array(DAYS).fill(0),
    sanctuary_ludra: new Array(DAYS).fill(0),
    sanctuary_bagot: new Array(DAYS).fill(0),
  };
  for (const l of logs) {
    if (l.delta >= 0) continue; // 환급 제외
    const i = idx.get(ymd(l.ts));
    if (i == null) continue;
    if (l.raidKey in series) series[l.raidKey][i] += 1;
  }
  return series;
}

export function ContentHistoryChart({ days: _days = 7 }: { days?: number }) {
  void _days; // 항상 7일 고정

  const characters = useBarrackStore((s) => s.characters);

  const { labels, series, yMax } = useMemo(() => {
    const labels = last7Labels();
    const allLogs: ContentChangeLog[] = [];
    for (const c of characters) {
      if (c.contentChangeLog) allLogs.push(...c.contentChangeLog);
    }
    const series = aggregate(allLogs, labels.map((l) => l.ymd));
    const max = Math.max(0, ...Object.values(series).flatMap((a) => a));
    // yMax: 최솟값 5, 5 단위 올림
    const yMax = max <= 0 ? 5 : Math.ceil(max / 5) * 5;
    return { labels, series, yMax };
  }, [characters]);

  const innerW = W - PAD_L - PAD_R;
  const innerH = H - PAD_T - PAD_B;
  const groupW = innerW / DAYS;
  const barAreaW = groupW - GROUP_GAP;
  const barW = Math.max(2, (barAreaW - (BAR_N - 1) * BAR_GAP) / BAR_N);

  // y → SVG y 좌표
  const sy = (v: number) => PAD_T + innerH - (v / yMax) * innerH;

  // y축 주 그리드 (5단위)
  const majorTicks = Array.from({ length: yMax / 5 + 1 }, (_, i) => i * 5);
  // y축 보조 그리드 (1단위, 주 그리드 제외)
  const minorTicks = Array.from({ length: yMax + 1 }, (_, i) => i).filter((v) => v % 5 !== 0);

  return (
    <div className="rounded border border-border bg-card p-3">
      <div className="mb-2 flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold">📊 컨텐츠 진행 히스토리 (최근 7일)</h3>
        <div className="flex gap-3 text-xs">
          {RAIDS.map((r) => (
            <div key={r.key} className="flex items-center gap-1">
              <span className="inline-block h-2.5 w-3.5 rounded-sm" style={{ background: r.color }} />
              <span className="text-muted-foreground">{r.name}</span>
            </div>
          ))}
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" preserveAspectRatio="xMidYMid meet">
        {/* ── 보조 그리드 (1단위, 연한) */}
        {minorTicks.map((v) => {
          const y = sy(v);
          if (y < PAD_T || y > PAD_T + innerH + 0.5) return null;
          return (
            <line
              key={`minor-${v}`}
              x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
              stroke="currentColor" strokeOpacity={0.06} strokeWidth={0.5}
            />
          );
        })}

        {/* ── 주 그리드 (5단위) + y축 라벨 */}
        {majorTicks.map((v) => {
          const y = sy(v);
          return (
            <g key={`major-${v}`}>
              <line
                x1={PAD_L} y1={y} x2={W - PAD_R} y2={y}
                stroke="currentColor" strokeOpacity={0.18} strokeWidth={0.8}
              />
              <text
                x={PAD_L - 5} y={y + 3.5}
                textAnchor="end" fontSize={9}
                fill="currentColor" opacity={0.6}
              >
                {v}
              </text>
            </g>
          );
        })}

        {/* ── 막대 + x축 라벨 */}
        {labels.map(({ wd, dd }, gi) => {
          const gx = PAD_L + gi * groupW + GROUP_GAP / 2;
          const cx = gx + barAreaW / 2;
          return (
            <g key={`g-${gi}`}>
              {/* 그룹 막대 4개 */}
              {RAIDS.map((r, bi) => {
                const v = series[r.key][gi];
                const bx = gx + bi * (barW + BAR_GAP);
                const bh = (v / yMax) * innerH;
                const by = sy(v);
                return (
                  <g key={r.key}>
                    {v > 0 && (
                      <rect
                        x={bx} y={by}
                        width={barW} height={bh}
                        fill={r.color} fillOpacity={0.85}
                        rx={1}
                      />
                    )}
                    {/* 값 라벨 (막대 위, 1 이상) */}
                    {v >= 1 && bh > 10 && (
                      <text
                        x={bx + barW / 2} y={by - 2}
                        textAnchor="middle" fontSize={8}
                        fill={r.color} opacity={0.9}
                      >
                        {v}
                      </text>
                    )}
                  </g>
                );
              })}
              {/* x축 요일 */}
              <text x={cx} y={PAD_T + innerH + 14} textAnchor="middle" fontSize={11} fontWeight="bold" fill="currentColor" opacity={0.8}>
                {wd}
              </text>
              {/* x축 일자 */}
              <text x={cx} y={PAD_T + innerH + 28} textAnchor="middle" fontSize={9} fill="currentColor" opacity={0.5}>
                {dd}
              </text>
            </g>
          );
        })}

        {/* x축 베이스라인 */}
        <line
          x1={PAD_L} y1={PAD_T + innerH}
          x2={W - PAD_R} y2={PAD_T + innerH}
          stroke="currentColor" strokeOpacity={0.2}
        />
      </svg>

      <p className="mt-1 text-[10px] text-muted-foreground">
        * 캐릭터별 최근 50개 로그 통합. 환급 제외, 1회 진행 = 1카운트.
      </p>
    </div>
  );
}
