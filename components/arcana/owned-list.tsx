"use client";

import { useMemo, useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  ARCANA_EMOJI,
  ARCANA_KO,
  ARCANA_ORDER,
  GRADE_KO,
  SETS,
} from "@/lib/arcana/constants";
import { cn } from "@/lib/utils";
import type { ArcanaCharacter, OwnedCard, ArcanaCard } from "@/lib/arcana/types";
import { OwnedCardDialog } from "./owned-card-dialog";
import { confirmDialog } from "@/lib/util/confirm";

/** V4.0.9 renderOwnedList / renderOwnedRow 포팅 — 세트 그룹 + 칩 필터 + 세로 카드 행. */
export function OwnedListPanel({ character }: { character: ArcanaCharacter | null }) {
  const owned = useOwnedStore((s) => s.ownedCards);
  const arcana = useArcanaStore((s) => s.cards);
  const skills = useSkillStore((s) => s.skills);
  const builds = useArcanaBuildStore((s) => s.builds);
  const setAllBuilds = useArcanaBuildStore((s) => s.setAll);
  const removeOwned = useOwnedStore((s) => s.removeOwned);

  const [filterSeason, setFilterSeason] = useState<string>("");
  const [filterSetKey, setFilterSetKey] = useState<string>("");
  const [filterSlot, setFilterSlot] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);

  const charOwned = useMemo(() => {
    if (!character) return [];
    return owned
      .filter((o) => o.charId === character.id)
      .map((o) => ({ o, m: arcana.find((a) => a.id === o.masterId) }))
      .filter((x): x is { o: OwnedCard; m: ArcanaCard } => !!x.m);
  }, [owned, arcana, character]);

  const seasons = useMemo(
    () => Array.from(new Set(SETS.map((s) => s.season))).sort((a, b) => b.localeCompare(a)),
    []
  );

  // 필터 적용 — 시즌, 세트, 슬롯
  const filtered = useMemo(() => {
    return charOwned.filter(({ m }) => {
      if (filterSeason && m.season !== filterSeason) return false;
      if (filterSetKey && m.setKey !== filterSetKey) return false;
      if (filterSlot && m.slot !== filterSlot) return false;
      return true;
    });
  }, [charOwned, filterSeason, filterSetKey, filterSlot]);

  // 세트별 그룹화 — SETS 정의 순서로 정렬
  const groups = useMemo(() => {
    const map: Record<string, { o: OwnedCard; m: ArcanaCard }[]> = {};
    for (const item of filtered) {
      const k = item.m.setKey;
      if (!map[k]) map[k] = [];
      map[k].push(item);
    }
    return SETS
      .map((s) => ({ set: s, items: map[s.code] || [] }))
      .filter((g) => g.items.length > 0);
  }, [filtered]);

  const hasFilter = !!(filterSeason || filterSetKey || filterSlot);

  async function handleDelete(ownedId: string) {
    if (!(await confirmDialog({ title: "카드 삭제", description: "이 보유/계획 카드를 삭제하시겠습니까?\n(배치된 슬롯도 비워집니다)", confirmText: "삭제", variant: "destructive" }))) return;
    // 슬롯 참조 정리 — 모든 빌드의 슬롯에서 ownedCardId 일치하면 비움
    const nextBuilds = builds.map((b) => {
      let changed = false;
      const slots = { ...b.slots };
      for (const k of ARCANA_ORDER) {
        if (slots[k]?.ownedCardId === ownedId) {
          slots[k] = {
            ownedCardId: null,
            masterId: null,
            level: 0,
            gains: { stats: {}, skills: {} },
            enabledSkills: [],
            activeCondEffects: [],
          };
          changed = true;
        }
      }
      return changed ? { ...b, slots } : b;
    });
    setAllBuilds(nextBuilds);
    removeOwned(ownedId);
  }

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* 헤더 — 제목 + 등록 / 접기 버튼 */}
      <div className="w-full flex items-center gap-2 px-3 py-2 bg-cat-arcana/10">
        <span className="text-base font-extrabold flex-1 text-left">📚 보유 카드</span>
        <button
          disabled={!character}
          onClick={() => { setEditingId(null); setOpen(true); }}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-cat-arcana/40 bg-cat-arcana/10 text-cat-arcana text-xs font-bold hover:bg-cat-arcana/20 disabled:opacity-40"
          title="보유 카드 등록"
        >
          <Plus className="h-3 w-3" /> 보유 카드 등록
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border text-xs font-bold hover:bg-accent/15"
          title={expanded ? "목록 접기" : "목록 펼치기"}
        >
          {expanded ? "▲ 접기" : "▼ 펼치기"} ({charOwned.length}장)
        </button>
      </div>

      {expanded && (
        <div className="p-2 space-y-2">
          {/* 필터 — 칩 행 */}
          <div className="rounded border bg-background/40 p-2 space-y-1.5">
            {/* 시즌 */}
            <FilterRow label="시즌" current={filterSeason} options={[
              { value: "", label: "전체 시즌" },
              ...seasons.map((s) => ({ value: s, label: s })),
            ]} onChange={(v) => {
              setFilterSeason(v);
              // 시즌 변경 시 setKey가 다른 시즌이면 초기화
              if (filterSetKey) {
                const setMeta = SETS.find((s) => s.code === filterSetKey);
                if (setMeta && v && setMeta.season !== v) setFilterSetKey("");
              }
            }} />
            {/* 세트 */}
            <FilterRow label="세트" current={filterSetKey} options={[
              { value: "", label: "전체" },
              ...SETS.filter((s) => !filterSeason || s.season === filterSeason).map((s) => ({ value: s.code, label: s.name })),
            ]} onChange={setFilterSetKey} />
            {/* 슬롯 */}
            <FilterRow label="슬롯" current={filterSlot} options={[
              { value: "", label: "전체" },
              ...ARCANA_ORDER.map((s) => ({ value: s, label: `${ARCANA_EMOJI[s] || ""} ${ARCANA_KO[s] || s}` })),
            ]} onChange={setFilterSlot} />

            {hasFilter && (
              <div className="flex justify-end">
                <button
                  onClick={() => { setFilterSeason(""); setFilterSetKey(""); setFilterSlot(""); }}
                  className="text-[11px] font-bold text-muted-foreground hover:text-foreground px-2 py-0.5"
                >
                  ✕ 필터 해제
                </button>
              </div>
            )}
          </div>

          {/* 목록 */}
          {!character ? (
            <div className="text-center text-xs text-muted-foreground italic py-6">캐릭터를 선택하세요</div>
          ) : charOwned.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground italic py-6">
              이 캐릭터에 등록된 보유/계획 카드가 없습니다. + 보유 카드 등록 으로 추가하세요.
            </div>
          ) : groups.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground italic py-6">필터에 일치하는 카드가 없습니다.</div>
          ) : (
            <div className="space-y-3">
              {groups.map(({ set, items }) => (
                <div key={set.code}>
                  {/* 세트 그룹 헤더 */}
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full border border-amber-500/40 bg-amber-500/10 text-amber-400 text-[10px] font-extrabold">
                      {set.season}
                    </span>
                    <span className="font-extrabold text-sm">{set.name}</span>
                    <span className="text-xs text-muted-foreground">{items.length}장</span>
                  </div>
                  {/* 카드 그리드 — 세로 카드 행 */}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-2">
                    {items.map(({ o, m }) => (
                      <OwnedCardRow
                        key={o.id}
                        owned={o}
                        master={m}
                        skills={skills}
                        onEdit={() => { setEditingId(o.id); setOpen(true); }}
                        onDelete={() => handleDelete(o.id)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <OwnedCardDialog
        open={open}
        ownedId={editingId}
        charId={character?.id ?? null}
        onClose={() => setOpen(false)}
      />
    </div>
  );
}

/** 필터 행 — 라벨 + 칩 버튼들 (V4 picker-filter-chip 동등) */
function FilterRow({
  label,
  current,
  options,
  onChange,
}: {
  label: string;
  current: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <span className="text-[11px] font-bold text-muted-foreground w-10 flex-shrink-0">{label}</span>
      {options.map((opt) => (
        <button
          key={opt.value || "_all"}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-0.5 rounded text-xs font-bold transition-colors border",
            current === opt.value
              ? "bg-cat-arcana/20 text-cat-arcana border-cat-arcana/50"
              : "bg-background/40 border-border text-muted-foreground hover:bg-accent/10 hover:text-foreground"
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

/** 세로 카드 행 — 카드 이미지 + 이름 + Lv/등급/옵션 + 활성 스킬 행 + 액션 버튼 */
function OwnedCardRow({
  owned,
  master,
  skills,
  onEdit,
  onDelete,
}: {
  owned: OwnedCard;
  master: ArcanaCard;
  skills: { id: string; name: string; icon?: string }[];
  onEdit: () => void;
  onDelete: () => void;
}) {
  const isPlan = (owned.level || 0) === 0;
  const used = Object.values(owned.gains?.skills || {}).reduce((n, v) => n + (v || 0), 0);
  const pool = (master.levelUp?.skillPoint || 0) * (owned.level || 0);
  const enabledIds = owned.enabledSkills || [];

  return (
    <div className={cn(
      "relative flex flex-col items-stretch gap-1 rounded border bg-card/40 p-2",
      isPlan && "opacity-80"
    )}>
      {/* 좌측 상단 — 보유/예정 뱃지 */}
      <span
        className={cn(
          "absolute top-1.5 left-1.5 z-10 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-extrabold border shadow-sm",
          isPlan
            ? "bg-amber-500/20 text-amber-400 border-amber-500/40"
            : "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
        )}
        title={isPlan ? "계획 카드 (미보유)" : "보유 카드"}
      >
        {isPlan ? "📋 예정" : "📚 보유"}
      </span>

      {/* 카드 이미지 + 이름 영역 */}
      <div className="flex flex-col items-center gap-1">
        {master.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={master.icon}
            alt=""
            className="w-[80px] h-[104px] rounded object-contain border border-cat-arcana/40"
            loading="lazy"
          />
        ) : (
          <div className="w-[80px] h-[104px] rounded bg-muted/40 flex items-center justify-center text-2xl border border-cat-arcana/40">🃏</div>
        )}
        <div className="text-center mt-1 w-full">
          <div className="flex items-center justify-center gap-1.5 flex-wrap">
            <span className="inline-flex items-center px-1.5 py-0.5 rounded-full bg-cat-arcana text-background text-[10px] font-extrabold tabular-nums shadow">
              Lv.{owned.level || 0}
            </span>
            <span className="text-sm font-extrabold text-cat-arcana leading-tight truncate">{master.name}</span>
          </div>
          <div className="text-[10px] text-muted-foreground mt-0.5 tabular-nums">
            {GRADE_KO[master.grade] ?? master.grade} · 옵션 {used}/{pool}
          </div>
          {owned.note && (
            <div className="text-[10px] text-muted-foreground italic mt-0.5 truncate" title={owned.note}>
              {owned.note}
            </div>
          )}
        </div>
      </div>

      {/* 활성 스킬 행 */}
      {enabledIds.length > 0 && (
        <div className="flex flex-col gap-1 mt-1">
          {enabledIds.map((sid) => {
            const sk = skills.find((s) => s.id === sid);
            const extra = owned.gains?.skills?.[sid] || 0;
            const lv = 1 + extra;
            return (
              <div
                key={sid}
                className="flex items-center gap-1.5 px-1.5 py-1 rounded border bg-background/40"
                title={sk?.name}
              >
                {sk?.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sk.icon} alt="" className="w-6 h-6 rounded flex-shrink-0" loading="lazy" />
                ) : (
                  <span className="w-6 h-6 inline-flex items-center justify-center bg-muted/40 rounded text-xs flex-shrink-0">✨</span>
                )}
                <span className="text-[13px] font-bold flex-1 truncate">{sk?.name || sid}</span>
                <span className="text-[13px] font-extrabold text-cat-arcana tabular-nums">+{lv}</span>
              </div>
            );
          })}
        </div>
      )}

      {/* 액션 버튼 — 카드 하단 분할 (수정 / 삭제) — 아이콘만 */}
      <div className="flex border-t -mx-2 -mb-2 mt-auto">
        <button
          onClick={onEdit}
          className="flex-1 inline-flex items-center justify-center px-2 py-1.5 border-r text-muted-foreground hover:text-cat-arcana hover:bg-cat-arcana/10 transition-colors"
          title="수정"
        >
          <Pencil className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={onDelete}
          className="flex-1 inline-flex items-center justify-center px-2 py-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
          title="삭제"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
