"use client";

import { useMemo } from "react";
import { Settings, ChevronLeft, ChevronRight } from "lucide-react";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  CARD_MAX_LV,
  GRADE_KO,
  STAT_LABEL,
} from "@/lib/arcana/constants";
import { getEffectiveCardStats, getSkillTotalAndClass } from "@/lib/arcana/compute";
import { resolveSlotCard, summarizeCardSkillPools } from "@/lib/arcana/compute";
import { skillLevelStyle } from "@/lib/arcana/skill-style";
import type { ArcanaBuild } from "@/lib/arcana/types";
import { cn } from "@/lib/utils";
import { SkillHoverTooltip } from "./skill-hover-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** V4.0.9 openSlotSaveModal 동등 — 슬롯 내부 인라인 분배 패널.
 *  좌(카드 미리보기 + Lv 슬라이더 + 등급/모드) + 중앙(공간 풀 + 스킬 행).
 *  우측 액션 column은 부모(arcana-slots)가 슬롯 카드 우측에 직접 배치. */
export function SlotDistribInline({
  build,
  slotKey,
  jobId,
  onEnterOption,
}: {
  build: ArcanaBuild;
  slotKey: string;
  jobId: string;
  /** 옵션 모드 진입 (스킬 활성/비활성 칩 선택 화면) — 빈 옵션 상태 안내 버튼용 */
  onEnterOption: () => void;
}) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  const skills = useSkillStore((s) => s.skills);
  const setSlotLevel = useArcanaBuildStore((s) => s.setSlotLevel);
  const setSlotGainSkills = useArcanaBuildStore((s) => s.setSlotGainSkills);
  const patchOwned = useOwnedStore((s) => s.patchOwned);
  // build store에서 selector로 직접 — props build는 stale 가능성 있음
  const liveBuild = useArcanaBuildStore((s) => s.builds.find((b) => b.id === build.id)) || build;
  const entry = liveBuild.slots[slotKey];
  const { master, level, gains, source, enabledSkills: resolvedEnabledSkills } = useMemo(
    () => resolveSlotCard(entry, arcana, owned),
    [entry, arcana, owned]
  );
  const ownedRef = useMemo(() => {
    if (source !== "owned" || !entry?.ownedCardId) return null;
    return owned.find((o) => o.id === entry.ownedCardId) ?? null;
  }, [source, entry, owned]);

  // 즉시 반영 — store 직접 구독, draft 없음
  const lv = level;
  const skillsDraft = gains.skills || {};

  // 활성된 카드 스킬만 분배 옵션에 노출 — V4 동등: enabledSkills.includes.
  // owned 모드는 owned.enabledSkills, master 모드는 entry.enabledSkills를 resolveSlotCard가 통합.
  const cardSkills = useMemo(() => {
    if (!master) return [];
    const allCardSkills = summarizeCardSkillPools(master, jobId, skills);
    return allCardSkills.filter((sk) => resolvedEnabledSkills.includes(sk.id));
  }, [master, jobId, skills, resolvedEnabledSkills]);

  if (!master) return null;

  // 가용 포인트 — 레벨 × policy. 스텟 풀은 카드 stats에 자동 적용되므로 별도 표시 안 함.
  const policy = master.levelUp || { skillPoint: 0, statPoint: 0 };
  const skillPool = lv * (policy.skillPoint || 0);
  const usedSkillSum = Object.values(skillsDraft).reduce((n, v) => n + (Number(v) || 0), 0);
  const remainingSkill = skillPool - usedSkillSum;

  // 즉시 store 반영 — Lv/스킬값 변경 시 곧바로 저장 → 스킬 총합 카드 자동 갱신
  function bumpLv(delta: number) {
    const next = Math.max(0, Math.min(master?.maxLv || CARD_MAX_LV, lv + delta));
    if (source === "owned" && ownedRef) {
      patchOwned(ownedRef.id, { level: next });
    } else {
      setSlotLevel(build.id, slotKey, next);
    }
  }
  function setSkillVal(sid: string, v: number) {
    const next = { ...skillsDraft };
    if (v <= 0) delete next[sid];
    else next[sid] = v;
    if (source === "owned" && ownedRef) {
      patchOwned(ownedRef.id, { gains: { stats: ownedRef.gains.stats || {}, skills: next } });
    } else {
      setSlotGainSkills(build.id, slotKey, next);
    }
  }

  return (
    <>
    <div className="flex gap-3 items-stretch min-h-[200px]">
      {/* 좌측 — 카드 미리보기 (요청 배열: 이미지 → 등급+모드 → Lv+카드명) */}
      <div className="flex flex-col items-center gap-1.5 px-2 min-w-[180px]">
        {/* 1) 카드 이미지 (최상단) */}
        {master.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={master.icon} alt="" className="w-28 h-36 rounded object-contain" loading="lazy" />
        ) : (
          <div className="w-28 h-36 rounded bg-muted/40 flex items-center justify-center text-3xl">🃏</div>
        )}
        {/* 2) [등급 뱃지] [📚 보유 / 📋 임의] */}
        <div className="flex items-center gap-1.5">
          <span className="inline-block px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 text-[10px] font-extrabold border border-amber-500/40">
            {GRADE_KO[master.grade] ?? master.grade}
          </span>
          <span className={cn(
            "inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border",
            source === "owned"
              ? "bg-cat-arcana/20 text-cat-arcana border-cat-arcana/40"
              : "bg-blue-500/20 text-blue-400 border-blue-500/40"
          )}>
            {source === "owned" ? "📚 보유" : "📋 임의"}
          </span>
        </div>
        {/* 3) [Lv.N] {카드명} */}
        <div className="flex items-center gap-1.5 flex-wrap justify-center">
          <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-cat-arcana text-background text-sm font-extrabold tabular-nums shadow">
            Lv.{lv}
          </span>
          <span className="text-base font-extrabold leading-tight">
            {master.name}
          </span>
        </div>
        {/* 4) Lv 조정 — < / > / Lv.max 즉시 적용 버튼 */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => bumpLv(-1)}
            disabled={lv <= 0}
            className="w-7 h-7 rounded border hover:bg-cat-arcana/10 disabled:opacity-30"
            title="레벨 -1"
          >
            <ChevronLeft className="h-4 w-4 inline" />
          </button>
          <button
            onClick={() => bumpLv(+1)}
            disabled={lv >= (master.maxLv || CARD_MAX_LV)}
            className="w-7 h-7 rounded border hover:bg-cat-arcana/10 disabled:opacity-30"
            title="레벨 +1"
          >
            <ChevronRight className="h-4 w-4 inline" />
          </button>
          {(() => {
            const maxLv = master.maxLv || CARD_MAX_LV;
            const atMax = lv >= maxLv;
            return (
              <button
                onClick={() => bumpLv(maxLv - lv)}
                disabled={atMax}
                className="px-2 h-7 rounded border hover:bg-cat-arcana/10 disabled:opacity-30 text-xs font-extrabold tabular-nums"
                title={`최대 레벨(Lv.${maxLv})로 즉시 적용`}
              >
                Lv.{maxLv}
              </button>
            );
          })()}
        </div>
      </div>

      {/* 중앙 — 카드 stats 칩(위) + 스킬 분배 행(아래) */}
      <div className="flex-1 flex flex-col gap-1.5 min-w-0">
        {/* 카드 stats — 레벨업 변동 표기 포함 (master.stats + statPoint × level) */}
        {(() => {
          const eff = getEffectiveCardStats(master, lv);
          const entries = Object.entries(eff);
          if (entries.length === 0) return null;
          return (
            <div className="flex flex-wrap gap-1 pb-1 border-b border-border">
              {entries.map(([k, v]) => {
                const baseVal = master.stats?.[k] || 0;
                const lvBonus = v - baseVal;
                return (
                  <span
                    key={k}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-cat-arcana/40 bg-cat-arcana/10 text-[13px] tabular-nums"
                    title={lvBonus > 0
                      ? `${STAT_LABEL[k] || k}: 기본 ${baseVal} + 레벨업 ${lvBonus} = ${v}`
                      : `${STAT_LABEL[k] || k}: ${v}`}
                  >
                    <span className="font-bold">{STAT_LABEL[k] || k}</span>
                    <span className="font-extrabold text-cat-arcana">+{v}</span>
                    {lvBonus > 0 && (
                      <span className="text-[10px] text-emerald-400">(↑{lvBonus})</span>
                    )}
                  </span>
                );
              })}
            </div>
          );
        })()}
        {cardSkills.length === 0 ? (
          <button
            onClick={onEnterOption}
            className="flex-1 min-h-[80px] flex items-center justify-center gap-2 rounded border-2 border-dashed border-border hover:border-foreground/40 hover:bg-accent/10 transition-colors text-muted-foreground hover:text-foreground"
            title="옵션 모드 진입 — 스킬 활성/비활성 선택"
          >
            <Settings className="h-5 w-5 opacity-60" />
            <span className="text-xs font-bold">옵션 설정 하기</span>
          </button>
        ) : (
          cardSkills.map((sk) => {
            const extra = skillsDraft[sk.id] ?? 0;
            const displayed = 1 + extra; // 옵션 기본 1 + 분배
            const total = getSkillTotalAndClass(sk, liveBuild, arcana, owned).total;
            const lvStyle = skillLevelStyle(sk.category, total);
            const useThreshold = !!lvStyle.containerCls;
            return (
              <Tooltip key={sk.id} delayDuration={150}>
                <TooltipTrigger asChild>
              <div
                className={cn(
                  "flex items-center gap-2 px-2 py-1 rounded border cursor-help",
                  useThreshold ? lvStyle.containerCls : "bg-card"
                )}
              >
                {sk.icon ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sk.icon} alt="" className="w-6 h-6 rounded flex-shrink-0" loading="lazy" />
                ) : (
                  <span className="w-6 h-6 flex items-center justify-center bg-muted/40 rounded text-xs">✨</span>
                )}
                <span className="text-sm font-bold flex-1 truncate">{sk.name}</span>
                <span
                  className={cn(
                    "text-lg font-extrabold tabular-nums w-8 text-right",
                    useThreshold ? "text-foreground" : "text-cat-arcana"
                  )}
                  title={`옵션 기본 1 + 분배 ${extra} · 총 Lv.${total}`}
                >
                  {displayed}
                </span>
                <span className={cn(
                  "inline-flex items-center px-1.5 py-0.5 rounded text-background text-[10px] font-extrabold tabular-nums shadow",
                  lvStyle.lvBg || "bg-cat-arcana"
                )}>
                  Lv.{total}
                </span>
                <div className="flex flex-col gap-0">
                  <button
                    onClick={() => setSkillVal(sk.id, extra + 1)}
                    disabled={remainingSkill <= 0}
                    className="w-6 h-4 rounded-t border border-b-0 hover:bg-cat-arcana/15 disabled:opacity-30 text-[9px]"
                    title="분배 +1"
                  >
                    ▲
                  </button>
                  <button
                    onClick={() => setSkillVal(sk.id, Math.max(0, extra - 1))}
                    disabled={extra <= 0}
                    className="w-6 h-4 rounded-b border hover:bg-cat-arcana/15 disabled:opacity-30 text-[9px]"
                    title="분배 -1"
                  >
                    ▼
                  </button>
                </div>
              </div>
                </TooltipTrigger>
                <TooltipContent side="top" className="max-w-[440px] p-3 bg-card text-card-foreground">
                  <SkillHoverTooltip skill={sk} build={liveBuild} jobId={jobId} />
                </TooltipContent>
              </Tooltip>
            );
          })
        )}
      </div>

    </div>
    </>
  );
}
