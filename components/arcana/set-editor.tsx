"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSetStore } from "@/lib/arcana/set-store";
import { STAT_LABEL } from "@/lib/arcana/constants";
import type { SetEffect, ArcanaSetMaster } from "@/lib/arcana/types";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/util/confirm";

/** V4.0.9 renderSetEditor 포팅 — 7세트별 tier 2/4 효과 편집기 */
export function SetEditor() {
  const sets = useSetStore((s) => s.sets);
  const resetSeed = useSetStore((s) => s.resetSeed);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 flex-wrap p-2 rounded border border-cat-arcana/30 bg-cat-arcana/5">
        <span className="text-xs text-muted-foreground">7세트 효과 — tier 2/4 별 효과 텍스트 + stats / cond / cooldown</span>
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            if (!(await confirmDialog({ title: "세트 DB 초기화", description: "세트 효과 DB를 시드 기본값으로 초기화합니다.", confirmText: "초기화", variant: "destructive" }))) return;
            resetSeed();
          }}
          className="text-amber-500 border border-amber-500/40"
        >
          시드 리셋
        </Button>
      </div>

      {sets.map((set) => (
        <SetCard key={set.id} set={set} />
      ))}
    </div>
  );
}

function SetCard({ set }: { set: ArcanaSetMaster }) {
  const [expanded, setExpanded] = useState(true);
  const totalEffects = set.tiers.reduce((n, t) => n + t.effects.length, 0);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-stretch gap-0 border-b border-cat-arcana/20">
        {/* 좌측 — 시즌 + 세트명 (V4 동등) */}
        <div className="flex items-center gap-2 px-3 py-3 bg-cat-arcana/15 min-w-[140px]">
          <span className="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cat-arcana/30 text-cat-arcana tabular-nums">
            {set.season}
          </span>
          <span className="text-base font-extrabold">{set.name}</span>
        </div>

        {/* 우측 — 효과 요약 (한 줄씩) */}
        <div className="flex-1 flex flex-col bg-cat-arcana/5">
          {set.tiers.flatMap((t) =>
            t.effects.map((eff, ei) => (
              <div
                key={`${t.n}_${ei}`}
                className="flex items-start gap-2 px-3 py-1.5 border-b last:border-b-0 border-cat-arcana/10"
              >
                <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-cat-arcana/20 text-cat-arcana tabular-nums shrink-0">
                  {t.n}세트
                </span>
                <span className="text-xs flex-1 leading-snug">{eff.text || <span className="text-muted-foreground italic">(빈 효과)</span>}</span>
              </div>
            ))
          )}
          {totalEffects === 0 && (
            <div className="px-3 py-2 text-[11px] text-muted-foreground italic">효과 없음 — 아래에서 추가하세요</div>
          )}
        </div>

        {/* 우측 액션 버튼들 */}
        <div className="flex flex-col gap-1 px-2 py-2 bg-cat-arcana/5 justify-center">
          <Button size="xs" variant="ghost" onClick={() => setExpanded((v) => !v)} className="border border-border text-[11px]">
            {expanded ? "▲ 접기" : "▼ 펼치기"}
          </Button>
        </div>
      </div>

      {expanded && (
        <div className="p-2 space-y-3">
          {set.tiers.map((tier) => (
            <TierBlock key={`${set.id}_${tier.n}`} set={set} tierN={tier.n} effects={tier.effects} />
          ))}
        </div>
      )}
    </div>
  );
}

