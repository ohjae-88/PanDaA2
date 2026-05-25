"use client";

import { useMemo, useState } from "react";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { SKILL_CATS, SKILL_CAT_KO } from "@/lib/arcana/constants";
import { getSkillTotalAndClass } from "@/lib/arcana/compute";
import { skillLevelStyle } from "@/lib/arcana/skill-style";
import type { ArcanaBuild, Skill, SkillCategory } from "@/lib/arcana/types";
import { cn } from "@/lib/utils";
import { PassiveBaselineDialog } from "./passive-baseline-dialog";
import { Pencil } from "lucide-react";
import { SkillSourceDialog } from "./skill-source-dialog";
import { SkillHoverTooltip } from "./skill-hover-tooltip";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** V4.0.9 renderSkillList 포팅 — 직업별 스킬 합산 표시 */
export function SkillListPanel({ build, jobId }: { build: ArcanaBuild; jobId: string }) {
  const skills = useSkillStore((s) => s.skills);
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  // build store에서 직접 selector — props build의 stale 가능성 차단
  const liveBuild = useArcanaBuildStore((s) => s.builds.find((b) => b.id === build.id)) || build;

  const jobSkills = useMemo(
    () => skills.filter((s) => s.jobId === jobId),
    [skills, jobId]
  );

  const byCat: Record<SkillCategory, Skill[]> = useMemo(() => {
    const m: Record<SkillCategory, Skill[]> = { Active: [], Passive: [], Dp: [] };
    for (const s of jobSkills) m[s.category].push(s);
    return m;
  }, [jobSkills]);

  const [sourceSkillId, setSourceSkillId] = useState<string | null>(null);
  // 스티그마 — 기본 접기
  const [dpOpen, setDpOpen] = useState(false);
  // 패시브 기본/데바 수정 다이얼로그
  const [passiveEditOpen, setPassiveEditOpen] = useState(false);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-xs font-extrabold text-muted-foreground">✨ 스킬 총합 — 액티브 / 패시브</span>
        <span className="text-[10px] text-muted-foreground">기본 + 데바 + 카드 + 장비</span>
      </div>
      <SkillSourceDialog
        open={!!sourceSkillId}
        build={liveBuild}
        jobId={jobId}
        skillId={sourceSkillId}
        onClose={() => setSourceSkillId(null)}
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {(["Active", "Passive"] as const).map((cat) => {
          const list = byCat[cat];
          return (
            <div key={cat} className="rounded border border-cat-arcana/30 bg-background/30 p-2">
              <div className="flex items-center gap-2 mb-2 border-b border-cat-arcana/20 pb-1">
                <span className="text-cat-arcana font-extrabold text-xs">
                  {cat === "Active" ? "⚡" : "🛡"} {SKILL_CAT_KO[cat]}
                </span>
                <span className="text-[10px] text-muted-foreground flex-1">{list.length}</span>
                {cat === "Passive" && (
                  <button
                    onClick={() => setPassiveEditOpen(true)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-border text-[10px] font-bold hover:bg-cat-arcana/10 hover:border-cat-arcana hover:text-cat-arcana"
                    title="패시브 기본 / 데바니온 수정"
                  >
                    <Pencil className="h-3 w-3" /> 수정
                  </button>
                )}
              </div>
              {list.length === 0 ? (
                <div className="text-[11px] text-muted-foreground italic">스킬 없음</div>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
                  {list.map((sk) => {
                    const { total, base } = getSkillTotalAndClass(sk, liveBuild, arcana, owned);
                    const lvStyle = skillLevelStyle(sk.category, total);
                    const isThreshold = !!lvStyle.containerCls;
                    return (
                      <Tooltip key={sk.id} delayDuration={150}>
                        <TooltipTrigger asChild>
                          <button
                            onClick={() => setSourceSkillId(sk.id)}
                            className={cn(
                              "flex items-stretch gap-1.5 rounded border p-1.5 text-xs transition-colors",
                              isThreshold
                                ? lvStyle.containerCls
                                : total > base
                                  ? "border-cat-arcana/50 bg-cat-arcana/5 hover:bg-cat-arcana/15"
                                  : "border-border bg-background/40 hover:bg-accent/10"
                            )}
                          >
                            {sk.icon ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={sk.icon} alt="" className="w-12 h-12 rounded flex-shrink-0 self-center" loading="lazy" />
                            ) : (
                              <span className="w-12 h-12 flex items-center justify-center bg-muted/40 rounded text-lg flex-shrink-0 self-center">✨</span>
                            )}
                            <div className="flex flex-col justify-between flex-1 min-w-0 gap-1 py-0.5">
                              <span className="text-[12px] font-bold truncate text-left">{sk.name}</span>
                              <span className={cn(
                                "inline-flex items-center px-1.5 py-0 rounded text-background text-[11px] font-extrabold tabular-nums shadow self-end",
                                lvStyle.lvBg || "bg-cat-arcana"
                              )}>
                                Lv.{total}
                              </span>
                            </div>
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[440px] p-3 bg-card text-card-foreground">
                          <SkillHoverTooltip skill={sk} build={liveBuild} jobId={jobId} />
                        </TooltipContent>
                      </Tooltip>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* 스티그마 (Dp) — 별도 영역, 접기/펼치기 (기본 접기), Lv 표기 제외, 5/줄 */}
      {byCat.Dp.length > 0 && (
        <div className="rounded border border-cat-arcana/30 bg-background/30 p-2">
          <button
            onClick={() => setDpOpen((v) => !v)}
            className="w-full flex items-center gap-2 mb-2 border-b border-cat-arcana/20 pb-1 hover:opacity-80"
            title={dpOpen ? "스티그마 접기" : "스티그마 펼치기"}
          >
            <span className="text-cat-arcana font-extrabold text-xs">📿 {SKILL_CAT_KO.Dp}</span>
            <span className="text-[10px] text-muted-foreground flex-1 text-left">{byCat.Dp.length}</span>
            <span className="text-[10px] font-bold text-muted-foreground">
              {dpOpen ? "▲ 접기" : "▼ 펼치기"}
            </span>
          </button>
          {dpOpen && (
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-1.5">
              {byCat.Dp.map((sk) => {
                const { total, base } = getSkillTotalAndClass(sk, liveBuild, arcana, owned);
                // 스티그마는 임계치 강조도 제외 — 단순 표기
                const enhanced = total > base;
                return (
                  <Tooltip key={sk.id} delayDuration={150}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => setSourceSkillId(sk.id)}
                        className={cn(
                          "flex items-center gap-2 rounded border p-1.5 text-xs transition-colors text-left",
                          enhanced
                            ? "border-cat-arcana/50 bg-cat-arcana/5 hover:bg-cat-arcana/15"
                            : "border-border bg-background/40 hover:bg-accent/10"
                        )}
                      >
                        {sk.icon ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={sk.icon} alt="" className="w-10 h-10 rounded flex-shrink-0" loading="lazy" />
                        ) : (
                          <span className="w-10 h-10 flex items-center justify-center bg-muted/40 rounded text-base flex-shrink-0">✨</span>
                        )}
                        <span className="text-[12px] font-bold truncate flex-1 min-w-0">{sk.name}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[440px] p-3 bg-card text-card-foreground">
                      <SkillHoverTooltip skill={sk} build={liveBuild} jobId={jobId} />
                    </TooltipContent>
                  </Tooltip>
                );
              })}
            </div>
          )}
        </div>
      )}

      <PassiveBaselineDialog
        open={passiveEditOpen}
        jobId={jobId}
        onClose={() => setPassiveEditOpen(false)}
      />
    </div>
  );
}
