"use client";

import { RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CSSProperties } from "react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useSkillStore } from "@/lib/arcana/skill-store";
import { SkillHoverTooltip } from "@/components/arcana/skill-hover-tooltip";

/** 아이템 서브스킬 칩 — 마우스오버 시 아르카나 스킬 툴팁 표시 */
function SkillChipWithTooltip({
  name, level, icon, classId, compact,
}: {
  name: string; level: string | number; icon: string; classId: string; compact: boolean;
}) {
  const arcanaSkill = useSkillStore((s) => {
    // 이름 일치 우선
    return s.skills.find((x) => x.name === name) ?? null;
  });

  const chip = compact ? (
    <div className="inline-flex items-center gap-2 px-2 py-1 rounded border bg-background/60 text-xs cursor-default">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="w-5 h-5 rounded flex-shrink-0" loading="lazy" />
      ) : (
        <span className="text-[14px]">✨</span>
      )}
      <span className="font-bold truncate flex-1">{name}</span>
      {level ? <span className="text-[11px] text-gold-light font-bold flex-shrink-0">Lv.{level}</span> : null}
    </div>
  ) : (
    <div className="flex items-center gap-1.5 text-[11px] cursor-default">
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="w-3.5 h-3.5 rounded flex-shrink-0" loading="lazy" />
      ) : (
        <span className="text-[10px]">✨</span>
      )}
      <span className="font-bold">{name}</span>
      {level ? <span className="text-muted-foreground">Lv.{level}</span> : null}
    </div>
  );

  if (!arcanaSkill) return chip;

  return (
    <Tooltip delayDuration={150}>
      <TooltipTrigger asChild>
        {chip}
      </TooltipTrigger>
      <TooltipContent side="right" className="max-w-[440px] p-3 bg-card text-card-foreground border shadow-xl">
        <SkillHoverTooltip skill={arcanaSkill} build={null} jobId={classId} />
      </TooltipContent>
    </Tooltip>
  );
}

/** 아이템 등급 색상 — equip-dialog.tsx GRADE_HEX와 동일 정의 (V4.0.9 호환).
 *  마석/신석 옵션의 grade도 동일 색상 팔레트 적용. */
const GRADE_HEX: Record<string, string> = {
  Legend:  "#4a9eff",
  Epic:    "#ED4C00",
  Unique:  "#f0c040",
  Special: "#4cc97a",
  Normal:  "",
};
function normalizeGrade(grade: unknown): string {
  if (!grade) return "";
  const g = String(grade).trim();
  if (GRADE_HEX[g]) return g;
  const l = g.toLowerCase();
  if (l === "legend" || l === "legendary") return "Legend";
  if (l === "epic") return "Epic";
  if (l === "unique") return "Unique";
  if (l === "special") return "Special";
  if (g === "전승") return "Legend";
  if (g === "영웅") return "Epic";
  if (g === "유일") return "Unique";
  if (g === "스페셜") return "Special";
  return "";
}
function gradeStyle(grade: unknown): CSSProperties {
  const key = normalizeGrade(grade);
  const c = key ? GRADE_HEX[key] : "";
  return c ? { color: c } : {};
}

type Props = {
  data: any;
  loading?: boolean;
  error?: string | null;
  /** 아르카나용 컴팩트 모드 (subSkills만 칩으로 표시) */
  compact?: boolean;
  /** 스킬 툴팁용 직업 ID (바텍 캐릭터 classId) */
  classId?: string;
};

