"use client";

import { useState } from "react";
import { Pencil, Trash2, Check, X } from "lucide-react";
import { useSkillStore } from "@/lib/arcana/skill-store";
import { SPECIAL_EFFECT_LEVELS } from "@/lib/arcana/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Skill, SkillCategory, SpecialEffect } from "@/lib/arcana/types";
import { confirmDialog } from "@/lib/util/confirm";

type Props = {
  skill: Skill;
  effectsOpen: boolean;
  onToggleEffects: () => void;
};

/** 단일 스킬 행 — V4.0.9 renderSkillRow 포팅.
 *  아이콘 / 스킬명(편집) / skillId / 시드 베이스레벨(base+daev) / 데바니온 토글 / 특화 효과 편집기. */
export function SkillRow({ skill, effectsOpen, onToggleEffects }: Props) {
  const patch = useSkillStore((s) => s.patchSkill);
  const remove = useSkillStore((s) => s.removeSkill);

  const [editingName, setEditingName] = useState(false);
  const [draftName, setDraftName] = useState(skill.name);

  const cat = skill.category;
  const effLevels = SPECIAL_EFFECT_LEVELS[cat] ?? [];
  const baseLvText = skill.baseLv
    ? `Lv.${skill.baseLv.base + (skill.daevanion ? skill.baseLv.daevanion : 0)} (기본 ${skill.baseLv.base}${skill.baseLv.daevanion > 0 ? ` + 데바니온 ${skill.baseLv.daevanion}` : ""})`
    : "Lv.?";

  function commitName() {
    const v = draftName.trim();
    if (v && v !== skill.name) patch(skill.id, { name: v });
    setEditingName(false);
  }
  async function handleDelete() {
    if (!(await confirmDialog({ title: "스킬 삭제", description: `'${skill.name}' 스킬을 삭제하시겠습니까?`, confirmText: "삭제", variant: "destructive" }))) return;
    remove(skill.id);
  }

  return (
    <div className="border rounded bg-card/50 px-2 py-1.5">
      {/* 메인 행 */}
      <div className="flex items-center gap-2">
        {/* 아이콘 */}
        {skill.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={skill.icon} alt="" className="w-8 h-8 rounded flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-8 h-8 rounded flex items-center justify-center text-base bg-muted/40 flex-shrink-0">✨</div>
        )}

        {/* 스킬명 */}
        <div className="flex-1 min-w-0">
          {editingName ? (
            <div className="flex items-center gap-1">
              <Input
                value={draftName}
                onChange={(e) => setDraftName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitName();
                  if (e.key === "Escape") { setDraftName(skill.name); setEditingName(false); }
                }}
                className="h-7 text-xs"
                autoFocus
              />
              <Button size="xs" variant="ghost" onClick={commitName}><Check className="h-3 w-3" /></Button>
              <Button size="xs" variant="ghost" onClick={() => { setDraftName(skill.name); setEditingName(false); }}><X className="h-3 w-3" /></Button>
            </div>
          ) : (
            <button
              onClick={() => { setDraftName(skill.name); setEditingName(true); }}
              className="font-extrabold text-sm hover:underline text-left truncate w-full"
              title={`${skill.name} (클릭하여 이름 편집)`}
            >
              {skill.name}
            </button>
          )}
          <div className="text-[10px] text-muted-foreground tabular-nums">
            #{skill.skillId || "—"} · {baseLvText}
          </div>
        </div>

        {/* 데바니온 토글 */}
        <label className="flex items-center gap-1 text-[10px] text-muted-foreground cursor-pointer">
          <Checkbox
            checked={!!skill.daevanion}
            onCheckedChange={(v) => patch(skill.id, { daevanion: !!v })}
          />
          <span>데바니온</span>
        </label>

        {/* 특화 효과 토글 (Active/Dp만) */}
        {effLevels.length > 0 && (
          <Button
            size="xs"
            variant="ghost"
            onClick={onToggleEffects}
            className={cn("border", effectsOpen && "border-cat-arcana text-cat-arcana")}
            title="특화 효과 편집"
          >
            {effectsOpen ? "▲ 특성" : "▼ 특성"}
          </Button>
        )}

        {/* 삭제 */}
        <Button
          size="xs"
          variant="ghost"
          onClick={handleDelete}
          className="text-destructive"
          title="스킬 삭제"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* 특화 효과 편집 영역 */}
      {effectsOpen && effLevels.length > 0 && (
        <SpecialEffectsEditor
          skill={skill}
          levels={effLevels}
          onChange={(effects) => patch(skill.id, { specialEffects: effects })}
        />
      )}
    </div>
  );
}

