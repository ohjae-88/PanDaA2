"use client";

import { useMemo } from "react";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useSetStore } from "@/lib/arcana/set-store";
import { STAT_LABEL } from "@/lib/arcana/constants";
import {
  computeEquipSkillTotals,
  computeSetEffects,
  computeSetStats,
  computeStats,
} from "@/lib/arcana/compute";
import type { ArcanaBuild } from "@/lib/arcana/types";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { cn } from "@/lib/utils";

/** V4.0.9 renderStats + computeSetEffects + set effect 표시 통합 */
export function StatsPanel({ build }: { build: ArcanaBuild }) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  const sets = useSetStore((s) => s.sets);
  const toggleSetCond = useArcanaBuildStore((s) => s.toggleSetCondEffect);
  // V4 동등: build를 store에서 직접 selector — props build의 stale 가능성 차단.
  // 카드 레벨/분배 변경 시 store 갱신 → liveBuild 새 객체 → 모든 useMemo 재계산.
  const liveBuild = useArcanaBuildStore((s) => s.builds.find((b) => b.id === build.id)) || build;

  const { bySet, activeTiers } = useMemo(
    () => computeSetEffects(liveBuild, arcana, owned, sets),
    [liveBuild, arcana, owned, sets]
  );

  const setStats = useMemo(
    () => computeSetStats(activeTiers, liveBuild.activeSetCondEffects || []),
    [activeTiers, liveBuild.activeSetCondEffects]
  );

  void computeEquipSkillTotals; // 미사용 경고 회피 (장비 스킬 stats는 향후 확장)

  const cardStats = useMemo(
    () => computeStats(liveBuild, arcana, owned),
    [liveBuild, arcana, owned]
  );

  const totals = useMemo(() => {
    const out: Record<string, number> = { ...cardStats };
    for (const [k, v] of Object.entries(setStats)) out[k] = (out[k] || 0) + v;
    return out;
  }, [cardStats, setStats]);

  // 합산 능력치 — 아르카나 전용 스텟만 표기 (시간/생명/자유/정의/환상/공간/운명/죽음/파괴/지혜)
  const ARCANA_STAT_KEYS = ["time", "life", "freedom", "justice", "illusion", "space", "fate", "death", "destruction", "wisdom"];
  const totalEntries = Object.entries(totals)
    .filter(([k, v]) => v !== 0 && ARCANA_STAT_KEYS.includes(k));
  totalEntries.sort(([a], [b]) =>
    ARCANA_STAT_KEYS.indexOf(a) - ARCANA_STAT_KEYS.indexOf(b)
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-[minmax(180px,1fr)_3fr] gap-3">
      {/* 합산 능력치 */}
      <div className="rounded-lg border bg-card p-3">
        <div className="text-xs font-extrabold text-muted-foreground mb-2">📈 합산 능력치</div>
        {totalEntries.length === 0 ? (
          <div className="text-xs text-muted-foreground italic">장착한 카드가 없습니다.</div>
        ) : (
          <div className="flex flex-col gap-1 text-xs">
            {totalEntries.map(([k, v]) => (
              <div
                key={k}
                className="flex items-center justify-between gap-2 px-2 py-1 rounded border bg-background/40"
                title={`카드: +${cardStats[k] || 0} · 세트: +${setStats[k] || 0}`}
              >
                <span className="text-muted-foreground truncate">{STAT_LABEL[k] || k}</span>
                <span className="font-extrabold text-cat-arcana tabular-nums">+{v}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 활성 세트 효과 */}
      <div className="rounded-lg border bg-card p-3 space-y-2">
        <div className="text-xs font-extrabold text-muted-foreground">✨ 세트 효과</div>
        {/* setKey별 카드 개수 */}
        <div className="flex flex-wrap gap-1">
          {Object.entries(bySet).map(([k, n]) => (
            <span key={k} className="px-1.5 py-0.5 rounded border border-cat-arcana/30 bg-cat-arcana/5 text-[10px] text-cat-arcana">
              {k} × {n}
            </span>
          ))}
          {Object.keys(bySet).length === 0 && (
            <span className="text-[11px] text-muted-foreground italic">카드 미배치</span>
          )}
        </div>

        {activeTiers.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic">장착된 세트 카드가 없습니다.</div>
        ) : (
          <div className="space-y-1.5">
            {activeTiers.map((a, ai) => (
              <div key={ai} className="rounded border border-cat-arcana/40 bg-cat-arcana/5 p-2">
                <div className="text-xs font-bold text-cat-arcana mb-1">
                  {a.setMaster.name} ({a.tier} 세트)
                </div>
                <div className="space-y-0.5">
                  {a.effects.map((eff, i) => {
                    const key = `${a.setMaster.id}_${a.tier}_${i}`;
                    const isCondEffect = !!(eff.cond || eff.cooldownSec);
                    const active = !isCondEffect || (liveBuild.activeSetCondEffects || []).includes(key);
                    return (
                      <button
                        key={i}
                        onClick={() => isCondEffect && toggleSetCond(liveBuild.id, key)}
                        disabled={!isCondEffect}
                        className={cn(
                          "w-full text-left text-[11px] px-2 py-1 rounded border",
                          isCondEffect
                            ? active
                              ? "border-emerald-500/50 bg-emerald-500/10 text-foreground"
                              : "border-border bg-muted/20 text-muted-foreground hover:bg-accent/10"
                            : "border-border bg-background/40 text-foreground"
                        )}
                        title={isCondEffect ? "클릭하여 조건부 효과 활성/비활성 토글" : ""}
                      >
                        {isCondEffect && (
                          <span className="font-bold mr-1">{active ? "✓" : "○"}</span>
                        )}
                        {eff.text}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