export function ItemDetailPanel({ data, loading, error, compact, classId = "" }: Props) {
  if (loading) {
    return (
      <div className="text-center py-3 text-xs text-muted-foreground">
        <RefreshCw className="h-3 w-3 animate-spin inline-block mr-1" />
        옵션 불러오는 중…
      </div>
    );
  }
  if (error) {
    return <div className="text-xs text-rose-600 dark:text-rose-300 px-3 py-2 break-all">⚠ {error}</div>;
  }
  if (!data) return null;

  const root: any = data?.item ?? data?.data ?? data?.equipmentItem ?? data;
  const mainStats: any[] = Array.isArray(root?.mainStats) ? root.mainStats : [];
  const subStats: any[]  = Array.isArray(root?.subStats)  ? root.subStats  : [];
  const subSkills: any[] = Array.isArray(root?.subSkills) ? root.subSkills : [];
  const magicStone: any[] = Array.isArray(root?.magicStoneStat) ? root.magicStoneStat : [];
  const godStone: any[]   = Array.isArray(root?.godStoneStat)   ? root.godStoneStat   : [];
  const setName: string = root?.setName ?? root?.setItemName ?? "";

  // 아르카나 컴팩트 모드 — subSkills를 우측에 수직 정렬된 행 카드로 표시
  if (compact) {
    if (!subSkills.length) return <span className="text-xs text-muted-foreground italic">스킬 없음</span>;
    return (
      <div className="flex flex-col gap-1">
        {subSkills.map((o: any, i: number) => {
          const sname = o?.name ?? o?.skillName ?? o?.engraveName ?? o?.optionName ?? "";
          const slv = o?.level ?? o?.skillLevel ?? o?.engraveLevel ?? "";
          const sicon = o?.icon ?? o?.iconUrl ?? "";
          if (!sname) return null;
          return (
            <SkillChipWithTooltip key={i} name={sname} level={slv} icon={sicon} classId={classId} compact />
          );
        })}
      </div>
    );
  }

  const blocks: React.ReactNode[] = [];

  if (setName) {
    blocks.push(
      <div key="set" className="text-[11px]">
        세트: <b className="text-gold-light">{setName}</b>
      </div>
    );
  }

  if (mainStats.length) {
    blocks.push(<StatBlock key="main" title="메인스텟" arr={mainStats} />);
  }

  if (subStats.length || subSkills.length) {
    blocks.push(
      <div key="sub" className="rounded border bg-background/40 px-2 py-1.5">
        <div className="text-[10px] font-bold text-muted-foreground mb-1">⚙ 옵션</div>
        {subStats.length > 0 && <StatRows arr={subStats} />}
        {subSkills.length > 0 && (
          <div className="flex flex-col gap-0.5 mt-1">
            {subSkills.map((o: any, i: number) => {
              const sname = o?.name ?? o?.skillName ?? o?.engraveName ?? "";
              const slv = o?.level ?? o?.skillLevel ?? "";
              const sicon = o?.icon ?? o?.iconUrl ?? "";
              if (!sname) return null;
              return (
                <SkillChipWithTooltip key={i} name={sname} level={slv} icon={sicon} classId={classId} compact={false} />
              );
            })}
          </div>
        )}
      </div>
    );
  }

  if (magicStone.length) {
    blocks.push(<StatBlock key="ms" title="💎 마석" arr={magicStone} colored />);
  }
  if (godStone.length) {
    blocks.push(<StatBlock key="gs" title="🪨 신석" arr={godStone} colored />);
  }

  if (blocks.length === 0) {
    return <div className="text-[11px] text-muted-foreground italic px-2 py-1">옵션 데이터가 없습니다.</div>;
  }

  return <div className="flex flex-col gap-1.5">{blocks}</div>;
}

function StatBlock({ title, arr, colored }: { title: string; arr: any[]; colored?: boolean }) {
  return (
    <div className="rounded border bg-background/40 px-2 py-1.5">
      <div className="text-[10px] font-bold text-muted-foreground mb-1">{title}</div>
      <StatRows arr={arr} colored={colored} />
    </div>
  );
}

function StatRows({ arr, colored }: { arr: any[]; colored?: boolean }) {
  return (
    <div className="flex flex-col gap-0.5 text-[11px]">
      {arr.map((o: any, i: number) => {
        if (!o || typeof o !== "object") return null;
        const nm = o?.name ?? o?.statName ?? o?.optionName ?? "";
        const val = o?.value ?? o?.amount ?? o?.statValue ?? "";
        const desc = o?.description ?? o?.desc ?? o?.tooltip ?? "";
        if (!nm && val === "") return null;
        // grade 색상 — equip-dialog의 GRADE_HEX와 동일. magicStone/godStone에만 적용 (colored=true)
        const gs = colored ? gradeStyle(o?.grade) : undefined;
        return (
          <div key={i}>
            <div className="flex items-center justify-between gap-2">
              <span className="font-semibold truncate" style={gs}>{nm || "—"}</span>
              <span className="font-bold tabular-nums flex-shrink-0" style={gs}>{String(val)}</span>
            </div>
            {desc && <div className="text-[10px] text-muted-foreground italic">{desc}</div>}
          </div>
        );
      })}
    </div>
  );
}
