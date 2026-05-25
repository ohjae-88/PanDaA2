"use client";

import { useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { ARCANA_KO, ARCANA_ORDER, GRADE_KO, SETS, STAT_LABEL } from "@/lib/arcana/constants";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  buildId: string | null;
  charId: string | null;
  slotKey: string | null;
  onClose: () => void;
};

/** V4.0.9 openCardPicker — 보유 카드 / 임의 카드 (DB) 탭 + 세트/슬롯 필터 + 큰 세로 카드 그리드 */
export function CardPickerDialog({ open, buildId, charId, slotKey, onClose }: Props) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  const setSlotOwned = useArcanaBuildStore((s) => s.setSlotOwned);
  const setSlotMaster = useArcanaBuildStore((s) => s.setSlotMaster);

  const [tab, setTab] = useState<"owned" | "master">("master");
  const [filterSet, setFilterSet] = useState<string>("");
  const [filterSlot, setFilterSlot] = useState<string>("");

  // 다이얼로그 열 때 슬롯 키로 초기 필터
  // (slotKey 변경 시 자동 적용)
  const initSlot = slotKey ?? "";
  // filterSlot이 비어있고 slotKey가 있을 때만 슬롯 prefilter
  const effectiveSlot = filterSlot || initSlot;

  const ownedForChar = useMemo(() => {
    if (!charId) return [];
    return owned.filter((o) => o.charId === charId);
  }, [owned, charId]);

  const ownedFiltered = useMemo(() => {
    return ownedForChar
      .map((o) => ({ o, m: arcana.find((a) => a.id === o.masterId) }))
      .filter(({ m }) => {
        if (!m) return false;
        if (filterSet && m.setKey !== filterSet) return false;
        if (effectiveSlot && m.slot !== effectiveSlot) return false;
        return true;
      });
  }, [ownedForChar, arcana, filterSet, effectiveSlot]);

  const masterFiltered = useMemo(() => {
    return arcana.filter((c) => {
      if (filterSet && c.setKey !== filterSet) return false;
      if (effectiveSlot && c.slot !== effectiveSlot) return false;
      return true;
    });
  }, [arcana, filterSet, effectiveSlot]);

  function pickOwned(ownedId: string) {
    if (!buildId || !slotKey) return;
    setSlotOwned(buildId, slotKey, ownedId);
    onClose();
  }
  function pickMaster(masterId: string) {
    if (!buildId || !slotKey) return;
    setSlotMaster(buildId, slotKey, masterId, 1);
    onClose();
  }

  if (!slotKey) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-5xl w-[min(1200px,96vw)] h-[min(720px,calc(100vh-48px))] flex flex-col p-4 gap-3"
      >
        <DialogHeader>
          <DialogTitle>🃏 카드 선택 — {ARCANA_KO[slotKey] || slotKey}</DialogTitle>
        </DialogHeader>

        {/* 탭 — 보유 카드 / 임의 카드 (DB) */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setTab("owned")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded border-2 text-sm font-extrabold transition-colors",
              tab === "owned"
                ? "border-cat-arcana bg-cat-arcana/15 text-cat-arcana"
                : "border-border bg-card hover:bg-accent/10 text-muted-foreground"
            )}
          >
            <span>📚</span> 보유 카드
          </button>
          <button
            onClick={() => setTab("master")}
            className={cn(
              "inline-flex items-center gap-2 px-4 py-2 rounded border-2 text-sm font-extrabold transition-colors",
              tab === "master"
                ? "border-cat-arcana bg-cat-arcana/15 text-cat-arcana"
                : "border-border bg-card hover:bg-accent/10 text-muted-foreground"
            )}
          >
            <span>🃏</span> 임의 카드 (DB)
          </button>
        </div>

        {/* 필터 — 세트 / 슬롯 (V4 동등 칩 행) */}
        <div className="space-y-1.5">
          <FilterRow label="세트" value={filterSet} onChange={setFilterSet} options={[
            { value: "", label: "전체" },
            ...SETS.map((s) => ({ value: s.code, label: `${s.season}·${s.name}` })),
          ]} />
          <FilterRow label="슬롯" value={filterSlot} onChange={setFilterSlot} options={[
            { value: "", label: "전체" },
            ...ARCANA_ORDER.map((s) => ({ value: s, label: ARCANA_KO[s] || s })),
          ]} />
        </div>

        {/* 카드 그리드 */}
        <div className="flex-1 min-h-0 overflow-auto">
          {tab === "owned" ? (
            ownedFiltered.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground italic py-10">
                해당 조건의 보유 카드 없음 — 보유 카드 패널에서 추가하세요.
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {ownedFiltered.map(({ o, m }) => m && (
                  <PickerCard
                    key={o.id}
                    icon={m.icon}
                    name={m.name}
                    mode="owned"
                    grade={GRADE_KO[m.grade] ?? m.grade}
                    stats={m.stats}
                    badge={`Lv.${o.level}/${m.maxLv}`}
                    onPick={() => pickOwned(o.id)}
                  />
                ))}
              </div>
            )
          ) : (
            masterFiltered.length === 0 ? (
              <div className="text-center text-xs text-muted-foreground italic py-10">
                해당 조건의 카드 마스터 없음
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-2">
                {masterFiltered.map((c) => (
                  <PickerCard
                    key={c.id}
                    icon={c.icon}
                    name={c.name}
                    mode="master"
                    grade={GRADE_KO[c.grade] ?? c.grade}
                    stats={c.stats}
                    onPick={() => pickMaster(c.id)}
                  />
                ))}
              </div>
            )
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

/** 필터 행 — 라벨 + 칩 버튼들 (V4 동등) */
function FilterRow({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-xs font-bold text-muted-foreground w-10">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.value || "_all"}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 rounded text-xs font-bold transition-colors",
            value === opt.value
              ? "bg-cat-arcana/20 text-cat-arcana border border-cat-arcana/50"
              : "bg-background/40 border border-border text-muted-foreground hover:bg-accent/10"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** V4 동등 — 큰 세로 카드 (모드 칩 + 등급 칩 + 큰 이미지 + 이름 + stat) */
function PickerCard({
  icon,
  name,
  mode,
  grade,
  stats,
  badge,
  onPick,
}: {
  icon: string;
  name: string;
  mode: "owned" | "master";
  grade: string;
  stats: Record<string, number>;
  badge?: string;
  onPick: () => void;
}) {
  const statEntries = Object.entries(stats || {});
  return (
    <button
      onClick={onPick}
      className="flex flex-col rounded-lg border bg-card hover:border-cat-arcana hover:bg-cat-arcana/5 transition-colors p-2 text-left gap-1.5"
    >
      {/* 상단: 모드 칩 + 등급 칩 */}
      <div className="flex items-center justify-between">
        <span className={cn(
          "inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold border",
          mode === "owned"
            ? "bg-cat-arcana/20 text-cat-arcana border-cat-arcana/40"
            : "bg-blue-500/20 text-blue-400 border-blue-500/40"
        )}>
          {mode === "owned" ? "📚 보유" : "📋 임의"}
        </span>
        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-extrabold border border-amber-500/40">
          {grade}
        </span>
      </div>
      {/* 카드 이미지 (세로 큰) */}
      <div className="aspect-[3/4] w-full overflow-hidden rounded">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="w-full h-full object-contain" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-muted/40 flex items-center justify-center text-3xl">🃏</div>
        )}
      </div>
      {/* 이름 + 뱃지 */}
      <div>
        <div className="font-extrabold text-sm text-cat-arcana truncate">{name}</div>
        {badge && (
          <div className="text-[10px] text-muted-foreground tabular-nums">{badge}</div>
        )}
      </div>
      {/* stat 라벨 */}
      {statEntries.length > 0 && (
        <div className="text-[11px] text-muted-foreground tabular-nums truncate">
          {statEntries
            .map(([k, v]) => `${STAT_LABEL[k] || k} +${v}`)
            .join(", ")}
        </div>
      )}
    </button>
  );
}
