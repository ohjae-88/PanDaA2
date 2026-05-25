"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  ARCANA_KO,
  ARCANA_STAT_KEYS,
  CARD_MAX_LV,
  STAT_LABEL,
} from "@/lib/arcana/constants";
import { resolveSlotCard, summarizeCardSkillPools } from "@/lib/arcana/compute";
import type { ArcanaBuild } from "@/lib/arcana/types";

type Props = {
  open: boolean;
  build: ArcanaBuild | null;
  slotKey: string | null;
  jobId: string;
  onClose: () => void;
};

/** V4.0.9 openSlotSaveModal 포팅 — 슬롯에 배치된 카드의 분배 (stats/skills) 편집.
 *  - 카드 마스터 + 레벨 → 가용 포인트 계산
 *  - stats 분배 (카드 stats 키만)
 *  - skills 분배 (카드의 직업별 스킬 풀)
 *  - 보유 카드(owned)면 owned.gains를 편집, 임의(master) 모드면 slot.gains 편집 */
export function SlotDistribDialog({ open, build, slotKey, jobId, onClose }: Props) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  const setSlotLevel = useArcanaBuildStore((s) => s.setSlotLevel);
  const setSlotGainStats = useArcanaBuildStore((s) => s.setSlotGainStats);
  const setSlotGainSkills = useArcanaBuildStore((s) => s.setSlotGainSkills);
  const patchOwned = useOwnedStore((s) => s.patchOwned);
  const skills = useSkillStore((s) => s.skills);

  const entry = build && slotKey ? build.slots[slotKey] : undefined;
  const { master, level, gains, source } = useMemo(
    () => resolveSlotCard(entry, arcana, owned),
    [entry, arcana, owned]
  );
  const ownedRef = useMemo(() => {
    if (source !== "owned" || !entry?.ownedCardId) return null;
    return owned.find((o) => o.id === entry.ownedCardId) ?? null;
  }, [source, entry, owned]);

  const [lv, setLv] = useState<number>(level);
  const [statsDraft, setStatsDraft] = useState<Record<string, number>>({});
  const [skillsDraft, setSkillsDraft] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!open) return;
    setLv(level);
    setStatsDraft({ ...(gains.stats || {}) });
    setSkillsDraft({ ...(gains.skills || {}) });
  }, [open, level, gains.stats, gains.skills]);

  const cardSkills = useMemo(
    () => summarizeCardSkillPools(master, jobId, skills),
    [master, jobId, skills]
  );

  // 카드 마스터의 stats 키 + ARCANA_STAT_KEYS 합집합 (사용자가 추가할 수 있도록)
  const statKeyOptions = useMemo(() => {
    const set = new Set<string>(ARCANA_STAT_KEYS as readonly string[]);
    if (master?.stats) Object.keys(master.stats).forEach((k) => set.add(k));
    return Array.from(set);
  }, [master]);

  if (!build || !slotKey || !master) return null;
  // 콜백 내부 좁히기 — TS narrowing 우회용 const 캡처
  const bid = build.id;
  const sk = slotKey;

  // 가용 포인트 계산 (레벨 * policy)
  const policy = master.levelUp || { skillPoint: 0, statPoint: 0 };
  const skillPool = lv * (policy.skillPoint || 0);
  const statPool = lv * (policy.statPoint || 0);
  const usedSkillSum = Object.values(skillsDraft).reduce((n, v) => n + (Number(v) || 0), 0);
  const usedStatSum = Object.values(statsDraft).reduce((n, v) => n + (Number(v) || 0), 0);
  const remainingSkill = skillPool - usedSkillSum;
  const remainingStat = statPool - usedStatSum;

  function setStatVal(key: string, v: number) {
    const next = { ...statsDraft };
    if (v <= 0) delete next[key];
    else next[key] = v;
    setStatsDraft(next);
  }
  function setSkillVal(sid: string, v: number) {
    const next = { ...skillsDraft };
    if (v <= 0) delete next[sid];
    else next[sid] = v;
    setSkillsDraft(next);
  }
  function handleSave() {
    if (source === "owned" && ownedRef) {
      patchOwned(ownedRef.id, {
        level: lv,
        gains: { stats: statsDraft, skills: skillsDraft },
      });
    } else {
      // 임의 모드 — slot에 저장
      setSlotLevel(bid, sk, lv);
      setSlotGainStats(bid, sk, statsDraft);
      setSlotGainSkills(bid, sk, skillsDraft);
    }
    onClose();
  }
  function handleReset() {
    setStatsDraft({});
    setSkillsDraft({});
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>
            🎚 슬롯 분배 — {ARCANA_KO[slotKey] || slotKey} · {master.name}
          </DialogTitle>
        </DialogHeader>

        <div className="text-[11px] text-muted-foreground">
          출처: <b>{source === "owned" ? "보유/계획 카드" : "임의 배치"}</b>
          {source === "owned" && " — 분배는 보유 카드 데이터에 저장됨"}
        </div>

        {/* 레벨 + 풀 표시 */}
        <div className="rounded border bg-card/40 p-2 flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1">
            <Label className="text-xs text-muted-foreground w-12">레벨</Label>
            <Input
              type="number"
              min={0} max={master.maxLv || CARD_MAX_LV}
              value={lv}
              onChange={(e) => setLv(parseInt(e.target.value) || 0)}
              className="h-8 w-20 tabular-nums"
            />
            <span className="text-[10px] text-muted-foreground">/ {master.maxLv || CARD_MAX_LV}</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">⚡ 스킬:</span>
            <b className={remainingSkill < 0 ? "text-rose-400" : "text-cat-arcana"}>
              {usedSkillSum}/{skillPool}
            </b>
            <span className="text-muted-foreground">(잔여 {remainingSkill})</span>
          </div>
          <div className="flex items-center gap-1 text-xs">
            <span className="text-muted-foreground">📈 스텟:</span>
            <b className={remainingStat < 0 ? "text-rose-400" : "text-cat-arcana"}>
              {usedStatSum}/{statPool}
            </b>
            <span className="text-muted-foreground">(잔여 {remainingStat})</span>
          </div>
          <span className="flex-1" />
          <Button size="xs" variant="ghost" onClick={handleReset} className="text-amber-500">
            분배 리셋
          </Button>
        </div>

        <div className="flex-1 min-h-0 overflow-auto space-y-3">
          {/* 스킬 분배 */}
          <section className="rounded border bg-card/40 p-2 space-y-1.5">
            <div className="text-xs font-bold text-muted-foreground">⚡ 스킬 분배 (이 카드의 직업 적용 스킬)</div>
            {cardSkills.length === 0 ? (
              <div className="text-[11px] text-muted-foreground italic">이 카드의 {jobId} 직업 적용 스킬 없음 — 아르카나DB에서 설정하세요.</div>
            ) : (
              <div className="space-y-1">
                {cardSkills.map((sk) => {
                  const v = skillsDraft[sk.id] ?? 0;
                  return (
                    <div key={sk.id} className="flex items-center gap-2">
                      {sk.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sk.icon} alt="" className="w-5 h-5 rounded flex-shrink-0" loading="lazy" />
                      ) : (
                        <span className="w-5 h-5 flex items-center justify-center bg-muted/40 rounded text-[10px]">✨</span>
                      )}
                      <span className="text-xs font-bold flex-1 truncate">{sk.name}</span>
                      <Button size="xs" variant="ghost" onClick={() => setSkillVal(sk.id, Math.max(0, v - 1))}>−</Button>
                      <Input
                        type="number"
                        min={0}
                        value={v}
                        onChange={(e) => setSkillVal(sk.id, Math.max(0, parseInt(e.target.value) || 0))}
                        className="h-7 w-16 px-1 tabular-nums text-center"
                      />
                      <Button size="xs" variant="ghost" onClick={() => setSkillVal(sk.id, v + 1)}>＋</Button>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          {/* 스텟 분배 */}
          <section className="rounded border bg-card/40 p-2 space-y-1.5">
            <div className="text-xs font-bold text-muted-foreground">📈 스텟 분배</div>
            <div className="space-y-1">
              {statKeyOptions.map((k) => {
                const v = statsDraft[k] ?? 0;
                const base = master.stats?.[k] || 0;
                return (
                  <div key={k} className="flex items-center gap-2">
                    <span className="text-xs font-bold flex-1 truncate">{STAT_LABEL[k] || k}</span>
                    {base > 0 && (
                      <span className="text-[10px] text-muted-foreground tabular-nums">기본 +{base}</span>
                    )}
                    <Button size="xs" variant="ghost" onClick={() => setStatVal(k, Math.max(0, v - 5))}>−5</Button>
                    <Input
                      type="number"
                      min={0}
                      value={v}
                      onChange={(e) => setStatVal(k, Math.max(0, parseInt(e.target.value) || 0))}
                      className="h-7 w-20 px-1 tabular-nums text-center"
                    />
                    <Button size="xs" variant="ghost" onClick={() => setStatVal(k, v + 5)}>＋5</Button>
                  </div>
                );
              })}
            </div>
          </section>
        </div>

        <DialogFooter className="justify-between">
          <span />
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button onClick={handleSave}>저장</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
