"use client";

import { useEffect, useRef, useState } from "react";
import { Users, Plus, Trash2, X, Pencil, Sparkles, Shuffle, Wand2, RotateCcw, Search, Check, CheckCircle2, GripVertical, ChevronDown, ChevronUp } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import { useEquipModal } from "@/lib/party/equip-modal-store";
import { jI, pFmtN } from "@/lib/party/constants";
import type { PartyGroup, ComposeMode, DistributeRule, Player } from "@/lib/party/types";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

/** 플레이어의 본캐 직업 색상 — 본캐 없으면 첫 캐릭터 직업 */
function pBadgeColor(player: Player): string {
  const main = player.characters.find((c) => c.type === "main");
  if (main) return jI(main.job).color;
  const first = player.characters[0];
  if (first) return jI(first.job).color;
  return "#888";
}
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";

type Props = {
  group: PartyGroup;
  onOpenAddParticipant: () => void;
  onOpenRuleEdit: (ruleId: string | null) => void;
};

export function ConfigPanel({ group, onOpenAddParticipant, onOpenRuleEdit }: Props) {
  const players = usePartyStore((s) => s.players);
  const patchGroup = usePartyStore((s) => s.patchGroup);
  const removeParticipant = usePartyStore((s) => s.removeParticipant);
  const toggleParticipantChar = usePartyStore((s) => s.toggleParticipantChar);
  const setParticipantChars = usePartyStore((s) => s.setParticipantChars);
  const removeRule = usePartyStore((s) => s.removeRule);
  const reorderRule = usePartyStore((s) => s.reorderRule);
  const autoCompose = usePartyStore((s) => s.autoCompose);
  const clearComposed = usePartyStore((s) => s.clearComposed);
  const applyParticipants = usePartyStore((s) => s.applyParticipants);
  const applySetPartyConfig = usePartyStore((s) => s.applySetPartyConfig);
  const openEquip = useEquipModal((s) => s.openFor);

  const [busy, setBusy] = useState(false);

  // 세트 수/파티 수 — 스테이지(편집중) 값. 적용 누르면 store 반영.
  const [stagedSetCount, setStagedSetCount] = useState(group.setCount);
  const [stagedPartyCount, setStagedPartyCount] = useState(group.partyCount);

  // 섹션 접기/펼치기 상태
  const [participantsOpen, setParticipantsOpen] = useState(true);
  const [autoComposeOpen, setAutoComposeOpen] = useState(true);

  // 그룹 전환 시 staged 값 동기화
  useEffect(() => {
    setStagedSetCount(group.setCount);
    setStagedPartyCount(group.partyCount);
  }, [group.id, group.setCount, group.partyCount]);

  const configDirty = stagedSetCount !== group.setCount || stagedPartyCount !== group.partyCount;

  function handleAutoCompose() {
    setBusy(true);
    try {
      const err = autoCompose(group.id);
      if (err) toast.error(err);
    } finally { setBusy(false); }
  }

  function handleApplyConfig() {
    applySetPartyConfig(group.id, stagedSetCount, stagedPartyCount);
  }

  function selectAllMains(pid: string) {
    const p = players.find((x) => x.id === pid);
    if (!p) return;
    setParticipantChars(group.id, pid, p.characters.filter((c) => c.type === "main").map((c) => c.id));
  }
  function selectAllChars(pid: string) {
    const p = players.find((x) => x.id === pid);
    if (!p) return;
    setParticipantChars(group.id, pid, p.characters.map((c) => c.id));
  }
  function clearChars(pid: string) {
    setParticipantChars(group.id, pid, []);
  }

  return (
    <div className="rounded-lg border bg-card p-3 space-y-3">
      {/* 1) 세트 수 / 파티 수 + 적용 */}
      <div className="flex items-center gap-4 flex-wrap">
        <NumStepper label="세트 수" value={stagedSetCount} min={1} max={10} onChange={setStagedSetCount} />
        <NumStepper label="파티 수" value={stagedPartyCount} min={1} max={4} onChange={setStagedPartyCount} />
        <Button
          size="sm"
          variant={configDirty ? "default" : "ghost"}
          onClick={handleApplyConfig}
          disabled={!configDirty}
          className={configDirty ? "" : "opacity-50"}
        >
          <CheckCircle2 className="h-3.5 w-3.5" /> 적용
        </Button>
        {configDirty && (
          <span className="text-[11px] text-amber-500 italic">
            변경됨 — 적용 버튼을 눌러 반영하세요
          </span>
        )}
      </div>

      {/* 2) 참가자 */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2 gap-2">
          <h3 className="text-sm font-extrabold flex items-center gap-1.5">
            <Users className="h-4 w-4" /> 참가자
            <span className="text-[11px] text-muted-foreground font-normal">{group.participants.length}명</span>
          </h3>
          <div className="flex items-center gap-1">
            <Button size="xs" onClick={onOpenAddParticipant}>
              <Plus className="h-3 w-3" /> 추가
            </Button>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                if (!group.composed) { toast.warning("먼저 '자동 파티 구성'을 실행하세요."); return; }
                applyParticipants(group.id);
              }}
              title="참가자/캐릭터 변경 내역을 아래 세트-파티 배치에 반영"
              className="border border-cat-party/40 bg-cat-party/10 text-cat-party hover:bg-cat-party/20"
            >
              <CheckCircle2 className="h-3 w-3" /> 적용
            </Button>
            <button
              onClick={() => setParticipantsOpen((v) => !v)}
              className="p-1 rounded border hover:bg-accent/10 text-muted-foreground"
              title={participantsOpen ? "접기" : "펼치기"}
            >
              {participantsOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>
        {!participantsOpen ? null : group.participants.length === 0 ? (
          <div className="text-xs text-muted-foreground italic text-center py-4 border rounded">
            참가자가 없습니다. <b>＋ 추가</b> 버튼으로 시작하세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-2">
            {group.participants.map((pc) => {
              const p = players.find((x) => x.id === pc.playerId);
              if (!p) return null;
              return (
                <div key={pc.playerId} className="rounded border bg-background/50 p-2">
                  <div className="flex items-center gap-2 mb-1.5 pb-1.5 border-b">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-extrabold text-white"
                      style={{ background: pBadgeColor(p) }}
                    >
                      {p.name.slice(0, 1)}
                    </div>
                    <div className="font-bold text-sm flex-1 truncate">{p.name}</div>
                    <span className="text-[10px] text-muted-foreground">{pc.selectedCharIds.length}/{p.characters.length}</span>
                    <button
                      onClick={() => selectAllMains(p.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-accent/10"
                      title="본케 전체"
                    >본</button>
                    <button
                      onClick={() => selectAllChars(p.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-accent/10"
                      title="전체 선택"
                    >전</button>
                    <button
                      onClick={() => clearChars(p.id)}
                      className="text-[10px] px-1.5 py-0.5 rounded border hover:bg-accent/10"
                      title="모두 해제"
                    >∅</button>
                    <button
                      onClick={async () => { if (await confirmDialog({ title: "참가자 제외", description: `${p.name}을(를) 그룹에서 제외하시겠습니까?`, confirmText: "제외", variant: "destructive" })) removeParticipant(group.id, p.id); }}
                      className="text-destructive hover:bg-destructive/10 rounded p-0.5"
                      title="제거"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </div>
                  {p.characters.length === 0 ? (
                    <span className="text-[11px] text-muted-foreground italic block py-2 text-center">캐릭터 없음</span>
                  ) : (
                    <div className="flex flex-col gap-1">
                      {[...p.characters]
                        .sort((a, b) => {
                          if (a.type !== b.type) return a.type === "main" ? -1 : 1;
                          return (b.cp || 0) - (a.cp || 0);
                        })
                        .map((c) => {
                          const sel = pc.selectedCharIds.includes(c.id);
                          const j = jI(c.job);
                          const isMain = c.type === "main";
                          return (
                            <button
                              key={c.id}
                              onClick={() => toggleParticipantChar(group.id, p.id, c.id)}
                              className={cn(
                                "flex items-stretch rounded border overflow-hidden text-left transition-all min-h-[30px] min-w-[180px]",
                                sel ? "bg-card" : "bg-card/20 border-border opacity-50 hover:opacity-100"
                              )}
                              style={sel ? { borderColor: j.color, borderWidth: 1 } : {}}
                              title={`${isMain ? "본" : "부"}케 · ${c.job}`}
                            >
                              {/* 본/부 + 체크 컬럼 */}
                              <div
                                className={cn(
                                  "w-6 flex flex-col items-center justify-center text-[9px] font-extrabold flex-shrink-0",
                                  isMain ? "bg-cat-arcana/15 text-cat-arcana" : "bg-cat-barrack/15 text-cat-barrack"
                                )}
                              >
                                <span>{isMain ? "본" : "부"}</span>
                                {sel && <Check className="h-2.5 w-2.5" />}
                              </div>
                              {/* 직업 컬럼 + 캐릭터명 영역 — 동일 배경 */}
                              <div
                                className="flex-1 min-w-0 flex items-stretch"
                                style={{ background: `${j.color}10` }}
                              >
                                <div className="flex flex-col items-center justify-center px-1 min-w-[36px] flex-shrink-0">
                                  <span className="text-sm leading-none">{j.icon}</span>
                                  <span className="text-[8px] font-bold leading-tight mt-0.5" style={{ color: j.color }}>{c.job}</span>
                                </div>
                                <div className="flex-1 min-w-0 flex items-center gap-1 px-1.5 py-0.5">
                                  <span
                                    role="button"
                                    onClick={(e) => { e.stopPropagation(); openEquip(p.id, c.id); }}
                                    className="opacity-60 hover:opacity-100 hover:text-cat-party flex-shrink-0"
                                    title="장비/스킬 보기"
                                  >
                                    <Search className="h-3 w-3" />
                                  </span>
                                  <span className="font-extrabold text-xs truncate" title={c.name}>{c.name}</span>
                                </div>
                              </div>
                              {/* 전투력 / 아이템 레벨 */}
                              <div className="flex items-center gap-1 pr-1.5 flex-shrink-0">
                                {!!c.cp && (
                                  <span className="text-gold font-extrabold tabular-nums text-xs">{pFmtN(c.cp)}</span>
                                )}
                                {!!c.itemLevel && (
                                  <span className="text-[9px] text-muted-foreground tabular-nums">({c.itemLevel})</span>
                                )}
                              </div>
                            </button>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3) 자동 파티 구성 — 옵션 + 분배 규칙 + 실행 버튼 */}
      <div className="border-t pt-3">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <h3 className="text-sm font-extrabold flex items-center gap-1.5">
            <Sparkles className="h-4 w-4 text-cat-party" /> 자동 파티 구성
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <label className="flex items-center gap-2 text-xs">
              <Switch
                checked={group.allowDup}
                onCheckedChange={(v) => patchGroup(group.id, { allowDup: v })}
              />
              <span className="font-semibold">캐릭터 중복 허용</span>
            </label>
            <div className="inline-flex rounded-md border overflow-hidden">
              {(["balanced", "random"] as ComposeMode[]).map((m) => (
                <button
                  key={m}
                  onClick={() => patchGroup(group.id, { composeMode: m })}
                  className={cn(
                    "px-3 py-1.5 text-xs font-bold",
                    group.composeMode === m ? "bg-cat-party/15 text-cat-party" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {m === "balanced" ? <><Wand2 className="h-3 w-3 inline mr-1" />균형</> : <><Shuffle className="h-3 w-3 inline mr-1" />완전 랜덤</>}
                </button>
              ))}
            </div>
            <Button size="sm" onClick={handleAutoCompose} disabled={busy}>
              <Sparkles className="h-4 w-4" /> 자동 파티 구성
            </Button>
            {group.composed && (
              <Button size="sm" variant="ghost" onClick={() => clearComposed(group.id)}>
                <RotateCcw className="h-4 w-4" /> 초기화
              </Button>
            )}
            <button
              onClick={() => setAutoComposeOpen((v) => !v)}
              className="p-1 rounded border hover:bg-accent/10 text-muted-foreground"
              title={autoComposeOpen ? "접기" : "펼치기"}
            >
              {autoComposeOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          </div>
        </div>

        {!autoComposeOpen ? null : <>
        {/* 분배 규칙 */}
        <div className="flex items-center justify-between mb-2 mt-1">
          <h4 className="text-xs font-extrabold flex items-center gap-1.5 text-muted-foreground">
            <Sparkles className="h-3 w-3" /> 분배 규칙
            <span className="text-[10px] font-normal">{group.distributeRules.length}개</span>
          </h4>
          <Button size="xs" variant="ghost" onClick={() => onOpenRuleEdit(null)}>
            <Plus className="h-3 w-3" /> 규칙 추가
          </Button>
        </div>
        {group.distributeRules.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic text-center py-2 border border-dashed rounded">
            규칙 없음 (모든 캐릭터가 자유 배치됨)
          </div>
        ) : (
          <div className="space-y-1">
            <div className="text-[10px] text-muted-foreground italic">
              상위 규칙이 우선 적용됩니다 (좌측 손잡이를 드래그하여 순서 변경)
            </div>
            {group.distributeRules.map((r, idx) => (
              <RuleRow
                key={r.id}
                rule={r}
                index={idx}
                group={group}
                onEdit={() => onOpenRuleEdit(r.id)}
                onDelete={async () => { if (await confirmDialog({ title: "규칙 삭제", description: "규칙을 삭제하시겠습니까?", confirmText: "삭제", variant: "destructive" })) removeRule(group.id, r.id); }}
                onReorder={(srcId, tgtId) => reorderRule(group.id, srcId, tgtId)}
              />
            ))}
          </div>
        )}
        </>}
      </div>
    </div>
  );
}

function NumStepper({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-semibold text-muted-foreground">{label}</span>
      <div className="inline-flex items-center rounded border bg-background overflow-hidden">
        <button
          onClick={() => onChange(Math.max(min, value - 1))}
          className="px-2 py-1 text-xs hover:bg-accent/10 disabled:opacity-30"
          disabled={value <= min}
        >−</button>
        <span className="px-2 py-1 text-xs font-bold tabular-nums w-7 text-center">{value}</span>
        <button
          onClick={() => onChange(Math.min(max, value + 1))}
          className="px-2 py-1 text-xs hover:bg-accent/10 disabled:opacity-30"
          disabled={value >= max}
        >+</button>
      </div>
    </div>
  );
}

function RuleRow({ rule, index, group, onEdit, onDelete, onReorder }: {
  rule: DistributeRule;
  index: number;
  group: PartyGroup;
  onEdit: () => void;
  onDelete: () => void;
  onReorder: (srcId: string, tgtId: string) => void;
}) {
  const players = usePartyStore((s) => s.players);
  const summary = ruleSummary(rule, group, players);
  const rowRef = useRef<HTMLDivElement | null>(null);
  const [over, setOver] = useState(false);

  function onDragStart(e: React.DragEvent) {
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", `rule:${rule.id}`); } catch { /* ignore */ }
  }
  function onDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setOver(true);
  }
  function onDragLeave() { setOver(false); }
  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    const raw = e.dataTransfer.getData("text/plain") || "";
    const m = raw.match(/^rule:(.+)$/);
    if (!m) return;
    const srcId = m[1];
    if (srcId === rule.id) return;
    onReorder(srcId, rule.id);
  }

  return (
    <div
      ref={rowRef}
      draggable
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        "flex items-center gap-2 rounded border bg-background/40 px-2 py-1.5 text-xs cursor-grab active:cursor-grabbing",
        over && "ring-2 ring-cat-party bg-cat-party/10"
      )}
    >
      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50 flex-shrink-0" />
      <span className="text-[9px] font-bold text-muted-foreground tabular-nums w-4 text-center">{index + 1}</span>
      <span className={cn(
        "px-1.5 py-0.5 rounded text-[10px] font-bold",
        rule.type === "class" ? "bg-cat-party/20 text-cat-party"
          : rule.type === "set" ? (rule.mode === "exclude" ? "bg-destructive/15 text-destructive" : "bg-cat-arcana/15 text-cat-arcana")
          : "bg-cat-barrack/15 text-cat-barrack"
      )}>
        {rule.type === "class" ? "직업" : rule.type === "set" ? (rule.mode === "exclude" ? "세트제외" : "세트포함") : "본/부"}
      </span>
      <span className="flex-1 truncate">{rule.name?.trim() || summary}</span>
      <Button variant="ghost" size="xs" onClick={onEdit}><Pencil className="h-3 w-3" /></Button>
      <Button variant="ghost" size="xs" onClick={onDelete} className="text-destructive"><Trash2 className="h-3 w-3" /></Button>
    </div>
  );
}

function ruleSummary(r: DistributeRule, _g: PartyGroup, players: ReturnType<typeof usePartyStore.getState>["players"]): string {
  if (r.type === "class") {
    const parties = (r.partyIndices ?? []).map((i) => `파티${i + 1}`).join(",");
    const minN = r.minCount ?? 0;
    const maxN = r.maxCount;
    const range = maxN !== undefined && maxN !== null
      ? (minN > 0 ? `${minN}~${maxN}명` : `최대 ${maxN}명`)
      : (minN > 0 ? `최소 ${minN}명` : "—");
    return `${parties || "?"} ${(r.jobs ?? []).join("/")} ${range}`;
  }
  if (r.type === "set") {
    const sets = (r.setIndices ?? []).map((i) => `세트${i + 1}`).join(",");
    const names = (r.playerIds ?? []).map((pid) => players.find((p) => p.id === pid)?.name).filter(Boolean).join(",");
    return `${sets} ${r.mode === "exclude" ? "제외" : "포함"}: ${names || "?"}`;
  }
  if (r.type === "main") {
    const scopeLbl = r.scope === "party" ? "파티" : "세트";
    const targets = (r.targetIndices ?? []).length
      ? (r.targetIndices ?? []).map((i) => `${scopeLbl}${i + 1}`).join(",")
      : `전체 ${scopeLbl}`;
    return `${targets} 본케 ${r.minCount ?? 0}~${r.maxCount ?? 4}명`;
  }
  return "—";
}
