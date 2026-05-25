"use client";

import { useMemo } from "react";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  ARCANA_BASE_STAT_KEYS,
  ARCANA_EMOJI,
  ARCANA_KO,
  ARCANA_ORDER,
  BASE_STAT_VALUE,
  SETS,
  SET_EFFECT_DATA,
  STAT_LABEL,
} from "@/lib/arcana/constants";
import type { ArcanaBuild, Skill } from "@/lib/arcana/types";
import { cn } from "@/lib/utils";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

/** V4.0.9 renderArcanaRefTable 포팅 — 빌드 헤더 내 세트×슬롯 기본 스텟 매트릭스 + 선택 시 활성 세트 효과.
 *  헤더 hover 시 툴팁:
 *   - 세트 row header → 해당 세트 2장/4장 효과
 *   - 슬롯 column header → 해당 슬롯 + 현재 직업의 적용 가능 스킬 목록 */
export function ArcanaRefTable({ build, jobId }: { build: ArcanaBuild; jobId: string }) {
  const setRefOpen = useArcanaBuildStore((s) => s.setArcanaRefOpen);
  const toggleSel = useArcanaBuildStore((s) => s.toggleArcanaRefSelected);

  const isOpen = !!build.arcanaRefOpen;
  const refSel = build.arcanaRefSelected ?? {};

  // 세트별 선택 개수 — 활성 효과 표시용
  const setCounts = useMemo(() => {
    const out: Array<{ setCode: string; setName: string; season: string; selected: number; total: number }> = [];
    for (const set of SETS) {
      const slotKeys = ARCANA_BASE_STAT_KEYS[set.code] || {};
      let total = 0;
      let selected = 0;
      for (let i = 0; i < ARCANA_ORDER.length; i++) {
        const slot = ARCANA_ORDER[i];
        const stats = slotKeys[slot] || [];
        if (stats.length === 0) continue;
        total++;
        const key = `${set.season}|${set.name}|${i}`;
        if (refSel[key]) selected++;
      }
      if (selected > 0) out.push({ setCode: set.code, setName: set.name, season: set.season, selected, total });
    }
    out.sort((a, b) => b.selected - a.selected);
    return out;
  }, [refSel]);

  return (
    <div className="rounded-lg border bg-card/40">
      <button
        onClick={() => setRefOpen(build.id, !isOpen)}
        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-cat-arcana/10"
      >
        <span className="text-xs font-extrabold flex-1 text-left">
          {isOpen ? "▲" : "▼"} 세트별 기본 스텟 참고표
        </span>
        <span className="text-[10px] text-muted-foreground">
          {Object.keys(refSel).length > 0 ? `${Object.keys(refSel).length}장 선택` : "클릭하여 펼침"}
        </span>
      </button>

      {isOpen && (
        <div className="p-3 grid grid-cols-1 xl:grid-cols-[1fr_320px] gap-3">
          {/* 좌측: 표 */}
          <div className="overflow-auto">
            <div className="inline-block min-w-full">
              {/* 헤더 행 */}
              <div className="grid" style={{ gridTemplateColumns: `120px repeat(${ARCANA_ORDER.length}, minmax(72px, 1fr))` }}>
                <div className="px-2 py-1 text-[10px] font-bold text-muted-foreground bg-muted/30 border rounded-tl text-center">
                  세트 / 슬롯
                </div>
                {ARCANA_ORDER.map((slot) => (
                  <Tooltip key={slot} delayDuration={150}>
                    <TooltipTrigger asChild>
                      <div className="px-2 py-1 text-[10px] font-bold text-center bg-muted/30 border-t border-r border-b cursor-help">
                        {ARCANA_KO[slot]}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="max-w-[440px] p-3 bg-card text-card-foreground">
                      <SlotHeaderTooltipContent slot={slot} jobId={jobId} />
                    </TooltipContent>
                  </Tooltip>
                ))}

                {/* 본문 행 — 세트별 */}
                {SETS.map((set) => {
                  const slotKeys = ARCANA_BASE_STAT_KEYS[set.code] || {};
                  return (
                    <div key={set.code} className="contents">
                      <Tooltip delayDuration={150}>
                        <TooltipTrigger asChild>
                          <div className="px-2 py-1 border-l border-b border-r bg-cat-arcana/5 flex items-center justify-center gap-1.5 cursor-help">
                            <span className="text-[10px] font-bold text-muted-foreground">{set.season}</span>
                            <span className="text-xs font-extrabold text-cat-arcana truncate">{set.name}</span>
                          </div>
                        </TooltipTrigger>
                        <TooltipContent side="right" className="max-w-[440px] p-3 bg-card text-card-foreground">
                          <SetHeaderTooltipContent setCode={set.code} setName={set.name} season={set.season} />
                        </TooltipContent>
                      </Tooltip>
                      {ARCANA_ORDER.map((slot, i) => {
                        const stats = slotKeys[slot] || [];
                        const key = `${set.season}|${set.name}|${i}`;
                        const isSelected = !!refSel[key];
                        const isEmpty = stats.length === 0;
                        return (
                          <button
                            key={key}
                            disabled={isEmpty}
                            onClick={() => !isEmpty && toggleSel(build.id, key)}
                            className={cn(
                              "border-r border-b px-1 py-1 text-center text-[10px] transition-colors",
                              isEmpty
                                ? "bg-muted/10 text-muted-foreground/40 cursor-not-allowed"
                                : isSelected
                                  ? "bg-cat-arcana/20 text-cat-arcana font-bold"
                                  : "hover:bg-cat-arcana/5 cursor-pointer"
                            )}
                            title={
                              isEmpty
                                ? "-"
                                : isSelected
                                  ? "클릭하여 해제"
                                  : "클릭하여 선택"
                            }
                          >
                            {isEmpty
                              ? "—"
                              : stats.map((k) => `${STAT_LABEL[k] || k}+${BASE_STAT_VALUE}`).join(", ")}
                          </button>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 우측: 활성 세트 효과 */}
          <div>
            <div className="text-xs font-extrabold text-muted-foreground mb-2">✨ 적용 세트 효과</div>
            {setCounts.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic">
                좌측 표에서 세트 카드 위치를 클릭하면 적용될 세트 효과가 여기에 표시됩니다.
              </div>
            ) : (
              <div className="space-y-2">
                {setCounts.map(({ setCode, setName, season, selected, total }) => {
                  const setData = SET_EFFECT_DATA[setCode];
                  return (
                    <div key={setCode} className="rounded border bg-card p-2 space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-cat-arcana/20 text-cat-arcana">{season}</span>
                        <span className="text-sm font-extrabold">{setName}</span>
                        <span className="flex-1" />
                        <span className="text-[10px] text-muted-foreground"><b>{selected}</b> / {total}장</span>
                      </div>
                      {[2, 4].map((n) => {
                        const reached = selected >= n;
                        const effs = setData?.[n] || [];
                        return (
                          <div
                            key={n}
                            className={cn(
                              "rounded border p-1.5",
                              reached ? "border-emerald-500/40 bg-emerald-500/5" : "border-border bg-muted/10 opacity-70"
                            )}
                          >
                            <div className="flex items-center gap-2 mb-1">
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-cat-arcana/15 text-cat-arcana">{n}장</span>
                              <span className="text-[10px] font-bold">{reached ? "활성" : "비활성"}</span>
                            </div>
                            {effs.length === 0 ? (
                              <div className="text-[11px] text-muted-foreground italic">(등록된 효과 없음)</div>
                            ) : (
                              <div className="space-y-0.5 text-[11px]">
                                {effs.map((e, i) => (
                                  <div key={i} className="flex items-baseline gap-2">
                                    <span>{e.text}</span>
                                    {e.cond && <span className="text-[10px] text-amber-500">조건: {e.cond}</span>}
                                    {e.cooldownSec && (
                                      <span className="text-[10px] text-muted-foreground">재발동 {e.cooldownSec}초</span>
                                    )}
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 슬롯 헤더 hover — 해당 슬롯의 카드들이 현재 직업에 적용 가능한 스킬 목록.
 *  V4 showArcanaSlotTooltip 포팅. 장착 슬롯 라벨에서도 재사용. */
export function SlotHeaderTooltipContent({ slot, jobId }: { slot: string; jobId: string }) {
  const arcana = useArcanaStore((s) => s.cards);
  const skills = useSkillStore((s) => s.skills);

  const matched = useMemo(() => {
    const ids = new Set<string>();
    for (const c of arcana) {
      if (c.slot !== slot) continue;
      const list = c.skillsByJob?.[jobId] || [];
      for (const id of list) ids.add(id);
    }
    return Array.from(ids)
      .map((id) => skills.find((s) => s.id === id))
      .filter((s): s is Skill => !!s);
  }, [arcana, skills, slot, jobId]);

  const actives = matched.filter((s) => s.category === "Active").sort((a, b) => a.name.localeCompare(b.name));
  const passives = matched.filter((s) => s.category !== "Active").sort((a, b) => a.name.localeCompare(b.name));

  const slotName = ARCANA_KO[slot] || slot;
  const slotEmoji = ARCANA_EMOJI[slot] || "";

  const SkillRow = ({ sk }: { sk: Skill }) => (
    <div className="flex items-center gap-1.5 px-1 py-0.5">
      {sk.icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={sk.icon} alt="" className="w-4 h-4 rounded flex-shrink-0" loading="lazy" />
      ) : (
        <span className="w-4 h-4 inline-flex items-center justify-center bg-muted/40 rounded text-[9px] flex-shrink-0">✨</span>
      )}
      <span className="text-[11px] font-bold truncate flex-1">{sk.name}</span>
      <span className={cn(
        "text-[10px] px-1 rounded",
        sk.category === "Active" ? "bg-cat-arcana/15 text-cat-arcana" : "bg-emerald-500/15 text-emerald-300"
      )}>
        {sk.category === "Active" ? "⚡" : "🛡"}
      </span>
    </div>
  );

  return (
    <div className="text-xs space-y-2 max-w-[420px]">
      <div className="flex items-center gap-2 pb-1 border-b">
        <span className="text-base">{slotEmoji}</span>
        <div className="flex-1 min-w-0">
          <div className="font-extrabold text-sm">{slotName} 적용 스킬</div>
          <div className="text-[10px] text-muted-foreground">{jobId} 기준</div>
        </div>
      </div>
      {matched.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic">(적용 가능 스킬 없음)</div>
      ) : actives.length > 0 && passives.length > 0 ? (
        <div className="grid grid-cols-2 gap-2">
          <div>
            <div className="text-[10px] font-bold text-cat-arcana mb-0.5">
              ⚡ 액티브 <span className="text-muted-foreground">{actives.length}</span>
            </div>
            <div className="space-y-0.5">{actives.map((sk) => <SkillRow key={sk.id} sk={sk} />)}</div>
          </div>
          <div>
            <div className="text-[10px] font-bold text-emerald-400 mb-0.5">
              🛡 패시브 <span className="text-muted-foreground">{passives.length}</span>
            </div>
            <div className="space-y-0.5">{passives.map((sk) => <SkillRow key={sk.id} sk={sk} />)}</div>
          </div>
        </div>
      ) : (
        <div className="space-y-0.5">{[...actives, ...passives].map((sk) => <SkillRow key={sk.id} sk={sk} />)}</div>
      )}
    </div>
  );
}

/** 세트 row header hover — 해당 세트의 2장/4장 효과.
 *  V4 showArcanaSetTooltip 포팅. */
function SetHeaderTooltipContent({ setCode, setName, season }: { setCode: string; setName: string; season: string }) {
  const setData = SET_EFFECT_DATA[setCode] || {};
  return (
    <div className="text-xs space-y-2 max-w-[440px]">
      <div className="flex items-center gap-2 pb-1 border-b">
        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-cat-arcana/20 text-cat-arcana">{season}</span>
        <div className="flex-1">
          <div className="font-extrabold text-sm">{setName}</div>
          <div className="text-[10px] text-muted-foreground">세트 효과</div>
        </div>
      </div>
      {[2, 4].map((n) => {
        const effs = setData[n] || [];
        return (
          <div key={n} className="rounded border bg-background/30 p-1.5">
            <div className="text-[11px] font-bold mb-1">
              <span className="px-1.5 py-0.5 rounded bg-cat-arcana/15 text-cat-arcana">{n}장</span>
            </div>
            {effs.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic">(등록된 효과 없음)</div>
            ) : (
              <div className="space-y-1">
                {effs.map((eff, i) => (
                  <div key={i} className="text-[11px]">
                    <span>{eff.text}</span>
                    {(eff.cond || eff.cooldownSec) && (
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {eff.cond && <span className="mr-1.5">조건: {eff.cond}</span>}
                        {eff.cooldownSec && <span>재발동 {eff.cooldownSec}초</span>}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