/** 특화 효과 레벨별 텍스트 입력. V4.0.9 renderSpecialEffectsEditor 동등 — 다중 효과 지원 (1번/2번/3번). */
function SpecialEffectsEditor({
  skill,
  levels,
  onChange,
}: {
  skill: Skill;
  levels: number[];
  onChange: (effects: SpecialEffect[]) => void;
}) {
  const current = skill.specialEffects ?? [];
  // 레벨별 효과 배열로 그룹핑 (한 레벨에 여러 효과)
  const byLevel: Record<number, string[]> = {};
  for (const lv of levels) byLevel[lv] = [];
  for (const e of current) {
    if (typeof e.level === "number" && byLevel[e.level] !== undefined) {
      byLevel[e.level].push(e.text || "");
    }
  }

  function flatten(map: Record<number, string[]>): SpecialEffect[] {
    const next: SpecialEffect[] = [];
    for (const lv of levels) {
      const arr = map[lv] || [];
      for (const t of arr) {
        if (t && t.trim()) next.push({ level: lv, text: t });
      }
    }
    return next;
  }

  function setLvAt(lv: number, idx: number, text: string) {
    const map: Record<number, string[]> = {};
    for (const l of levels) map[l] = [...byLevel[l]];
    map[lv][idx] = text;
    onChange(flatten(map));
  }
  function addAt(lv: number) {
    const map: Record<number, string[]> = {};
    for (const l of levels) map[l] = [...byLevel[l]];
    map[lv].push("");
    onChange(flatten(map));
  }
  function removeAt(lv: number, idx: number) {
    const map: Record<number, string[]> = {};
    for (const l of levels) map[l] = [...byLevel[l]];
    map[lv].splice(idx, 1);
    onChange(flatten(map));
  }

  return (
    <div className="mt-2 pt-2 border-t border-cat-arcana/20 space-y-2">
      <div className="text-[10px] font-bold text-muted-foreground">
        특화 효과 ({levels.join(" / ")} Lv) — 레벨별 다중 효과 지원
      </div>
      {levels.map((lv) => {
        const list = byLevel[lv];
        return (
          <div key={lv} className="rounded border border-cat-arcana/15 bg-background/30 p-1.5 space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded bg-cat-arcana/15 text-cat-arcana text-[10px] font-extrabold tabular-nums">
                Lv.{lv}
              </span>
              <span className="flex-1 text-[10px] text-muted-foreground">{list.length}개 효과</span>
              <button
                onClick={() => addAt(lv)}
                className="text-[10px] text-cat-arcana hover:text-cat-arcana/80 font-bold"
                title="이 레벨에 효과 추가"
              >
                + 효과 추가
              </button>
            </div>
            {list.length === 0 ? (
              <div className="text-[10px] text-muted-foreground italic px-1">(효과 없음)</div>
            ) : (
              list.map((text, idx) => (
                <div key={idx} className="flex items-center gap-1">
                  <span className="text-[10px] text-muted-foreground tabular-nums w-6 text-right">{idx + 1}번</span>
                  <Input
                    value={text}
                    onChange={(e) => setLvAt(lv, idx, e.target.value)}
                    placeholder={`Lv.${lv} #${idx + 1} 효과`}
                    className="h-6 text-[11px] flex-1"
                  />
                  <button
                    onClick={() => removeAt(lv, idx)}
                    className="px-1 text-destructive hover:text-destructive/80"
                    title="제거"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))
            )}
          </div>
        );
      })}
    </div>
  );
}

/** 카테고리 헤더 — V4 동등 */
export function CategoryCardHeader({
  cat,
  count,
  expanded,
  onToggle,
  extraSlotLevels,
  onBulkToggleEffects,
  allEffectsOpen,
}: {
  cat: SkillCategory;
  count: number;
  expanded: boolean;
  onToggle: () => void;
  extraSlotLevels?: readonly number[];
  onBulkToggleEffects?: () => void;
  allEffectsOpen?: boolean;
}) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b bg-cat-arcana/10">
      <button onClick={onToggle} className="flex items-center gap-1 font-extrabold flex-1 text-left">
        <span className="text-sm">{cat === "Active" ? "액티브" : cat === "Passive" ? "패시브" : "스티그마"}</span>
        <span className="text-xs text-muted-foreground">{count}개</span>
      </button>
      {extraSlotLevels && extraSlotLevels.length > 0 && (
        <span className="text-[10px] text-muted-foreground">
          추가 특화 슬롯 개방 {extraSlotLevels.map((lv) => `Lv.${lv}`).join(" / ")}
        </span>
      )}
      {onBulkToggleEffects && count > 0 && (
        <Button size="xs" variant="ghost" onClick={onBulkToggleEffects} className="text-[11px]">
          {allEffectsOpen ? "▲ 특성 일괄 접기" : "▼ 특성 일괄 펼치기"}
        </Button>
      )}
      <Button size="xs" variant="ghost" onClick={onToggle}>
        {expanded ? "▲ 접기" : "▼ 펼치기"}
      </Button>
    </div>
  );
}

/** 단일 카테고리 카드 내 추가 버튼 */
export function AddSkillButton({
  cat,
  jobId,
  jobName,
}: {
  cat: SkillCategory;
  jobId: string;
  jobName: string;
}) {
  const add = useSkillStore((s) => s.addSkill);
  return (
    <Button
      size="sm"
      variant="ghost"
      onClick={() => add({ name: "새 스킬", category: cat, jobId, job: jobName })}
      className="border border-cat-arcana/40 text-cat-arcana"
    >
      <Pencil className="h-3 w-3" /> ＋ 스킬 추가
    </Button>
  );
}
