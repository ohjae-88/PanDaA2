"use client";

import { useState } from "react";
import { Plus, Trash2, Save, Replace, RefreshCw } from "lucide-react";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  ARCANA_EMOJI,
  ARCANA_KO,
  ARCANA_ORDER,
  GRADE_KO,
  STAT_LABEL,
} from "@/lib/arcana/constants";
import { resolveSlotCard, getSkillTotalAndClass } from "@/lib/arcana/compute";
import { skillLevelStyle } from "@/lib/arcana/skill-style";
import { cn } from "@/lib/utils";
import type { ArcanaBuild } from "@/lib/arcana/types";
import { CardPickerDialog } from "./card-picker-dialog";
import { confirmDialog } from "@/lib/util/confirm";
import { SlotDistribInline } from "./slot-distrib-inline";
import { SlotSaveDialog } from "./slot-save-dialog";
import { SlotHeaderTooltipContent } from "./arcana-ref-table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** V4.0.9 renderSlots / renderSlotRow 포팅 — 6슬롯 시각 배치 */
export function ArcanaSlots({ build, jobId }: { build: ArcanaBuild; jobId: string }) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  const patchOwned = useOwnedStore((s) => s.patchOwned);
  const skills = useSkillStore((s) => s.skills);
  const toggleEnabled = useArcanaBuildStore((s) => s.toggleSlotSkillEnabled);
  const setSlotGainSkills = useArcanaBuildStore((s) => s.setSlotGainSkills);
  const clearSlot = useArcanaBuildStore((s) => s.clearSlot);

  const [pickerSlot, setPickerSlot] = useState<string | null>(null);
  // 기본 표시 = 분배 모드. 옵션 모드(스킬 활성/비활성 칩 선택)는 opt-in.
  const [optionSlot, setOptionSlot] = useState<string | null>(null);
  // 저장 다이얼로그 — 슬롯별 단일 인스턴스
  const [saveSlot, setSaveSlot] = useState<string | null>(null);

  /** "✓ 적용하기" 버튼 — 활성된(enabledSkills 포함된) 스킬을 분배 옵션에 자동 등록.
   *  분배 화면으로 복귀. 비활성 스킬은 분배에서 제거.
   *  이 슬롯에만 적용 (다른 슬롯 영향 없음).
   *  owned 모드: owned-store에 정리, master 모드: build-store entry에 정리. */
  function applyEnabledToDistrib(slot: string) {
    const entry = build.slots[slot];
    const r = resolveSlotCard(entry, arcana, owned);
    const { master, enabledSkills, source } = r;
    if (!master) return;
    const cardSkillIds = master.skillsByJob?.[jobId] || [];
    const current = r.gains.skills || {};
    const next: Record<string, number> = {};
    // 활성된 스킬만 등록 — 기본 분배 0 (옵션 활성 = 자동 +1 처리되므로 분배는 사용자 입력만)
    cardSkillIds.forEach((sid) => {
      if (enabledSkills.includes(sid)) {
        if (current[sid] && current[sid] > 0) next[sid] = current[sid];
      }
    });
    if (source === "owned" && entry?.ownedCardId) {
      const o = owned.find((x) => x.id === entry.ownedCardId);
      if (o) {
        patchOwned(o.id, { gains: { stats: o.gains.stats || {}, skills: next } });
      }
    } else {
      setSlotGainSkills(build.id, slot, next);
    }
    setOptionSlot(null);
  }

  return (
    <>
      <div className="rounded-lg border bg-card p-3">
        <div className="text-xs font-extrabold text-muted-foreground mb-2">📕 장착 슬롯</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {ARCANA_ORDER.map((slot) => {
            const entry = build.slots[slot];
            const resolved = resolveSlotCard(entry, arcana, owned);
            const { master, gains, enabledSkills: resolvedEnabledSkills } = resolved;
            const isEmpty = !master;
            const cardSkillIds = master?.skillsByJob?.[jobId] || [];
            // 스킬풀 — 레벨 × policy.skillPoint − sum(gains.skills)
            const policy = master?.levelUp || { skillPoint: 0, statPoint: 0 };
            const slotLevel = !isEmpty ? (resolved.level || 0) : 0;
            const skillPool = slotLevel * (policy.skillPoint || 0);
            const usedSkillSum = Object.values(gains.skills || {}).reduce((n, v) => n + (Number(v) || 0), 0);
            const remainingSkill = skillPool - usedSkillSum;
            const isOptionMode = optionSlot === slot;
            return (
              <div
                key={slot}
                className={cn(
                  // 외부 슬롯 카드 — 페이지 기본 카드 톤(`border bg-card`)과 일관 적용
                  "flex rounded-lg border bg-card overflow-hidden min-h-[160px]"
                )}
              >
                {/* 세로 슬롯명 라벨 — hover 시 해당 슬롯 + 직업의 적용 가능 스킬 툴팁 */}
                <Tooltip delayDuration={150}>
                  <TooltipTrigger asChild>
                    <div className="w-8 flex-shrink-0 flex flex-col items-center justify-center gap-1 bg-muted/30 border-r border-border py-2 cursor-help">
                      <span className="text-base">{ARCANA_EMOJI[slot]}</span>
                      <span
                        className="text-xs font-extrabold text-muted-foreground tracking-wider"
                        style={{ writingMode: "vertical-rl", textOrientation: "upright" }}
                      >
                        {ARCANA_KO[slot]}
                      </span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="max-w-[440px] p-3 bg-card text-card-foreground">
                    <SlotHeaderTooltipContent slot={slot} jobId={jobId} />
                  </TooltipContent>
                </Tooltip>

                {/* 슬롯 본문 */}
                <div className="flex-1 min-w-0 p-2 flex flex-col gap-2">
                  {isEmpty ? (
                    <button
                      onClick={() => setPickerSlot(slot)}
                      className="flex-1 flex items-center justify-center gap-2 rounded border-2 border-dashed border-border hover:border-foreground/40 hover:bg-accent/10 transition-colors text-muted-foreground hover:text-foreground"
                    >
                      <Plus className="h-8 w-8 opacity-60" />
                      <span className="text-xs">(빈 슬롯) 클릭하여 카드 배치</span>
                    </button>
                  ) : !isOptionMode ? (
                    // 기본 = 인라인 분배 모드. 우측 액션 column의 Settings 클릭 시 옵션 모드 진입.
                    <SlotDistribInline
                      build={build}
                      slotKey={slot}
                      jobId={jobId}
                      onEnterOption={() => setOptionSlot(slot)}
                    />
                  ) : (
                    <>
                      {/* 카드 본체 — 50×50 이미지 + 우측 (등급+stats 행 / 카드명 행) + 우상단 변경 */}
                      <div className="flex gap-2 items-start">
                        {master.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={master.icon} alt="" className="w-[50px] h-[50px] rounded flex-shrink-0" loading="lazy" />
                        ) : (
                          <div className="w-[50px] h-[50px] rounded bg-muted/40 flex items-center justify-center flex-shrink-0 text-xl">🃏</div>
                        )}
                        <div className="flex-1 min-w-0 flex flex-col gap-1">
                          {/* 1) [등급 칩] [stat 칩 wrap] [Lv.N] [변경] */}
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-extrabold border border-amber-500/40">
                              {GRADE_KO[master.grade] ?? master.grade}
                            </span>
                            {Object.entries({ ...(master.stats || {}), ...(gains.stats || {}) }).map(([k, v]) => (
                              <span
                                key={k}
                                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-cat-arcana/40 bg-cat-arcana/10 text-[10px] tabular-nums"
                                title={STAT_LABEL[k] || k}
                              >
                                {STAT_LABEL[k] || k}<b className="text-cat-arcana ml-0.5">+{v}</b>
                              </span>
                            ))}
                            <span className="ml-auto inline-flex items-center gap-1">
                              <button
                                onClick={() => applyEnabledToDistrib(slot)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-cat-arcana/40 bg-cat-arcana/10 text-cat-arcana text-xs font-bold hover:bg-cat-arcana/25"
                                title="활성 스킬을 분배에 등록 + 분배 화면 복귀 (활성 없으면 빈 분배 상태로 복귀)"
                              >
                                ✓ 적용하기
                              </button>
                              <button
                                onClick={() => setPickerSlot(slot)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border hover:bg-accent/15 text-xs font-bold"
                                title="다른 카드로 변경"
                              >
                                카드변경
                              </button>
                              <button
                                onClick={async () => {
                                  if (!(await confirmDialog({
                                    title: "슬롯 비우기",
                                    description: "배치된 카드 + 분배가 모두 초기화됩니다.",
                                    confirmText: "비우기",
                                    variant: "destructive",
                                  }))) return;
                                  clearSlot(build.id, slot);
                                  setOptionSlot(null);
                                }}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded border border-border hover:bg-destructive/15 hover:border-destructive hover:text-destructive text-xs font-bold"
                                title="슬롯 비우기 — 카드 배치 + 분배 초기화"
                              >
                                슬롯 비우기
                              </button>
                            </span>
                          </div>
                          {/* 2) 카드명 (큰 굵음) */}
                          <div className="font-extrabold text-base truncate">{master.name}</div>
                        </div>
                      </div>

                      {/* 적용 가능 스킬 — 활성/비활성 2영역으로 분리, 활성 우선 */}
                      {cardSkillIds.length > 0 && (() => {
                        // owned 모드는 owned.enabledSkills, master 모드는 entry.enabledSkills — resolveSlotCard가 통합 결과 반환.
                        const enabledIds = resolvedEnabledSkills;
                        const activeIds = cardSkillIds.filter((sid) => enabledIds.includes(sid));
                        const inactiveIds = cardSkillIds.filter((sid) => !enabledIds.includes(sid));
                        const renderChip = (sid: string, idx: number, isActive: boolean) => {
                          const sk = skills.find((s) => s.id === sid);
                          // owned 모드: gains.skills는 owned.gains.skills (resolveSlotCard 통합).
                          const extra = isActive ? (gains.skills?.[sid] || 0) : 0;
                          const slotLv = isActive ? 1 + extra : 0;
                          const total = sk ? getSkillTotalAndClass(sk, build, arcana, owned).total : 0;
                          const lvStyle = sk ? skillLevelStyle(sk.category, total) : { containerCls: "", lvBg: "" };
                          const useThreshold = isActive && !!lvStyle.containerCls;
                          const chipBtn = (
                            <button
                              key={`${sid}_${idx}`}
                              onClick={() => toggleEnabled(build.id, slot, sid, !isActive)}
                              className={cn(
                                "inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] transition-colors",
                                isActive
                                  ? useThreshold
                                    ? lvStyle.containerCls
                                    : "border-cat-arcana bg-cat-arcana/15 text-cat-arcana hover:bg-cat-arcana/25"
                                  : "border-border bg-muted/20 text-muted-foreground hover:bg-accent/20 hover:text-foreground opacity-80"
                              )}
                            >
                              {sk?.icon && (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={sk.icon} alt="" className="w-3 h-3 rounded flex-shrink-0" loading="lazy" />
                              )}
                              <span className="truncate max-w-[96px]">{sk?.name || sid}</span>
                              {isActive && (
                                <span className={cn(
                                  "font-extrabold tabular-nums",
                                  useThreshold && "px-1 rounded text-background",
                                  useThreshold && lvStyle.lvBg
                                )}>+{slotLv}</span>
                              )}
                            </button>
                          );
                          // 옵션 모드 — 툴팁 제거 (미배치 스킬 선택 차단 방지).
                          // 스킬 hover/breakdown 툴팁은 분배 모드(SlotDistribInline)에서 제공.
                          return chipBtn;
                        };
                        return (
                          <div className="border-t pt-1.5 mt-auto space-y-1.5">
                            {/* 헤더 — 활성/전체 카운트 (적용/카드변경/슬롯비우기 버튼은 카드 헤더 행으로 이동) */}
                            <div className="flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-muted-foreground">
                                적용 가능 스킬{" "}
                                <span className="text-cat-arcana font-extrabold tabular-nums">
                                  {activeIds.length}
                                </span>
                                <span className="text-muted-foreground/60">/{cardSkillIds.length}</span>
                              </span>
                            </div>

                            {/* 활성 영역 (있을 때만) */}
                            {activeIds.length > 0 && (
                              <div className="rounded border border-cat-arcana/30 bg-cat-arcana/5 p-1">
                                <div className="text-[9px] font-bold text-cat-arcana mb-0.5">⚡ 활성 ({activeIds.length})</div>
                                <div className="flex flex-wrap gap-1">
                                  {activeIds.map((sid, idx) => renderChip(sid, idx, true))}
                                </div>
                              </div>
                            )}

                            {/* 비활성 영역 */}
                            {inactiveIds.length > 0 && (
                              <div className="rounded border border-border bg-background/30 p-1">
                                <div className="text-[9px] font-bold text-muted-foreground mb-0.5">○ 비활성 ({inactiveIds.length})</div>
                                <div className="flex flex-wrap gap-1">
                                  {inactiveIds.map((sid, idx) => renderChip(sid, idx, false))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </>
                  )}
                </div>

                {/* 우측 액션 column — 카드 배치 시 항상 표시. 배럭 캐릭터 카드 스타일 (장비/수정/숨기기). */}
                {!isEmpty && (
                  <div className="flex flex-col border-l self-stretch min-w-[52px]">
                    <button
                      onClick={async () => {
                        if (!(await confirmDialog({
                          title: "슬롯 비우기",
                          description: "배치된 카드 + 분배가 모두 초기화됩니다.",
                          confirmText: "비우기",
                          variant: "destructive",
                        }))) return;
                        clearSlot(build.id, slot);
                        if (optionSlot === slot) setOptionSlot(null);
                      }}
                      className="flex-1 px-2 py-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10 border-b transition-colors flex items-center justify-center"
                      title="슬롯 비우기 — 카드 배치 + 분배 초기화"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setSaveSlot(slot)}
                      className="flex-1 px-2 py-1.5 text-muted-foreground hover:text-emerald-400 hover:bg-emerald-500/10 border-b transition-colors flex items-center justify-center"
                      title="저장 — 수정 / 신규 보유 / 계획 카드로 저장"
                    >
                      <Save className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setPickerSlot(slot)}
                      className="flex-1 px-2 py-1.5 text-muted-foreground hover:text-cat-arcana hover:bg-cat-arcana/10 border-b transition-colors flex items-center justify-center"
                      title="카드 변경 — 카드 선택 창 열기"
                    >
                      <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setOptionSlot(isOptionMode ? null : slot)}
                      className={cn(
                        "flex-1 px-2 py-1.5 border-b transition-colors flex items-center justify-center",
                        isOptionMode
                          ? "bg-cat-arcana/15 text-cat-arcana hover:bg-cat-arcana/25"
                          : "text-muted-foreground hover:text-cat-arcana hover:bg-cat-arcana/10"
                      )}
                      title={isOptionMode ? "분배 모드 복귀" : "옵션 모드 진입 — 스킬 활성/비활성 선택"}
                    >
                      <Replace className="h-4 w-4" />
                    </button>
                    {/* 스킬풀 — 마지막 셀 (보더 없음) */}
                    <div
                      className={cn(
                        "flex-1 px-2 py-1.5 text-[11px] font-extrabold tabular-nums flex items-center justify-center",
                        remainingSkill < 0
                          ? "text-rose-400 bg-rose-400/10"
                          : "text-cat-arcana bg-cat-arcana/10"
                      )}
                      title={`스킬 풀: 사용 ${usedSkillSum}/${skillPool} (잔여 ${remainingSkill})`}
                    >
                      ⚡{remainingSkill}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <CardPickerDialog
        open={!!pickerSlot}
        buildId={build.id}
        charId={build.charId}
        slotKey={pickerSlot}
        onClose={() => setPickerSlot(null)}
      />
      {saveSlot && (
        <SlotSaveDialog
          open={!!saveSlot}
          buildId={build.id}
          slotKey={saveSlot}
          charId={build.charId}
          onClose={() => setSaveSlot(null)}
        />
      )}
    </>
  );
}
