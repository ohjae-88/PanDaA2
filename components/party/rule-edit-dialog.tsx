"use client";

import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import { PARTY_JOBS } from "@/lib/party/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { DistributeRule, RuleType } from "@/lib/party/types";

type Props = {
  open: boolean;
  gid: string | null;
  ruleId: string | null;
  onClose: () => void;
};

function newRule(): DistributeRule {
  return {
    id: `r_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    type: "class",
    name: "",
    partyIndices: [0],
    jobs: [],
    minCount: 1,
    setIndices: [0],
    playerIds: [],
    mode: "include",
    scope: "set",
    maxCount: 4,
  };
}

export function RuleEditDialog({ open, gid, ruleId, onClose }: Props) {
  const groups = usePartyStore((s) => s.groups);
  const players = usePartyStore((s) => s.players);
  const upsertRule = usePartyStore((s) => s.upsertRule);

  const group = groups.find((g) => g.id === gid);
  const existing = group?.distributeRules.find((r) => r.id === ruleId);

  const [draft, setDraft] = useState<DistributeRule>(newRule());

  useEffect(() => {
    if (open) {
      setDraft(existing ? { ...existing } : newRule());
    }
  }, [open, existing]);

  function patch(p: Partial<DistributeRule>) { setDraft((d) => ({ ...d, ...p })); }

  function toggleArr<T>(arr: T[] | undefined, v: T): T[] {
    const a = arr ?? [];
    return a.includes(v) ? a.filter((x) => x !== v) : [...a, v];
  }

  function save() {
    if (!gid) return;
    upsertRule(gid, draft);
    onClose();
  }

  if (!group) return null;

  const types: { id: RuleType; label: string }[] = [
    { id: "class", label: "직업" },
    { id: "set", label: "세트 포함/제외" },
    { id: "main", label: "본/부 비율" },
  ];

  const setOptions = Array.from({ length: group.setCount }, (_, i) => i);
  const partyOptions = Array.from({ length: group.partyCount }, (_, i) => i);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4" /> 분배 규칙 {existing ? "수정" : "추가"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div>
            <Label className="text-xs mb-1 block">규칙명 (선택)</Label>
            <Input value={draft.name ?? ""} onChange={(e) => patch({ name: e.target.value })} placeholder="예: 1번 파티 힐러 1명" />
          </div>

          <div>
            <Label className="text-xs mb-1 block">유형</Label>
            <div className="flex gap-1">
              {types.map((t) => (
                <button
                  key={t.id}
                  onClick={() => patch({ type: t.id })}
                  className={cn(
                    "px-3 py-1.5 rounded border text-xs font-bold",
                    draft.type === t.id ? "bg-cat-party/15 border-cat-party text-cat-party" : "hover:bg-accent/10"
                  )}
                >
                  {t.label}
                </button>
              ))}
            </div>
          </div>

          {draft.type === "class" && (
            <>
              <div>
                <Label className="text-xs mb-1 block">대상 파티</Label>
                <div className="flex flex-wrap gap-1">
                  {partyOptions.map((pi) => {
                    const on = (draft.partyIndices ?? []).includes(pi);
                    return (
                      <button
                        key={pi}
                        onClick={() => patch({ partyIndices: toggleArr(draft.partyIndices, pi) })}
                        className={cn("px-2 py-1 rounded border text-xs", on ? "bg-cat-party/15 border-cat-party text-cat-party" : "")}
                      >
                        파티 {pi + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">직업</Label>
                <div className="flex flex-wrap gap-1">
                  {PARTY_JOBS.map((j) => {
                    const on = (draft.jobs ?? []).includes(j.id);
                    return (
                      <button
                        key={j.id}
                        onClick={() => patch({ jobs: toggleArr(draft.jobs, j.id) })}
                        className={cn("px-2 py-1 rounded border text-xs flex items-center gap-1", on ? "bg-cat-party/15 border-cat-party" : "")}
                        style={on ? { color: j.color } : {}}
                      >
                        <span>{j.icon}</span>{j.id}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">최소</Label>
                  <Input
                    type="number"
                    min={0}
                    max={4}
                    className="w-20"
                    value={draft.minCount ?? 0}
                    onChange={(e) => patch({ minCount: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <span className="text-xs text-muted-foreground">명</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">최대</Label>
                  <Input
                    type="number"
                    min={0}
                    max={4}
                    className="w-20"
                    value={draft.maxCount ?? 4}
                    onChange={(e) => patch({ maxCount: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <span className="text-xs text-muted-foreground">명</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                * 선택한 파티에 이 직업 캐릭터를 최소 N명 ~ 최대 M명 배치합니다.
              </p>
            </>
          )}

          {draft.type === "set" && (
            <>
              <div>
                <Label className="text-xs mb-1 block">대상 세트</Label>
                <div className="flex flex-wrap gap-1">
                  {setOptions.map((si) => {
                    const on = (draft.setIndices ?? []).includes(si);
                    return (
                      <button
                        key={si}
                        onClick={() => patch({ setIndices: toggleArr(draft.setIndices, si) })}
                        className={cn("px-2 py-1 rounded border text-xs", on ? "bg-cat-party/15 border-cat-party text-cat-party" : "")}
                      >
                        세트 {si + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">대상 플레이어</Label>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto">
                  {group.participants.map((pc) => {
                    const p = players.find((x) => x.id === pc.playerId);
                    if (!p) return null;
                    const on = (draft.playerIds ?? []).includes(p.id);
                    return (
                      <button
                        key={p.id}
                        onClick={() => patch({ playerIds: toggleArr(draft.playerIds, p.id) })}
                        className={cn("px-2 py-1 rounded border text-xs", on ? "bg-cat-party/15 border-cat-party text-cat-party" : "")}
                      >
                        {p.name}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">방식</Label>
                <div className="flex gap-1">
                  <button
                    onClick={() => patch({ mode: "include" })}
                    className={cn("px-3 py-1.5 rounded border text-xs font-bold", draft.mode === "include" ? "bg-cat-party/15 border-cat-party text-cat-party" : "")}
                  >포함 (해당 세트에 배치)</button>
                  <button
                    onClick={() => patch({ mode: "exclude" })}
                    className={cn("px-3 py-1.5 rounded border text-xs font-bold", draft.mode === "exclude" ? "bg-destructive/15 border-destructive text-destructive" : "")}
                  >제외 (해당 세트에서 빼기)</button>
                </div>
              </div>
            </>
          )}

          {draft.type === "main" && (
            <>
              <div>
                <Label className="text-xs mb-1 block">범위</Label>
                <div className="flex gap-1">
                  <button
                    onClick={() => patch({ scope: "set" })}
                    className={cn("px-3 py-1.5 rounded border text-xs font-bold", draft.scope === "set" ? "bg-cat-party/15 border-cat-party text-cat-party" : "")}
                  >세트별</button>
                  <button
                    onClick={() => patch({ scope: "party" })}
                    className={cn("px-3 py-1.5 rounded border text-xs font-bold", draft.scope === "party" ? "bg-cat-party/15 border-cat-party text-cat-party" : "")}
                  >파티별</button>
                </div>
              </div>
              <div>
                <Label className="text-xs mb-1 block">대상 {draft.scope === "party" ? "파티" : "세트"} (미선택 시 전체)</Label>
                <div className="flex flex-wrap gap-1">
                  {(draft.scope === "party" ? partyOptions : setOptions).map((i) => {
                    const on = (draft.targetIndices ?? []).includes(i);
                    return (
                      <button
                        key={i}
                        onClick={() => patch({ targetIndices: toggleArr(draft.targetIndices, i) })}
                        className={cn("px-2 py-1 rounded border text-xs", on ? "bg-cat-party/15 border-cat-party text-cat-party" : "")}
                      >
                        {draft.scope === "party" ? "파티" : "세트"} {i + 1}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="flex items-center gap-3 flex-wrap">
                <div className="flex items-center gap-2">
                  <Label className="text-xs">본케 최소</Label>
                  <Input
                    type="number" min={0} className="w-20"
                    value={draft.minCount ?? 0}
                    onChange={(e) => patch({ minCount: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <span className="text-xs text-muted-foreground">명</span>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs">최대</Label>
                  <Input
                    type="number" min={0} className="w-20"
                    value={draft.maxCount ?? 4}
                    onChange={(e) => patch({ maxCount: Math.max(0, Number(e.target.value) || 0) })}
                  />
                  <span className="text-xs text-muted-foreground">명</span>
                </div>
              </div>
              <p className="text-[11px] text-muted-foreground italic">
                * 자동 구성 시 본/부 비율 충족을 위해 참가자별 본/부 캐릭터를 우선 선택합니다.
              </p>
            </>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={save}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
