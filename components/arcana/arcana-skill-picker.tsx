"use client";

import { useMemo, useState } from "react";
import { X } from "lucide-react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CLASSES } from "@/lib/barrack/constants";
import { useSkillStore } from "@/lib/arcana/skill-store";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { CARD_SKILL_SLOTS, SKILL_CATS, SKILL_CAT_KO } from "@/lib/arcana/constants";
import { cn } from "@/lib/utils";
import type { ArcanaCard, SkillCategory } from "@/lib/arcana/types";
import { confirmDialog } from "@/lib/util/confirm";

type Props = {
  open: boolean;
  cardId: string | null;
  onClose: () => void;
};

/** V4.0.9 openArcanaSkillPicker / renderArcanaSkillPicker 포팅.
 *  카드의 직업별 적용 스킬 N개(CARD_SKILL_SLOTS=4) 선택. */
export function ArcanaSkillPickerDialog({ open, cardId, onClose }: Props) {
  const card = useArcanaStore((s) => (cardId ? s.cards.find((c) => c.id === cardId) : null));
  const setCardSkillsForJob = useArcanaStore((s) => s.setCardSkillsForJob);
  const skills = useSkillStore((s) => s.skills);

  const [jobId, setJobId] = useState<string>("guardian");
  const [catFilter, setCatFilter] = useState<SkillCategory | "all">("all");
  const [query, setQuery] = useState("");

  const cur: string[] = useMemo(() => {
    if (!card) return [];
    return card.skillsByJob?.[jobId] ?? [];
  }, [card, jobId]);

  const jobSkills = useMemo(
    () =>
      skills.filter((s) => {
        const matchJob = s.jobId === jobId;
        if (!matchJob) return false;
        if (catFilter !== "all" && s.category !== catFilter) return false;
        if (query.trim()) {
          const q = query.toLowerCase();
          if (!s.name.toLowerCase().includes(q) && !String(s.skillId).includes(q)) return false;
        }
        return true;
      }),
    [skills, jobId, catFilter, query]
  );

  if (!card) return null;

  function toggle(skillId: string) {
    if (!card) return;
    const has = cur.includes(skillId);
    let next: string[];
    if (has) {
      next = cur.filter((x) => x !== skillId);
    } else {
      if (cur.length >= CARD_SKILL_SLOTS) {
        // 첫 항목 제거 후 끝에 추가 (FIFO)
        next = [...cur.slice(1), skillId];
      } else {
        next = [...cur, skillId];
      }
    }
    setCardSkillsForJob(card.id, jobId, next);
  }

  async function clear() {
    if (!card) return;
    if (!(await confirmDialog({
      title: "스킬 비우기",
      description: `'${card.name}' 카드의 ${CLASSES.find((c) => c.id === jobId)?.name} 적용 스킬을 모두 비우시겠습니까?`,
      confirmText: "비우기",
      variant: "destructive",
    }))) return;
    setCardSkillsForJob(card.id, jobId, []);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>🃏 카드 적용 스킬 — {card.name}</DialogTitle>
        </DialogHeader>

        <div className="text-[11px] text-muted-foreground">
          카드당 직업별 최대 <b>{CARD_SKILL_SLOTS}개</b> 스킬 선택. 한도 초과 시 가장 오래된 항목이 자동 제거됨.
        </div>

        {/* 직업 탭 */}
        <div className="flex items-center gap-1 flex-wrap">
          {CLASSES.map((c) => {
            const cnt = (card.skillsByJob?.[c.id] || []).length;
            const active = c.id === jobId;
            return (
              <button
                key={c.id}
                onClick={() => setJobId(c.id)}
                className={cn(
                  "inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-bold",
                  active
                    ? "border-cat-arcana bg-cat-arcana/15 text-cat-arcana"
                    : "border-border hover:bg-accent/10"
                )}
              >
                <span>{c.icon}</span>
                <span>{c.name}</span>
                <span className="text-[10px] opacity-70 tabular-nums">{cnt}/{CARD_SKILL_SLOTS}</span>
              </button>
            );
          })}
        </div>

        {/* 필터 */}
        <div className="flex items-center gap-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="스킬명 / 스킬 ID 검색"
            className="h-8 text-xs flex-1"
          />
          <div className="flex items-center gap-1">
            <button
              onClick={() => setCatFilter("all")}
              className={cn("px-2 py-1 rounded border text-xs font-bold",
                catFilter === "all" ? "border-cat-arcana text-cat-arcana bg-cat-arcana/10" : "border-border")}
            >전체</button>
            {SKILL_CATS.map((c) => (
              <button
                key={c}
                onClick={() => setCatFilter(c)}
                className={cn("px-2 py-1 rounded border text-xs font-bold",
                  catFilter === c ? "border-cat-arcana text-cat-arcana bg-cat-arcana/10" : "border-border")}
              >{SKILL_CAT_KO[c]}</button>
            ))}
          </div>
          <Button size="sm" variant="ghost" onClick={clear} className="text-amber-500" title="현재 직업 슬롯 비우기">
            <X className="h-3 w-3" /> 비우기
          </Button>
        </div>

        {/* 현재 선택된 스킬 */}
        <div className="rounded border bg-card/40 p-2">
          <div className="text-[10px] font-bold text-muted-foreground mb-1">
            현재 선택 ({cur.length}/{CARD_SKILL_SLOTS})
          </div>
          {cur.length === 0 ? (
            <div className="text-[11px] text-muted-foreground italic">없음</div>
          ) : (
            <div className="flex flex-wrap gap-1">
              {cur.map((sid, i) => {
                const sk = skills.find((x) => x.id === sid);
                return (
                  <button
                    key={i}
                    onClick={() => toggle(sid)}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-cat-arcana/50 bg-cat-arcana/10 text-cat-arcana text-xs font-bold hover:bg-cat-arcana/20"
                    title="클릭하여 제거"
                  >
                    {sk?.icon && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sk.icon} alt="" className="w-3 h-3 rounded" loading="lazy" />
                    )}
                    <span>{sk?.name || sid}</span>
                    <X className="h-3 w-3 opacity-60" />
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* 스킬 선택 그리드 */}
        <div className="flex-1 min-h-0 overflow-auto rounded border bg-card/40 p-2">
          {jobSkills.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground italic py-6">스킬 없음</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-1">
              {jobSkills.map((sk) => {
                const selected = cur.includes(sk.id);
                return (
                  <button
                    key={sk.id}
                    onClick={() => toggle(sk.id)}
                    className={cn(
                      "flex items-center gap-2 px-2 py-1 rounded border text-xs text-left",
                      selected
                        ? "border-cat-arcana bg-cat-arcana/15 text-cat-arcana font-bold"
                        : "border-border hover:bg-accent/10"
                    )}
                    title={`#${sk.skillId} · ${SKILL_CAT_KO[sk.category]}`}
                  >
                    {sk.icon ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={sk.icon} alt="" className="w-6 h-6 rounded flex-shrink-0" loading="lazy" />
                    ) : (
                      <span className="w-6 h-6 flex items-center justify-center bg-muted/40 rounded flex-shrink-0">✨</span>
                    )}
                    <span className="flex-1 truncate">{sk.name}</span>
                    <span className="text-[9px] opacity-60">{SKILL_CAT_KO[sk.category]}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/** ArcanaCard의 적용 스킬 총 개수 (모든 직업 합) */
export function totalSkillsByJobCount(card: ArcanaCard): number {
  return Object.values(card.skillsByJob || {}).reduce(
    (n, a) => n + (Array.isArray(a) ? a.length : 0),
    0
  );
}
