"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useSkillStore } from "@/lib/arcana/skill-store";
import type { Skill } from "@/lib/arcana/types";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  jobId: string;
  onClose: () => void;
};

/** 패시브 스킬 기본 / 데바니온 보너스 수정 다이얼로그.
 *  - 기본 레벨: baseLv.base (정수)
 *  - 데바: skill.daevanion 토글 (true 시 baseLv.daevanion 보너스 합산)
 *  - 데바 보너스 값: baseLv.daevanion (정수) */
export function PassiveBaselineDialog({ open, jobId, onClose }: Props) {
  const skills = useSkillStore((s) => s.skills);
  const patchSkill = useSkillStore((s) => s.patchSkill);

  const passives = skills.filter((s) => s.category === "Passive" && s.jobId === jobId);

  // 로컬 드래프트 — id → { base, daeBonus, daeActive }
  const [draft, setDraft] = useState<Record<string, { base: number; daeBonus: number; daeActive: boolean }>>({});

  useEffect(() => {
    if (!open) return;
    const next: typeof draft = {};
    for (const sk of passives) {
      next[sk.id] = {
        base: sk.baseLv?.base ?? 0,
        daeBonus: sk.baseLv?.daevanion ?? 0,
        daeActive: sk.daevanion ?? ((sk.baseLv?.daevanion ?? 0) > 0),
      };
    }
    setDraft(next);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, jobId]);

  function update(id: string, patch: Partial<typeof draft[string]>) {
    setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
  }

  function handleSave() {
    for (const sk of passives) {
      const d = draft[sk.id];
      if (!d) continue;
      patchSkill(sk.id, {
        baseLv: { base: d.base, daevanion: d.daeBonus },
        daevanion: d.daeActive,
      });
    }
    onClose();
  }

  function handleReset(sk: Skill) {
    // 기본 시드 — base = 카테고리 시드값, dae = 0
    update(sk.id, { base: 0, daeBonus: 0, daeActive: false });
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl w-[min(960px,96vw)] max-h-[calc(100vh-32px)] flex flex-col p-4 gap-3">
        <DialogHeader>
          <DialogTitle>🛡 패시브 스킬 — 기본 / 데바니온 수정</DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {passives.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground italic py-8">
              해당 직업({jobId})의 패시브 스킬이 없습니다.
            </div>
          ) : (
            <div className="space-y-1.5">
              <div className="grid grid-cols-[1fr_80px_80px_60px_70px] gap-2 px-2 py-1 text-[10px] font-bold text-muted-foreground border-b">
                <div>스킬</div>
                <div className="text-center">기본 Lv</div>
                <div className="text-center">데바 보너스</div>
                <div className="text-center">데바 ON</div>
                <div className="text-right">초기화</div>
              </div>
              {passives.map((sk) => {
                const d = draft[sk.id] ?? { base: 0, daeBonus: 0, daeActive: false };
                const total = d.base + (d.daeActive ? d.daeBonus : 0);
                return (
                  <div
                    key={sk.id}
                    className="grid grid-cols-[1fr_80px_80px_60px_70px] gap-2 px-2 py-1.5 rounded border bg-background/30 items-center"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {sk.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={sk.icon} alt="" className="w-6 h-6 rounded flex-shrink-0" loading="lazy" />
                      ) : (
                        <span className="w-6 h-6 inline-flex items-center justify-center bg-muted/40 rounded text-xs">🛡</span>
                      )}
                      <div className="min-w-0">
                        <div className="text-sm font-bold truncate">{sk.name}</div>
                        <div className="text-[10px] text-muted-foreground tabular-nums">
                          현재 합계 Lv.<b className={cn("text-foreground", total >= 20 && "text-rose-400")}>{total}</b>
                        </div>
                      </div>
                    </div>
                    <Input
                      type="number"
                      min={0}
                      value={d.base}
                      onChange={(e) => update(sk.id, { base: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-8 text-center tabular-nums"
                    />
                    <Input
                      type="number"
                      min={0}
                      value={d.daeBonus}
                      onChange={(e) => update(sk.id, { daeBonus: Math.max(0, parseInt(e.target.value) || 0) })}
                      className="h-8 text-center tabular-nums"
                    />
                    <div className="flex justify-center">
                      <Switch
                        checked={d.daeActive}
                        onCheckedChange={(v) => update(sk.id, { daeActive: v })}
                      />
                    </div>
                    <div className="flex justify-end">
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => handleReset(sk)}
                        className="text-[10px] border"
                        title="0으로 초기화"
                      >
                        초기화
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
