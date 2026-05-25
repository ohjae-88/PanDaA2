"use client";

import { useMemo, useState } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  EQUIP_KINDS,
  EQUIP_KIND_BY_CODE,
  SKILL_CAT_KO,
  equipSlotLabel,
} from "@/lib/arcana/constants";
import { computeEquipSkillTotals } from "@/lib/arcana/compute";
import { cn } from "@/lib/utils";
import type { ArcanaBuild, EquipSlotInstance, SkillCategory } from "@/lib/arcana/types";

/** V4.0.9 renderEquipSkill 포팅 — 장비별 스킬 부여 (V4 그룹화: 무기/방어구/악세) */
const GROUP_DEF = [
  { key: "weapon",  label: "⚔ 무기",    kinds: ["weapon", "shield"] },
  { key: "armor",   label: "🛡 방어구",  kinds: ["helmet", "shoulder", "torso", "pants", "gloves", "cape", "boots"] },
  { key: "accessory", label: "💍 악세",   kinds: ["earring", "necklace", "ring"] },
] as const;

export function EquipSkillPanel({ build, jobId }: { build: ArcanaBuild; jobId: string }) {
  const skills = useSkillStore((s) => s.skills);
  const addEquipSlot = useArcanaBuildStore((s) => s.addEquipSlot);
  const removeEquipSlot = useArcanaBuildStore((s) => s.removeEquipSlot);
  const setEquipSlotSkill = useArcanaBuildStore((s) => s.setEquipSlotSkill);
  const clearEquipSlotSkill = useArcanaBuildStore((s) => s.clearEquipSlotSkill);

  const [addKind, setAddKind] = useState<string>("");
  const [addOpen, setAddOpen] = useState<string | null>(null);
  const [groupCollapsed, setGroupCollapsed] = useState<Record<string, boolean>>({});

  // 그룹별 분류
  const byGroup = useMemo(() => {
    const out: Record<string, EquipSlotInstance[]> = {};
    for (const g of GROUP_DEF) out[g.key] = [];
    const others: EquipSlotInstance[] = [];
    for (const es of build.equipSlots) {
      const g = GROUP_DEF.find((g) => (g.kinds as readonly string[]).includes(es.kind));
      if (g) out[g.key].push(es);
      else others.push(es);
    }
    return { out, others };
  }, [build.equipSlots]);

  // 합산: 총 장비 슬롯, 부여된 스킬 개수, 고유 스킬 개수
  const totals = useMemo(() => {
    const allSkills = new Set<string>();
    let totalAssigned = 0;
    for (const es of build.equipSlots) {
      for (const sid of Object.keys(es.skills || {})) {
        if ((es.skills?.[sid] || 0) > 0) {
          allSkills.add(sid);
          totalAssigned++;
        }
      }
    }
    return { slotCount: build.equipSlots.length, totalAssigned, uniqueCount: allSkills.size };
  }, [build.equipSlots]);

  // 장비 스킬 집계 — skillId → 총합 (카테고리별 분류)
  const skillTotals = useMemo(() => {
    const sums = computeEquipSkillTotals(build);
    const byCat: Record<SkillCategory, { sk: import("@/lib/arcana/types").Skill; total: number }[]> = {
      Active: [], Passive: [], Dp: [],
    };
    for (const [sid, total] of Object.entries(sums)) {
      if (total <= 0) continue;
      const sk = skills.find((s) => s.id === sid);
      if (!sk) continue;
      byCat[sk.category].push({ sk, total });
    }
    // 정렬 — total 내림차순
    (Object.keys(byCat) as SkillCategory[]).forEach((c) =>
      byCat[c].sort((a, b) => b.total - a.total)
    );
    return byCat;
  }, [build, skills]);
  const hasEquipSkills = skillTotals.Active.length + skillTotals.Passive.length + skillTotals.Dp.length > 0;

  function handleAdd() {
    if (!addKind) return;
    addEquipSlot(build.id, addKind);
    setAddKind("");
  }
  function toggleGroup(k: string) {
    setGroupCollapsed((s) => ({ ...s, [k]: !s[k] }));
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="flex items-center gap-2">
        <span className="text-xs font-extrabold text-muted-foreground flex-1">🛡 장비 스킬 포인트</span>
        <span className="text-[10px] text-muted-foreground">
          장비 {totals.slotCount}부위 · 배치된 스킬 <b className="text-cat-arcana">{totals.totalAssigned}</b>개 (고유 {totals.uniqueCount}종)
        </span>
        <Select value={addKind || "_none"} onValueChange={(v) => setAddKind(v === "_none" ? "" : v)}>
          <SelectTrigger className="h-7 w-[140px] text-xs"><SelectValue placeholder="추가 장비" /></SelectTrigger>
          <SelectContent>
            {EQUIP_KINDS.filter((k) => !("hidden" in k && k.hidden)).map((k) => (
              <SelectItem key={k.code} value={k.code}>{k.emoji} {k.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button size="xs" variant="ghost" onClick={handleAdd} disabled={!addKind}>
          <Plus className="h-3 w-3" /> 장비 추가
        </Button>
      </div>

      {/* 장비 스킬 집계 카드 — 카테고리별 (Active/Passive/Dp), 부여 합산 표시 */}
      {hasEquipSkills && (
        <div className="rounded border border-cat-arcana/30 bg-cat-arcana/5 p-2 space-y-1.5">
          <div className="text-[11px] font-bold text-cat-arcana">📊 장비 스킬 집계</div>
          {(["Active", "Passive", "Dp"] as SkillCategory[]).map((cat) => {
            const list = skillTotals[cat];
            if (list.length === 0) return null;
            return (
              <div key={cat} className="space-y-1">
                <div className="text-[10px] font-bold text-muted-foreground">
                  {cat === "Active" ? "⚡" : cat === "Passive" ? "🛡" : "📿"} {SKILL_CAT_KO[cat]}
                  <span className="text-muted-foreground/70 ml-1">{list.length}</span>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-1">
                  {list.map(({ sk, total }) => (
                    <div
                      key={sk.id}
                      className="flex items-center gap-1.5 px-1.5 py-1 rounded border border-cat-arcana/40 bg-background/40"
                      title={`${sk.name} — 부여 합계 +${total}`}
                    >
                      {sk.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sk.icon} alt="" className="w-5 h-5 rounded flex-shrink-0" loading="lazy" />
                      ) : (
                        <span className="w-5 h-5 inline-flex items-center justify-center bg-muted/40 rounded text-[10px] flex-shrink-0">✨</span>
                      )}
                      <span className="text-[11px] font-bold flex-1 truncate">{sk.name}</span>
                      <span className="inline-flex items-center px-1.5 py-0 rounded bg-cat-arcana text-background text-[10px] font-extrabold tabular-nums shadow">
                        +{total}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {GROUP_DEF.map((g) => {
        const list = byGroup.out[g.key] || [];
        const collapsed = !!groupCollapsed[g.key];
        return (
          <div key={g.key} className="rounded border border-cat-arcana/30 bg-background/20">
            <button
              onClick={() => toggleGroup(g.key)}
              className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-cat-arcana/5"
            >
              <span className="text-xs">{collapsed ? "▶" : "▼"}</span>
              <span className="text-xs font-extrabold text-cat-arcana flex-1 text-left">{g.label}</span>
              <span className="text-[10px] text-muted-foreground">({list.length})</span>
            </button>
            {!collapsed && (
              <div className="p-1.5 grid grid-cols-1 md:grid-cols-2 gap-1.5">
                {list.length === 0 ? (
                  <div className="col-span-full text-[11px] text-muted-foreground italic text-center py-1">슬롯 없음</div>
                ) : (
                  list.map((es) => (
                    <EquipSlotRow
                      key={es.id}
                      build={build}
                      es={es}
                      jobId={jobId}
                      skills={skills}
                      addOpen={addOpen === es.id}
                      onToggleAdd={() => setAddOpen(addOpen === es.id ? null : es.id)}
                      onAddSkill={(sid) => { setEquipSlotSkill(build.id, es.id, sid, 1); setAddOpen(null); }}
                      onSetPoint={(sid, v) => setEquipSlotSkill(build.id, es.id, sid, v)}
                      onClearSkill={(sid) => clearEquipSlotSkill(build.id, es.id, sid)}
                      onRemove={() => removeEquipSlot(build.id, es.id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {byGroup.others.length > 0 && (
        <div className="rounded border border-amber-500/30 bg-amber-500/5 p-2">
          <div className="text-xs font-extrabold text-amber-500 mb-1">(기타 / 미분류)</div>
          <div className="space-y-1.5">
            {byGroup.others.map((es) => (
              <EquipSlotRow
                key={es.id}
                build={build}
                es={es}
                jobId={jobId}
                skills={skills}
                addOpen={addOpen === es.id}
                onToggleAdd={() => setAddOpen(addOpen === es.id ? null : es.id)}
                onAddSkill={(sid) => { setEquipSlotSkill(build.id, es.id, sid, 1); setAddOpen(null); }}
                onSetPoint={(sid, v) => setEquipSlotSkill(build.id, es.id, sid, v)}
                onClearSkill={(sid) => clearEquipSlotSkill(build.id, es.id, sid)}
                onRemove={() => removeEquipSlot(build.id, es.id)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

/** V4 동등 — 슬롯 한 줄 행: [이모지 + 라벨 + (스킬 개수) + ＋ 버튼].
 *  ＋ 클릭 시 펼침 — 부여 스킬 칩 + 추가 후보 그리드. */
function EquipSlotRow({
  build, es, jobId, skills, addOpen, onToggleAdd, onAddSkill, onSetPoint, onClearSkill, onRemove,
}: {
  build: ArcanaBuild;
  es: EquipSlotInstance;
  jobId: string;
  skills: import("@/lib/arcana/types").Skill[];
  addOpen: boolean;
  onToggleAdd: () => void;
  onAddSkill: (skillId: string) => void;
  onSetPoint: (skillId: string, point: number) => void;
  onClearSkill: (skillId: string) => void;
  onRemove: () => void;
}) {
  const kind = EQUIP_KIND_BY_CODE[es.kind];
  const cats = (kind?.cats || []) as readonly string[];
  const slotSkills = Object.entries(es.skills || {});
  void build;

  // 추가 가능 스킬 — 직업+카테고리 일치 + 이미 부여된 것 제외
  const candidates = skills.filter(
    (s) => s.jobId === jobId && cats.includes(s.category) && !(s.id in (es.skills || {}))
  );

  const hasSkills = slotSkills.length > 0;
  const expanded = addOpen || hasSkills;

  return (
    <div className={cn(
      "rounded border bg-background/30",
      expanded ? "p-1.5 space-y-1" : "p-0"
    )}>
      {/* 행 헤더 — V4 컴팩트 */}
      <div className={cn(
        "flex items-center gap-1.5 px-2 py-1.5",
        !expanded && "hover:bg-accent/10 cursor-pointer rounded"
      )}>
        <span className="text-sm">{kind?.emoji ?? "🎽"}</span>
        <span className="font-bold text-xs flex-1 truncate">{equipSlotLabel(es)}</span>
        {hasSkills && (
          <span className="text-[10px] text-cat-arcana font-bold tabular-nums">
            {slotSkills.length}
          </span>
        )}
        <button
          onClick={onToggleAdd}
          className={cn(
            "inline-flex items-center justify-center w-6 h-6 rounded border text-xs",
            addOpen
              ? "border-cat-arcana bg-cat-arcana/15 text-cat-arcana"
              : "border-border hover:bg-cat-arcana/10 hover:border-cat-arcana"
          )}
          title="스킬 추가/관리"
        >
          {addOpen ? <X className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
        </button>
        <button
          onClick={onRemove}
          className="inline-flex items-center justify-center w-5 h-5 rounded hover:bg-destructive/15 text-destructive opacity-40 hover:opacity-100"
          title="장비 슬롯 제거"
        >
          <Trash2 className="h-2.5 w-2.5" />
        </button>
      </div>

      {/* 부여된 스킬 칩 — 항상 표시 (있을 때) */}
      {hasSkills && (
        <div className="flex flex-wrap gap-1 px-1">
          {slotSkills.map(([sid, pt]) => {
            const sk = skills.find((x) => x.id === sid);
            return (
              <div
                key={sid}
                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-cat-arcana/40 bg-cat-arcana/10 text-[11px]"
              >
                {sk?.icon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={sk.icon} alt="" className="w-3 h-3 rounded" loading="lazy" />
                )}
                <span className="font-bold">{sk?.name || sid}</span>
                <Input
                  type="number"
                  min={0}
                  value={pt}
                  onChange={(e) => onSetPoint(sid, parseInt(e.target.value) || 0)}
                  className="h-5 w-10 px-1 tabular-nums text-[11px]"
                />
                <button
                  onClick={() => onClearSkill(sid)}
                  className="text-muted-foreground hover:text-destructive"
                  title="제거"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {/* 스킬 추가 후보 — ＋ 클릭 시 펼침 */}
      {addOpen && (
        <div className="rounded border bg-card/40 p-1.5 mx-1 mb-1">
          <div className="text-[10px] text-muted-foreground mb-1">
            추가 가능 ({SKILL_CAT_KO[cats[0] as keyof typeof SKILL_CAT_KO]}
            {cats.length > 1 && ` / ${SKILL_CAT_KO[cats[1] as keyof typeof SKILL_CAT_KO]}`})
          </div>
          {candidates.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic">추가 가능한 스킬 없음</div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
              {candidates.map((sk) => (
                <button
                  key={sk.id}
                  onClick={() => onAddSkill(sk.id)}
                  className="flex items-center gap-1.5 px-1.5 py-1 rounded border text-[11px] hover:bg-cat-arcana/10 hover:border-cat-arcana"
                >
                  {sk.icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={sk.icon} alt="" className="w-4 h-4 rounded" loading="lazy" />
                  )}
                  <span className="flex-1 truncate text-left">{sk.name}</span>
                  <span className="text-[9px] opacity-60">{SKILL_CAT_KO[sk.category]}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
