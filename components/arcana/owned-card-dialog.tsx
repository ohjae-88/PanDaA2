"use client";

import { useEffect, useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";
import { useArcanaCharStore } from "@/lib/arcana/character-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  ARCANA_EMOJI,
  ARCANA_KO,
  ARCANA_ORDER,
  CARD_MAX_LV,
  GRADE_KO,
  STAT_LABEL,
  SETS,
} from "@/lib/arcana/constants";
import { summarizeCardSkillPools } from "@/lib/arcana/compute";
import { cn } from "@/lib/utils";
import type { ArcanaCard, SkillCategory } from "@/lib/arcana/types";

type Props = {
  open: boolean;
  ownedId: string | null;
  charId: string | null;
  onClose: () => void;
};

type Draft = {
  masterId: string;
  level: number;
  gains: { stats: Record<string, number>; skills: Record<string, number> };
  enabledSkills: string[];
  note: string;
};

const SUB_CATS: { code: SkillCategory; label: string }[] = [
  { code: "Active", label: "⚡ 액티브" },
  { code: "Passive", label: "🛡 패시브" },
  { code: "Dp", label: "✨ 스티그마" },
];

/** V4.0.9 openOwnedCardModal / renderOwnedModalContent 포팅 — 2단계 폼 (카드 선택 → 분배). */
export function OwnedCardDialog({ open, ownedId, charId, onClose }: Props) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  const addOwned = useOwnedStore((s) => s.addOwned);
  const patchOwned = useOwnedStore((s) => s.patchOwned);
  const removeOwned = useOwnedStore((s) => s.removeOwned);
  const characters = useArcanaCharStore((s) => s.characters);
  const skills = useSkillStore((s) => s.skills);

  const editing = ownedId ? owned.find((o) => o.id === ownedId) : null;
  const targetChar = characters.find((c) => c.id === charId) ?? null;

  const [draft, setDraft] = useState<Draft>({
    masterId: "",
    level: 0,
    gains: { stats: {}, skills: {} },
    enabledSkills: [],
    note: "",
  });

  // 필터 (카드 선택용)
  const [filterSet, setFilterSet] = useState<string>("");
  const [filterSlot, setFilterSlot] = useState<string>("");
  // ① 카드 선택 — 기본 접기
  const [pickerOpen, setPickerOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft({
        masterId: editing.masterId,
        level: editing.level,
        gains: {
          stats: { ...(editing.gains?.stats || {}) },
          skills: { ...(editing.gains?.skills || {}) },
        },
        enabledSkills: [...(editing.enabledSkills || [])],
        note: editing.note ?? "",
      });
    } else {
      setDraft({
        masterId: "",
        level: 0,
        gains: { stats: {}, skills: {} },
        enabledSkills: [],
        note: "",
      });
    }
    setFilterSet("");
    setFilterSlot("");
    setPickerOpen(!editing); // 신규 등록 = 펼치기, 편집 = 접기
  }, [open, editing]);

  const master = arcana.find((a) => a.id === draft.masterId) ?? null;
  const maxLv = master?.maxLv || CARD_MAX_LV;
  const policy = master?.levelUp || { skillPoint: 0, statPoint: 0 };
  const pool = (policy.skillPoint || 0) * draft.level;
  const used = Object.values(draft.gains.skills || {}).reduce((n, v) => n + (v || 0), 0);
  const remaining = pool - used;

  const cardSkills = useMemo(
    () => (master && targetChar ? summarizeCardSkillPools(master, targetChar.jobId, skills) : []),
    [master, targetChar, skills]
  );

  const masterGrid = useMemo(() => {
    return arcana.filter((c) => {
      if (filterSet && c.setKey !== filterSet) return false;
      if (filterSlot && c.slot !== filterSlot) return false;
      return true;
    });
  }, [arcana, filterSet, filterSlot]);

  /** 레벨 변경 시 — pool 초과한 분배는 큰 값부터 차감 (V4 clampGainsToPool 동등) */
  function clampGainsToPool(m: ArcanaCard, gains: Draft["gains"], lv: number) {
    const p = (m.levelUp?.skillPoint || 0) * lv;
    let u = Object.values(gains.skills || {}).reduce((n, v) => n + (v || 0), 0);
    if (u <= p) return gains;
    let overflow = u - p;
    const sorted = Object.entries(gains.skills || {}).sort((a, b) => b[1] - a[1]);
    const nextSkills = { ...gains.skills };
    for (const [sid] of sorted) {
      if (overflow <= 0) break;
      const v = nextSkills[sid] || 0;
      const take = Math.min(v, overflow);
      nextSkills[sid] = v - take;
      if (nextSkills[sid] <= 0) delete nextSkills[sid];
      overflow -= take;
    }
    return { ...gains, skills: nextSkills };
  }

  function setLv(v: number) {
    if (!master) return;
    const nv = Math.max(0, Math.min(maxLv, v));
    setDraft((d) => ({ ...d, level: nv, gains: clampGainsToPool(master, d.gains, nv) }));
  }

  function toggleEnabled(sid: string) {
    setDraft((d) => {
      const has = d.enabledSkills.includes(sid);
      const nextEnabled = has ? d.enabledSkills.filter((x) => x !== sid) : [...d.enabledSkills, sid];
      const nextSkills = { ...d.gains.skills };
      if (has) delete nextSkills[sid]; // 비활성 시 분배 클리어
      return { ...d, enabledSkills: nextEnabled, gains: { ...d.gains, skills: nextSkills } };
    });
  }

  function bumpSkill(sid: string, delta: number) {
    setDraft((d) => {
      const cur = d.gains.skills?.[sid] || 0;
      const next = Math.max(0, cur + delta);
      const nextSkills = { ...d.gains.skills };
      if (next <= 0) delete nextSkills[sid];
      else nextSkills[sid] = next;
      return { ...d, gains: { ...d.gains, skills: nextSkills } };
    });
  }

  function handleSave() {
    if (!draft.masterId) { toast.error("카드를 선택하세요."); return; }
    if (editing) {
      patchOwned(editing.id, {
        masterId: draft.masterId,
        level: draft.level,
        gains: draft.gains,
        enabledSkills: draft.enabledSkills,
        note: draft.note,
      });
    } else {
      addOwned({
        masterId: draft.masterId,
        level: draft.level,
        gains: draft.gains,
        enabledSkills: draft.enabledSkills,
        note: draft.note,
        charId: charId ?? null,
      });
    }
    onClose();
  }

  async function handleDelete() {
    if (!editing) return;
    if (!(await confirmDialog({ title: "카드 삭제", description: "이 보유/계획 카드를 삭제하시겠습니까?", confirmText: "삭제", variant: "destructive" }))) return;
    removeOwned(editing.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-5xl w-[min(1200px,96vw)] h-[min(820px,calc(100vh-48px))] flex flex-col p-4 gap-3">
        <DialogHeader>
          <DialogTitle>
            📚 {editing ? "보유/계획 카드 편집" : "보유/계획 카드 등록"}
            {targetChar && <span className="ml-2 text-xs text-muted-foreground font-normal">— {targetChar.name} ({targetChar.jobId})</span>}
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto space-y-3">
          {/* ① 카드 선택 — 접기/펼치기 (기본 접기) */}
          <section className="rounded border bg-background/30 p-2 space-y-2">
            <button
              onClick={() => setPickerOpen((v) => !v)}
              className="w-full flex items-center gap-2 text-left hover:opacity-80"
              title={pickerOpen ? "접기" : "펼치기"}
            >
              <span className="text-sm font-extrabold text-cat-arcana flex-1">
                ① 카드 선택
                {master && (
                  <span className="ml-2 text-xs font-bold text-muted-foreground">
                    — {master.name}
                  </span>
                )}
              </span>
              <span className="text-xs font-bold text-muted-foreground">
                {pickerOpen ? "▲ 접기" : "▼ 펼치기"}
              </span>
            </button>
            {pickerOpen && (
              <>
            {/* 필터 */}
            <FilterRow label="세트" current={filterSet} options={[
              { value: "", label: "전체" },
              ...SETS.map((s) => ({ value: s.code, label: `${s.season}·${s.name}` })),
            ]} onChange={setFilterSet} />
            <FilterRow label="슬롯" current={filterSlot} options={[
              { value: "", label: "전체" },
              ...ARCANA_ORDER.map((s) => ({ value: s, label: `${ARCANA_EMOJI[s] || ""} ${ARCANA_KO[s] || s}` })),
            ]} onChange={setFilterSlot} />
            {/* 카드 그리드 — 가로 칩형 (이미지 좌측 + 이름·스텟 우측) */}
            <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-1 max-h-[240px] overflow-auto">
              {masterGrid.map((c) => (
                <button
                  key={c.id}
                  onClick={() => setDraft((d) => ({ ...d, masterId: c.id }))}
                  className={cn(
                    "flex items-center gap-2 rounded border p-1.5 text-left transition-colors",
                    draft.masterId === c.id
                      ? "border-cat-arcana bg-cat-arcana/15"
                      : "bg-card hover:border-cat-arcana/50 hover:bg-cat-arcana/5"
                  )}
                  title={`${c.name} (${GRADE_KO[c.grade] ?? c.grade} · ${ARCANA_KO[c.slot] || c.slot})`}
                >
                  {c.icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.icon} alt="" className="w-10 h-14 rounded object-contain flex-shrink-0" loading="lazy" />
                  ) : (
                    <div className="w-10 h-14 rounded bg-muted/40 flex items-center justify-center text-base flex-shrink-0">🃏</div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-[13px] font-extrabold text-cat-arcana truncate leading-tight">{c.name}</div>
                  </div>
                  <div className="flex flex-col gap-0.5 items-end flex-shrink-0">
                    {Object.entries(c.stats || {}).map(([k, v]) => (
                      <span
                        key={k}
                        className="inline-flex items-center gap-0.5 px-1 py-0 rounded border border-cat-arcana/30 bg-cat-arcana/5 text-[9px] tabular-nums"
                        title={STAT_LABEL[k] || k}
                      >
                        {STAT_LABEL[k] || k}<b className="text-cat-arcana ml-0.5">+{v}</b>
                      </span>
                    ))}
                  </div>
                </button>
              ))}
            </div>
              </>
            )}
          </section>

          {/* ② 레벨 / 옵션 / 분배 / 메모 */}
          {!master ? (
            <div className="text-center text-xs text-muted-foreground italic py-4">위에서 카드를 선택하세요.</div>
          ) : (
            <section className="rounded border bg-background/30 p-2 space-y-2">
              <div className="text-sm font-extrabold text-cat-arcana">② 레벨 / 옵션 / 분배</div>

              {/* 선택한 카드 미리보기 */}
              <div className="flex items-center gap-2 rounded border bg-card/40 p-2">
                {master.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={master.icon} alt="" className="w-14 h-14 rounded flex-shrink-0" loading="lazy" />
                ) : (
                  <div className="w-14 h-14 rounded bg-muted/40 flex items-center justify-center flex-shrink-0">🃏</div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold text-sm">{master.name}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {master.season} · {ARCANA_KO[master.slot] || master.slot} · {GRADE_KO[master.grade] ?? master.grade}
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {Object.entries(master.stats || {}).map(([k, v]) => (
                      <span key={k} className="px-1.5 py-0.5 rounded border border-cat-arcana/30 bg-cat-arcana/5 text-[10px] tabular-nums">
                        {STAT_LABEL[k] || k} <b className="text-cat-arcana">+{v}</b>
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* 레벨 조정 */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold">레벨</span>
                <Input
                  type="number"
                  min={0} max={maxLv}
                  value={draft.level}
                  onChange={(e) => setLv(parseInt(e.target.value) || 0)}
                  className="h-8 w-20 tabular-nums"
                />
                <span className="text-[11px] text-muted-foreground">/ {maxLv} (0=계획)</span>
                <button
                  onClick={() => setLv(draft.level - 1)}
                  disabled={draft.level <= 0}
                  className="w-7 h-7 rounded border hover:bg-cat-arcana/10 disabled:opacity-30"
                  title="레벨 -1"
                >
                  <ChevronLeft className="h-4 w-4 inline" />
                </button>
                <button
                  onClick={() => setLv(draft.level + 1)}
                  disabled={draft.level >= maxLv}
                  className="w-7 h-7 rounded border hover:bg-cat-arcana/10 disabled:opacity-30"
                  title="레벨 +1"
                >
                  <ChevronRight className="h-4 w-4 inline" />
                </button>
                <button
                  onClick={() => setLv(maxLv)}
                  disabled={draft.level >= maxLv}
                  className="px-2 h-7 rounded border hover:bg-cat-arcana/10 disabled:opacity-30 text-xs font-extrabold tabular-nums"
                  title={`최대 레벨(Lv.${maxLv})로 즉시 적용`}
                >
                  Lv.{maxLv}
                </button>
                <span className="ml-auto text-xs">옵션 풀 <b className={cn("tabular-nums", remaining < 0 ? "text-rose-400" : "text-cat-arcana")}>{used}/{pool}</b></span>
              </div>

              {/* 옵션 선택 — Active / Passive / Dp 카테고리별 */}
              {cardSkills.length === 0 ? (
                <div className="text-xs text-muted-foreground italic px-1 py-2">
                  현재 직업({targetChar?.jobId})의 적용 스킬이 이 카드에 없습니다. 아르카나DB에서 추가하세요.
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <div className="text-xs font-bold text-muted-foreground">사용할 옵션 선택</div>
                    {(() => {
                      const renderCat = (cat: { code: SkillCategory; label: string }) => {
                        const catOpts = cardSkills.filter((s) => s.category === cat.code);
                        if (catOpts.length === 0) return null;
                        return (
                          <div key={cat.code} className="rounded border border-cat-arcana/20 bg-cat-arcana/5 p-1.5">
                            <div className="text-[11px] font-bold text-cat-arcana mb-1">
                              {cat.label} <span className="text-muted-foreground">{catOpts.length}개</span>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
                              {catOpts.map((sk) => {
                                const checked = draft.enabledSkills.includes(sk.id);
                                return (
                                  <button
                                    key={sk.id}
                                    onClick={() => toggleEnabled(sk.id)}
                                    className={cn(
                                      "flex items-center gap-1.5 px-1.5 py-1 rounded border text-left transition-colors",
                                      checked
                                        ? "border-cat-arcana bg-cat-arcana/15 text-cat-arcana"
                                        : "border-border bg-background/40 text-muted-foreground hover:bg-accent/10 hover:text-foreground"
                                    )}
                                  >
                                    <input
                                      type="checkbox"
                                      checked={checked}
                                      readOnly
                                      className="flex-shrink-0 pointer-events-none"
                                    />
                                    {sk.icon ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={sk.icon} alt="" className="w-4 h-4 rounded flex-shrink-0" loading="lazy" />
                                    ) : (
                                      <span className="w-4 h-4 inline-flex items-center justify-center bg-muted/40 rounded text-[9px] flex-shrink-0">✨</span>
                                    )}
                                    <span className="text-[11px] font-bold truncate flex-1">{sk.name}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        );
                      };
                      const dpCat = SUB_CATS.find((c) => c.code === "Dp")!;
                      return (
                        <>
                          {/* 액티브 / 패시브 — 좌우 배치 */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {renderCat(SUB_CATS.find((c) => c.code === "Active")!)}
                            {renderCat(SUB_CATS.find((c) => c.code === "Passive")!)}
                          </div>
                          {/* 스티그마 — 전체 폭 */}
                          {renderCat(dpCat)}
                        </>
                      );
                    })()}
                  </div>

                  {/* 분배 + 메모 — 좌우 배치 */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {/* 분배 — 선택된 옵션만 */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-muted-foreground">레벨업 포인트 분배</div>
                      {draft.enabledSkills.length === 0 ? (
                        <div className="text-[11px] text-muted-foreground italic px-1 py-2">
                          위에서 옵션을 먼저 선택하세요.
                        </div>
                      ) : (
                        <div className="space-y-1">
                          {cardSkills.filter((s) => draft.enabledSkills.includes(s.id)).map((sk) => {
                            const cur = draft.gains.skills?.[sk.id] || 0;
                            const lv = 1 + cur;
                            return (
                              <div key={sk.id} className="flex items-center gap-2 px-2 py-1 rounded border bg-card">
                                {sk.icon ? (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={sk.icon} alt="" className="w-6 h-6 rounded flex-shrink-0" loading="lazy" />
                                ) : (
                                  <span className="w-6 h-6 inline-flex items-center justify-center bg-muted/40 rounded text-xs flex-shrink-0">✨</span>
                                )}
                                <span className="text-sm font-bold flex-1 truncate">{sk.name}</span>
                                <span
                                  className="text-lg font-extrabold text-cat-arcana tabular-nums w-8 text-right"
                                  title={`기본 1 + 추가 ${cur} = ${lv}`}
                                >
                                  {lv}
                                </span>
                                <div className="flex flex-col gap-0">
                                  <button
                                    onClick={() => bumpSkill(sk.id, +1)}
                                    disabled={remaining <= 0}
                                    className="w-6 h-4 rounded-t border border-b-0 hover:bg-cat-arcana/15 disabled:opacity-30 text-[9px]"
                                    title="추가 분배 +1"
                                  >
                                    ▲
                                  </button>
                                  <button
                                    onClick={() => bumpSkill(sk.id, -1)}
                                    disabled={cur <= 0}
                                    className="w-6 h-4 rounded-b border hover:bg-cat-arcana/15 disabled:opacity-30 text-[9px]"
                                    title="추가 분배 -1"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* 메모 */}
                    <div className="space-y-1.5">
                      <div className="text-xs font-bold text-muted-foreground">메모</div>
                      <textarea
                        value={draft.note}
                        onChange={(e) => setDraft((d) => ({ ...d, note: e.target.value }))}
                        placeholder="예: 메인덱, 1번카드 등"
                        maxLength={300}
                        className="w-full min-h-[80px] rounded border bg-background px-2 py-1.5 text-sm resize-y"
                      />
                    </div>
                  </div>
                </>
              )}
            </section>
          )}
        </div>

        <DialogFooter className="justify-between border-t pt-2">
          {editing ? (
            <Button variant="ghost" onClick={handleDelete} className="text-destructive hover:text-destructive hover:bg-destructive/10">
              <Trash2 className="h-3.5 w-3.5 mr-1" /> 삭제
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button onClick={handleSave} disabled={!draft.masterId}>
              {editing ? "저장" : "등록"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** 칩 필터 행 — owned-list와 동일 스타일 */
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
