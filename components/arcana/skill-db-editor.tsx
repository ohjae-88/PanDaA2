"use client";

import { useMemo, useState } from "react";
import { Download, RefreshCw } from "lucide-react";
import { CLASSES } from "@/lib/barrack/constants";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  ACTIVE_EXTRA_SLOT_LEVELS,
  ID_TO_JOB_NUM,
  JOB_NUM_TO_ID,
  SKILL_CATS,
} from "@/lib/arcana/constants";
import { importInvenSkillsForJobs } from "@/lib/arcana/inven-fetch";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/util/confirm";
import {
  AddSkillButton,
  CategoryCardHeader,
  SkillRow,
} from "./skill-row";
import type { Skill, SkillCategory } from "@/lib/arcana/types";

/** 메인 스킬 DB 에디터 — V4.0.9 renderSkillDbEditor 포팅.
 *  - 직업 셀렉트 탭바 (8직업)
 *  - Inven 가져오기 툴바 (현재 직업 / 전체)
 *  - 카테고리 카드 3개 (Active/Passive/Dp) — 행 편집기 */
export function SkillDbEditor() {
  const skills = useSkillStore((s) => s.skills);
  const patchSkill = useSkillStore((s) => s.patchSkill);
  const addSkill = useSkillStore((s) => s.addSkill);
  const resetSeed = useSkillStore((s) => s.resetSeed);
  void addSkill;

  const [jobId, setJobId] = useState<string>("guardian");
  const [catExpanded, setCatExpanded] = useState<Record<string, boolean>>({});
  const [effectsOpen, setEffectsOpen] = useState<Record<string, boolean>>({});
  const [fetching, setFetching] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<string>("");

  const cls = CLASSES.find((c) => c.id === jobId) ?? CLASSES[0];
  const jobName = cls.name;
  const jobNum = ID_TO_JOB_NUM[cls.id];

  const jobSkills = useMemo(
    () => skills.filter((s) => s.jobId === cls.id || s.job === cls.name),
    [skills, cls.id, cls.name]
  );

  function toggleCatExpand(cat: SkillCategory) {
    const key = `${cls.id}_${cat}`;
    setCatExpanded((s) => ({ ...s, [key]: !s[key] }));
  }
  function toggleEffectsOpen(id: string) {
    setEffectsOpen((s) => ({ ...s, [id]: !s[id] }));
  }
  function bulkToggleEffects(catSkills: Skill[]) {
    const allOpen = catSkills.every((s) => effectsOpen[s.id]);
    setEffectsOpen((cur) => {
      const next = { ...cur };
      if (allOpen) {
        for (const s of catSkills) next[s.id] = false;
      } else {
        for (const s of catSkills) next[s.id] = true;
      }
      return next;
    });
  }

  /** Inven fetch + confirm dialog 흐름 */
  async function runFetch(jobNums: number[]) {
    setFetching(true);
    const isAll = jobNums.length > 1;
    setFetchStatus(isAll ? `⏳ 전체 ${jobNums.length}개 직업 데이터 로딩 중…` : "");
    try {
      const result = await importInvenSkillsForJobs(jobNums, skills, setFetchStatus);
      // updated 자동 적용
      const updatedList = (result as ImportResultWithList)._updatedList ?? [];
      for (const sk of updatedList) {
        patchSkill(sk.id, {
          name: sk.name,
          category: sk.category,
          skillId: sk.skillId,
          specialEffects: sk.specialEffects,
        });
      }
      const errPart = result.errors.length ? `  ⚠ 오류: ${result.errors.join(" / ")}` : "";

      if (result.newSkills.length > 0) {
        setFetchStatus(`갱신 ${result.updated}개 완료 — 신규 스킬 ${result.newSkills.length}개 추가 여부 확인 필요`);
        // 직업·카테고리별 신규 요약
        const byJob: Record<string, Record<SkillCategory, number>> = {};
        for (const s of result.newSkills) {
          const job = s.job || s.jobId || "?";
          if (!byJob[job]) byJob[job] = { Active: 0, Passive: 0, Dp: 0 };
          byJob[job][s.category] = (byJob[job][s.category] || 0) + 1;
        }
        const lines = Object.entries(byJob).map(([job, cats]) => {
          const parts: string[] = [];
          if (cats.Active) parts.push(`액티브 ${cats.Active}`);
          if (cats.Passive) parts.push(`패시브 ${cats.Passive}`);
          if (cats.Dp) parts.push(`스티그마 ${cats.Dp}`);
          return `  ${job}: ${parts.join(" · ")}개`;
        });
        const msg =
          `기존 스킬 DB에 없는 신규 스킬 ${result.newSkills.length}개가 발견되었습니다.\n` +
          `스킬 목록에 추가하시겠습니까?\n\n` +
          lines.join("\n");
        if (await confirmDialog({ title: "신규 스킬 추가", description: msg, confirmText: "추가" })) {
          for (const sk of result.newSkills) addSkill(sk);
          setFetchStatus(`✓ 갱신 ${result.updated}개, 추가 ${result.newSkills.length}개${errPart}`);
        } else {
          setFetchStatus(`✓ 갱신 ${result.updated}개 (신규 ${result.newSkills.length}개 추가 안 함)${errPart}`);
        }
      } else {
        setFetchStatus(`✓ 갱신 ${result.updated}개, 신규 없음${errPart}`);
      }
    } catch (e) {
      setFetchStatus(`⚠ ${(e as Error).message}`);
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 직업 셀렉트 바 */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-xs text-muted-foreground mr-2">직업</span>
        {CLASSES.map((c) => {
          const active = c.id === jobId;
          return (
            <button
              key={c.id}
              onClick={() => setJobId(c.id)}
              className={cn(
                "inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-bold transition-colors",
                active
                  ? "border-cat-arcana bg-cat-arcana/15 text-cat-arcana"
                  : "border-border hover:bg-accent/10"
              )}
            >
              <span>{c.icon}</span>
              <span>{c.name}</span>
            </button>
          );
        })}
      </div>

      {/* Inven 가져오기 툴바 */}
      <div className="flex items-center gap-2 flex-wrap p-2 rounded border border-cat-arcana/30 bg-cat-arcana/5">
        <Button
          size="sm"
          variant="ghost"
          disabled={fetching || !jobNum}
          onClick={() => jobNum && runFetch([jobNum])}
          title={`Inven에서 ${cls.name} 스킬 이름·특화 효과를 자동으로 불러옵니다.`}
        >
          {fetching ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          ⬇ {cls.name} 가져오기
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={fetching}
          onClick={() => runFetch(Object.keys(JOB_NUM_TO_ID).map(Number))}
          title="Inven에서 전체 8개 직업 스킬 이름·특화 효과를 일괄 불러옵니다."
        >
          {fetching ? <RefreshCw className="h-3 w-3 animate-spin" /> : <Download className="h-3 w-3" />}
          ⬇ 전체 직업
        </Button>
        <Button
          size="sm"
          variant="ghost"
          disabled={fetching}
          onClick={async () => {
            if (!(await confirmDialog({ title: "스킬 DB 초기화", description: "스킬 DB를 시드 기본값으로 초기화합니다.\n사용자 편집 내용이 사라집니다.", confirmText: "초기화", variant: "destructive" }))) return;
            resetSeed();
            setFetchStatus("✓ 시드 데이터로 초기화됨");
          }}
          className="text-amber-500 border border-amber-500/40"
          title="모든 스킬을 시드 기본값으로 초기화"
        >
          시드 리셋
        </Button>
        <span className={cn("text-[11px] italic flex-1", fetchStatus.startsWith("⚠") ? "text-rose-400" : "text-muted-foreground")}>
          {fetchStatus}
        </span>
      </div>

      {/* 카테고리 카드 3개 */}
      {SKILL_CATS.map((cat) => {
        const key = `${cls.id}_${cat}`;
        const expanded = !!catExpanded[key];
        const catSkills = jobSkills.filter((s) => s.category === cat);
        const allOpen = catSkills.length > 0 && catSkills.every((s) => effectsOpen[s.id]);
        return (
          <div key={cat} className="rounded-lg border bg-card overflow-hidden">
            <CategoryCardHeader
              cat={cat}
              count={catSkills.length}
              expanded={expanded}
              onToggle={() => toggleCatExpand(cat)}
              extraSlotLevels={cat === "Active" ? ACTIVE_EXTRA_SLOT_LEVELS : undefined}
              onBulkToggleEffects={(cat === "Active" || cat === "Dp") ? () => bulkToggleEffects(catSkills) : undefined}
              allEffectsOpen={allOpen}
            />
            {expanded && (
              <div className="p-2 space-y-1.5">
                {catSkills.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground italic py-4">스킬 없음</div>
                ) : (
                  catSkills.map((sk) => (
                    <SkillRow
                      key={sk.id}
                      skill={sk}
                      effectsOpen={!!effectsOpen[sk.id]}
                      onToggleEffects={() => toggleEffectsOpen(sk.id)}
                    />
                  ))
                )}
                <AddSkillButton cat={cat} jobId={cls.id} jobName={cls.name} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

/** importInvenSkillsForJobs 반환 타입의 `_updatedList` 확장 */
type ImportResultWithList = {
  _updatedList?: Skill[];
};
