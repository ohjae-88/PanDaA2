"use client";

import { useMemo } from "react";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import {
  ARCANA_KO,
  ARCANA_ORDER,
  SET_BY_CODE,
  SKILL_CAT_KO,
  SPECIAL_EFFECT_LEVELS,
  equipSlotLabel,
} from "@/lib/arcana/constants";
import { resolveSlotCard } from "@/lib/arcana/compute";
import type { ArcanaBuild, Skill } from "@/lib/arcana/types";
import { cn } from "@/lib/utils";

/** SkillSourceDialog와 동일 내용을 hover 시 작게 표시.
 *  Radix TooltipContent 안에 마운트 — 좌(출처) + 우(특화 효과). */
export function SkillHoverTooltip({
  skill,
  build,
  jobId,
}: {
  skill: Skill;
  build: ArcanaBuild | null;
  jobId: string;
}) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);

  const breakdown = useMemo(() => {
    const baseN = skill.baseLv?.base || 0;
    const daeN = skill.daevanion ? skill.baseLv?.daevanion || 0 : 0;
    const slots: Array<{ label: string; amount: number; sub?: string; warn?: boolean }> = [];
    const equips: Array<{ label: string; amount: number }> = [];
    let cardSum = 0;
    let equipSum = 0;
    if (build) {
      for (const slotKey of ARCANA_ORDER) {
        const entry = build.slots[slotKey];
        const r = resolveSlotCard(entry, arcana, owned);
        if (!r.master) continue;
        const m = r.master;
        const cardOpts = m.skillsByJob?.[jobId] || [];
        const supported = cardOpts.includes(skill.id);
        if (!supported) continue;
        // 옵션 활성된 스킬만 합산
        if (!r.enabledSkills.includes(skill.id)) continue;
        const extra = r.gains?.skills?.[skill.id] || 0;
        const amt = 1 + extra; // 옵션 +1 + 분배
        cardSum += amt;
        const setName = SET_BY_CODE[m.setKey]?.name || "";
        slots.push({
          label: `${ARCANA_KO[slotKey] || slotKey} · ${setName}`,
          amount: amt,
          sub: extra > 0 ? `옵션+1 · 분배+${extra}` : "옵션+1",
        });
      }
      for (const es of build.equipSlots) {
        const v = es.skills?.[skill.id] || 0;
        if (v > 0) {
          equipSum += v;
          equips.push({ label: equipSlotLabel(es), amount: v });
        }
      }
    }
    return {
      baseN, daeN, cardSum, equipSum,
      total: baseN + daeN + cardSum + equipSum,
      slots, equips,
    };
  }, [skill, build, arcana, owned, jobId]);

  const effLevels = SPECIAL_EFFECT_LEVELS[skill.category] ?? [];

  return (
    <div className="text-xs space-y-1.5 max-w-[420px]">
      {/* 헤더 */}
      <div className="flex items-center gap-2 pb-1 border-b">
        {skill.icon && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={skill.icon} alt="" className="w-5 h-5 rounded" loading="lazy" />
        )}
        <span className="font-extrabold text-sm">{skill.name}</span>
        <span className="text-[10px] text-muted-foreground">{SKILL_CAT_KO[skill.category]}</span>
        {/* 스티그마(Dp)는 Lv 표기 제외 */}
        {skill.category !== "Dp" && (
          <span className="ml-auto font-extrabold tabular-nums text-cat-arcana text-sm">
            Lv.{breakdown.total}
          </span>
        )}
      </div>

      {/* 출처 분해 */}
      <div className="space-y-0.5 text-[11px]">
        <RowMini label="기본 + 데바" amount={breakdown.baseN + breakdown.daeN} />
        {breakdown.slots.length > 0 && breakdown.slots.map((s, i) => (
          <RowMini key={i} label={`🎴 ${s.label}`} amount={s.amount} sub={s.sub} warn={s.warn} />
        ))}
        {breakdown.equips.length > 0 && breakdown.equips.map((e, i) => (
          <RowMini key={i} label={`🛡 ${e.label}`} amount={e.amount} />
        ))}
        {breakdown.cardSum === 0 && breakdown.equipSum === 0 && (
          <div className="text-[10px] text-muted-foreground italic">카드/장비 분배 없음</div>
        )}
      </div>

      {/* 특화 효과 */}
      {effLevels.length > 0 && (
        <div className="border-t pt-1 space-y-0.5">
          <div className="text-[10px] font-bold text-muted-foreground">✨ 특화 효과</div>
          {effLevels.map((lv) => {
            const reached = breakdown.total >= lv;
            const effs = (skill.specialEffects || []).filter((e) => e.level === lv);
            return (
              <div
                key={lv}
                className={cn(
                  "rounded px-1.5 py-1 text-[12px]",
                  reached ? "bg-cat-arcana/10 text-foreground" : "bg-muted/20 text-muted-foreground opacity-70"
                )}
              >
                <div className="flex items-start gap-1.5">
                  <span className="font-extrabold tabular-nums">Lv.{lv}</span>
                  <span className="flex-shrink-0">{reached ? "✓" : "○"}</span>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {effs.length === 0 ? (
                      <span className="italic opacity-60">(없음)</span>
                    ) : (
                      effs.map((e, i) => (
                        <div key={i} className="leading-snug">
                          {effs.length > 1 && <span className="text-muted-foreground/70 mr-1">·</span>}
                          {e.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RowMini({ label, amount, sub, warn }: { label: string; amount: number; sub?: string; warn?: boolean }) {
  const applied = amount > 0;
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-1.5 py-0.5 rounded",
        applied ? "bg-cat-arcana/8" : "bg-background/30",
        warn && "text-amber-500"
      )}
    >
      <span className="flex-1 truncate">{label}</span>
      {sub && <span className="text-[9px] text-muted-foreground">{sub}</span>}
      <b className={cn("tabular-nums", applied && "text-cat-arcana")}>{applied ? `+${amount}` : "0"}</b>
    </div>
  );
}
