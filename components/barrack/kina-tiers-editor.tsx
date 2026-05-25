"use client";

import { Plus, Minus } from "lucide-react";

export type KinaTier = { threshold: number; rate: number };
export type KinaRates = { tiers: KinaTier[]; fallbackRate: number };

type Props = {
  value: KinaRates;
  onChange: (next: KinaRates) => void;
};

export function KinaTiersEditor({ value, onChange }: Props) {
  function setTier(idx: number, patch: Partial<KinaTier>) {
    onChange({
      ...value,
      tiers: value.tiers.map((t, i) => (i === idx ? { ...t, ...patch } : t)),
    });
  }
  function removeTier(idx: number) {
    onChange({ ...value, tiers: value.tiers.filter((_, i) => i !== idx) });
  }
  function addTier() {
    onChange({ ...value, tiers: [...value.tiers, { threshold: 1, rate: 0 }] });
  }

  return (
    <div className="space-y-2">
      <div className="space-y-1.5">
        {value.tiers.map((t, i) => (
          <div key={i} className="flex items-center gap-2 text-xs">
            <input
              type="number"
              min={1}
              value={t.threshold}
              onChange={(e) => setTier(i, { threshold: Number(e.target.value) || 1 })}
              className="w-20 h-7 px-2 border rounded bg-background tabular-nums"
              placeholder="횟수"
            />
            <span className="text-muted-foreground">회 이하</span>
            <input
              type="number"
              min={0}
              max={100}
              value={t.rate}
              onChange={(e) => setTier(i, { rate: Number(e.target.value) || 0 })}
              className="w-20 h-7 px-2 border rounded bg-background tabular-nums"
              placeholder="확률"
            />
            <span className="text-muted-foreground">% 획득</span>
            <button
              type="button"
              onClick={() => removeTier(i)}
              className="ml-auto inline-flex items-center justify-center w-6 h-6 rounded border bg-card hover:bg-rose-500/10 hover:text-rose-400 hover:border-rose-400/40"
              aria-label="삭제"
            >
              <Minus className="h-3 w-3" />
            </button>
          </div>
        ))}
        {value.tiers.length === 0 && (
          <div className="text-xs text-muted-foreground italic">구간 없음</div>
        )}
      </div>
      <div className="flex items-center gap-2 pt-2 border-t text-xs">
        <span className="font-bold text-muted-foreground">상한 초과시</span>
        <input
          type="number"
          min={0}
          max={100}
          value={value.fallbackRate ?? 20}
          onChange={(e) => onChange({ ...value, fallbackRate: Number(e.target.value) || 0 })}
          className="w-20 h-7 px-2 border rounded bg-background tabular-nums"
        />
        <span className="text-muted-foreground">%</span>
        <button
          type="button"
          onClick={addTier}
          className="ml-auto inline-flex items-center gap-1 px-2 h-7 text-xs font-bold rounded border bg-emerald-500/10 text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20"
        >
          <Plus className="h-3 w-3" /> 구간 추가
        </button>
      </div>
    </div>
  );
}
