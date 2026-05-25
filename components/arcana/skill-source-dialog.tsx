"use client";

import { useMemo } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  ARCANA_KO,
  ARCANA_ORDER,
  SET_BY_CODE,
  SKILL_CAT_KO,
  SPECIAL_EFFECT_LEVELS,
  equipSlotLabel,
} from "@/lib/arcana/constants";
import { resolveSlotCard } from "@/lib/arcana/compute";
import type { ArcanaBuild } from "@/lib/arcana/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  build: ArcanaBuild | null;
  jobId: string;
  skillId: string | null;
  onClose: () => void;
};

/** V4.0.9 openSkillSourceModal 포팅 — 단일 스킬의 출처 분해.
 *  - 좌: 기본/데바 / 카드 슬롯별 기여 / 장비 슬롯 기여
 *  - 우: 특화 효과 개방 상태 (총 레벨 기준) */
export function SkillSourceDialog({ open, build, jobId, skillId, onClose }: Props) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  const skills = useSkillStore((s) => s.skills);

  const sk = skillId ? skills.find((x) => x.id === skillId) ?? null : null;

  const breakdown = useMemo(() => {
    if (!sk) return null;
    const baseN = sk.baseLv?.base || 0;
    const daeN = sk.daevanion ? sk.baseLv?.daevanion || 0 : 0;
    const slots: Array<{ slotKey: string; label: string; amount: number; sub?: string; warn?: boolean; supported: boolean }> = [];
    const equips: Array<{ label: string; amount: number }> = [];
    let cardSum = 0;
    let equipSum = 0;
    if (build) {
      for (const slotKey of ARCANA_ORDER) {
        const entry = build.slots[slotKey];
        const r = resolveSlotCard(entry, arcana, owned);
        if (!r.master) {
          slots.push({ slotKey, label: ARCANA_KO[slotKey] || slotKey, amount: 0, sub: "(빈 슬롯)", supported: false });
          continue;
        }
        const m = r.master;
        const cardOpts = m.skillsByJob?.[jobId] || [];
        const supported = cardOpts.includes(sk.id);
        if (!supported) continue;
        void cardOpts;
        const enabled = r.enabledSkills.includes(sk.id);
        const extra = r.gains?.skills?.[sk.id] || 0;
        // 옵션 활성된 스킬만 합산. 비활성은 표기만 (분배 잔존 무시).
        const amt = enabled ? 1 + extra : 0;
        cardSum += amt;
        const setName = SET_BY_CODE[m.setKey]?.name || "";
        const cardName = `${setName} ${ARCANA_KO[m.slot] || m.slot} Lv.${r.level || 0}`;
        const sub = enabled
          ? extra > 0 ? `옵션 +1 · 추가 +${extra}` : "옵션 +1"
          : "(옵션 비활성 — 합산 제외)";
        slots.push({
          slotKey,
          label: `${ARCANA_KO[slotKey] || slotKey} — ${cardName}`,
          amount: amt,
          sub,
          warn: !enabled,
          supported: true,
        });
      }
      for (const es of build.equipSlots) {
        const v = es.skills?.[sk.id] || 0;
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
  }, [sk, build, arcana, owned, jobId]);

  if (!sk || !breakdown) {
    return (
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>스킬 출처</DialogTitle></DialogHeader>
          <div className="text-xs text-muted-foreground italic">스킬을 찾을 수 없습니다.</div>
          <DialogFooter><Button onClick={onClose}>닫기</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  const effLevels = SPECIAL_EFFECT_LEVELS[sk.category] ?? [];

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {sk.icon && (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={sk.icon} alt="" className="w-6 h-6 rounded" loading="lazy" />
            )}
            <span>{sk.name}</span>
            <span className="text-xs text-muted-foreground font-normal">· {SKILL_CAT_KO[sk.category]}</span>
          </DialogTitle>
        </DialogHeader>

        {/* 합계 헤더 */}
        <div className="flex items-center justify-between gap-2 rounded border border-cat-arcana/40 bg-cat-arcana/10 px-3 py-2">
          <span className="text-sm font-bold text-muted-foreground">총 레벨</span>
          <span className="text-2xl font-extrabold text-cat-arcana tabular-nums">{breakdown.total}</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 flex-1 min-h-0 overflow-auto">
          {/* 좌: 출처 */}
          <div className="space-y-3">
            <Section title="📘 기본 / 데바">
              <Row label="기본 레벨" amount={breakdown.baseN} />
              <Row label="데바니온" amount={breakdown.daeN} />
            </Section>

            <Section title="🎴 카드 슬롯">
              {breakdown.slots.length === 0 ? (
                <div className="text-xs text-muted-foreground italic px-2 py-1">슬롯 정보 없음</div>
              ) : breakdown.slots.filter((s) => s.supported || s.amount > 0).length === 0 ? (
                <div className="text-xs text-muted-foreground italic px-2 py-1">
                  어떤 슬롯에서도 이 스킬에 포인트가 적용되지 않았습니다.
                </div>
              ) : (
                breakdown.slots
                  .filter((s) => s.supported || s.amount > 0)
                  .map((s) => (
                    <Row key={s.slotKey} label={s.label} amount={s.amount} sub={s.sub} warn={s.warn} />
                  ))
              )}
            </Section>

            <Section title="🛡 장비 스킬 포인트">
              {breakdown.equips.length === 0 ? (
                <Row label="장비 조율" amount={0} warn />
              ) : (
                breakdown.equips.map((e, i) => <Row key={i} label={e.label} amount={e.amount} />)
              )}
            </Section>
          </div>

          {/* 우: 특화 효과 */}
          <div className="space-y-3">
            <Section title="✨ 특화 효과">
              {effLevels.length === 0 ? (
                <div className="text-xs text-muted-foreground italic px-2 py-1">
                  이 카테고리에는 특화 효과가 없습니다.
                </div>
              ) : (
                effLevels.map((lv) => {
                  const reached = breakdown.total >= lv;
                  const effs = (sk.specialEffects || []).filter((e) => e.level === lv);
                  return (
                    <div
                      key={lv}
                      className={cn(
                        "rounded border p-2",
                        reached
                          ? "border-cat-arcana/50 bg-cat-arcana/5"
                          : "border-border bg-muted/20 opacity-70"
                      )}
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="px-1.5 py-0.5 rounded bg-cat-arcana/20 text-cat-arcana text-[10px] font-extrabold tabular-nums">
                          Lv.{lv}
                        </span>
                        <span className={cn("text-[11px] font-bold", reached ? "text-cat-arcana" : "text-muted-foreground")}>
                          {reached ? "개방" : `잠금 (현재 ${breakdown.total}/${lv})`}
                        </span>
                      </div>
                      {effs.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground italic">(등록된 효과 없음)</div>
                      ) : (
                        <div className="space-y-0.5">
                          {effs.map((e, i) => (
                            <div key={i} className="text-[11px]">
                              <span className="text-muted-foreground font-bold mr-1">{i + 1}.</span>
                              <span>{e.text}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </Section>
          </div>
        </div>

        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded border bg-card/40 p-2 space-y-1">
      <div className="text-[10px] font-extrabold text-muted-foreground">{title}</div>
      <div className="space-y-0.5">{children}</div>
    </div>
  );
}

function Row({ label, amount, sub, warn }: { label: string; amount: number; sub?: string; warn?: boolean }) {
  const applied = amount > 0;
  return (
    <div
      className={cn(
        "flex items-center gap-2 px-2 py-1 rounded text-xs",
        applied
          ? "bg-cat-arcana/10 text-foreground"
          : warn
          ? "bg-amber-500/5 text-muted-foreground"
          : "bg-background/30 text-muted-foreground opacity-70"
      )}
    >
      <span className="flex-1 truncate">{label}</span>
      {sub && <span className="text-[10px] text-muted-foreground">{sub}</span>}
      <b className={cn("tabular-nums", applied ? "text-cat-arcana" : "")}>
        {applied ? `+${amount}` : "0"}
      </b>
    </div>
  );
}