function TierBlock({
  set,
  tierN,
  effects,
}: {
  set: ArcanaSetMaster;
  tierN: number;
  effects: SetEffect[];
}) {
  const setTierEffects = useSetStore((s) => s.setTierEffects);

  function update(idx: number, patch: Partial<SetEffect>) {
    const next = effects.map((e, i) => (i === idx ? { ...e, ...patch } : e));
    setTierEffects(set.id, tierN, next);
  }
  function addEffect() {
    setTierEffects(set.id, tierN, [...effects, { text: "" }]);
  }
  function removeEffect(idx: number) {
    setTierEffects(set.id, tierN, effects.filter((_, i) => i !== idx));
  }

  return (
    <div className="rounded border bg-background/30 p-2 space-y-2">
      <div className="flex items-center gap-2">
        <span className="px-1.5 py-0.5 rounded bg-cat-arcana/15 text-cat-arcana text-xs font-extrabold">{tierN} 세트</span>
        <span className="flex-1" />
        <Button size="xs" variant="ghost" onClick={addEffect} className="border border-cat-arcana/40 text-cat-arcana">
          <Plus className="h-3 w-3" /> 효과 추가
        </Button>
      </div>

      {effects.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic py-1">효과 없음</div>
      ) : (
        effects.map((eff, idx) => (
          <EffectRow
            key={idx}
            effect={eff}
            onChange={(patch) => update(idx, patch)}
            onRemove={() => removeEffect(idx)}
          />
        ))
      )}
    </div>
  );
}

function EffectRow({
  effect,
  onChange,
  onRemove,
}: {
  effect: SetEffect;
  onChange: (patch: Partial<SetEffect>) => void;
  onRemove: () => void;
}) {
  const statsKeys = Object.keys(effect.stats || {});
  const availableKeys = Object.keys(STAT_LABEL).filter((k) => !(k in (effect.stats || {})));

  function setStat(key: string, val: number) {
    onChange({ stats: { ...(effect.stats || {}), [key]: val } });
  }
  function removeStat(key: string) {
    const next = { ...(effect.stats || {}) };
    delete next[key];
    onChange({ stats: next });
  }
  function addStat(key: string) {
    if (!key) return;
    onChange({ stats: { ...(effect.stats || {}), [key]: 0 } });
  }

  return (
    <div className="rounded border p-2 space-y-1.5 bg-card/50">
      <div className="flex items-start gap-2">
        <textarea
          value={effect.text}
          onChange={(e) => onChange({ text: e.target.value })}
          placeholder="효과 설명 텍스트"
          className="flex-1 min-h-[40px] px-2 py-1 rounded border bg-background text-xs"
        />
        <Button size="xs" variant="ghost" onClick={onRemove} className="text-destructive" title="효과 제거">
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground w-12">조건</span>
          <Input
            value={effect.cond ?? ""}
            onChange={(e) => onChange({ cond: e.target.value })}
            placeholder="예: 생명력 70% 이상"
            className="h-7"
          />
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-muted-foreground w-12">쿨다운</span>
          <Input
            type="number"
            min={0}
            value={effect.cooldownSec ?? ""}
            onChange={(e) => {
              const v = parseInt(e.target.value);
              onChange({ cooldownSec: Number.isFinite(v) ? v : undefined });
            }}
            placeholder="초"
            className="h-7 w-24 tabular-nums"
          />
          <span className="text-[10px] text-muted-foreground">초</span>
        </div>
      </div>

      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[10px] text-muted-foreground">스텟:</span>
        {statsKeys.length === 0 && <span className="text-[10px] text-muted-foreground italic">없음</span>}
        {statsKeys.map((k) => (
          <div key={k} className={cn(
            "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-xs",
            "border-cat-arcana/30 bg-cat-arcana/5"
          )}>
            <span className="font-bold text-cat-arcana">{STAT_LABEL[k] || k}</span>
            <Input
              type="number"
              value={effect.stats?.[k] ?? 0}
              onChange={(e) => setStat(k, parseFloat(e.target.value) || 0)}
              className="h-6 w-16 px-1 tabular-nums"
            />
            <button onClick={() => removeStat(k)} className="text-muted-foreground hover:text-destructive">✕</button>
          </div>
        ))}
        <select
          value=""
          onChange={(e) => { addStat(e.target.value); e.target.value = ""; }}
          className="px-1 py-0.5 rounded border bg-background text-xs"
        >
          <option value="">＋ 스텟</option>
          {availableKeys.map((k) => <option key={k} value={k}>{STAT_LABEL[k] || k}</option>)}
        </select>
      </div>
    </div>
  );
}
