"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil, RotateCcw, Copy, Search, X, Eraser, Crown } from "lucide-react";
import { usePartyStore, charDisplayName, computePerSetUa } from "@/lib/party/store";
import { useEquipModal } from "@/lib/party/equip-modal-store";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";
import { jI, pColor, pColorBright, pFmtN } from "@/lib/party/constants";
import type { Player } from "@/lib/party/types";

/** 플레이어의 본캐 직업 색상 — 본캐 없으면 첫 캐릭터 직업, 그것도 없으면 해시 기반 fallback */
function pBadgeColor(player: Player | undefined, fallbackId: string): string {
  if (!player) return pColorBright(fallbackId);
  const main = player.characters.find((c) => c.type === "main");
  if (main) return jI(main.job).color;
  const first = player.characters[0];
  if (first) return jI(first.job).color;
  return pColorBright(player.id);
}
import type { PartyGroup, GeneratedSet, GeneratedSlot, GeneratedParty } from "@/lib/party/types";
import { Button } from "@/components/ui/button";
import { cn, copyText, showToast } from "@/lib/utils";

type Props = {
  group: PartyGroup;
  onOpenSlotPicker: (setId: string, partyIdx: number, slotIdx: number) => void;
  /** true면 세트를 1열 수직 배치 강제 (오버레이 축소 모드 파티 뷰 용) */
  forceOneColumn?: boolean;
  /** 표시할 세트 인덱스 필터 (오버레이 뷰 용). 비어있으면 전체 표시. */
  visibleSetIndices?: number[];
};

type DragSrc =
  | { kind: "slot"; setId: string; partyIdx: number; slotIdx: number }
  | { kind: "ua"; playerId: string; charId: string };

type SlotPos = { setId: string; partyIdx: number; slotIdx: number };

/** 글로벌 드래그 ref — 컴포넌트 트리 외부에 보관해 re-render 영향 없음 */
const globalDragRef: { current: DragSrc | null } = { current: null };

/** 슬롯/UA 드래그를 위한 native DOM 바인딩 훅 */
function useDraggable(src: DragSrc | null) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !src) return;
    el.draggable = true;
    function onStart(e: DragEvent) {
      if (!e.dataTransfer) return;
      globalDragRef.current = src;
      e.dataTransfer.effectAllowed = "move";
      try { e.dataTransfer.setData("text/plain", JSON.stringify(src)); } catch { /* ignore */ }
    }
    function onEnd() { globalDragRef.current = null; }
    el.addEventListener("dragstart", onStart);
    el.addEventListener("dragend", onEnd);
    return () => {
      el.removeEventListener("dragstart", onStart);
      el.removeEventListener("dragend", onEnd);
    };
  }, [src]);
  return ref;
}

/** 슬롯 드롭존 native 바인딩 — drop 시 콜백 호출.
 *  dragover 마다 hover=true 유지, dragleave 시 relatedTarget이 외부일 때만 hover=false.
 *  dragend 글로벌 fallback으로 hover 정리. */
function useDropTarget(
  onDrop: (src: DragSrc) => void,
  onOverChange: (hovering: boolean) => void,
  enabled = true
) {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;
    let hovering = false;
    let lastOverTs = 0;
    let timer: number | null = null;

    function setHover(v: boolean) {
      if (hovering === v) return;
      hovering = v;
      onOverChange(v);
    }

    function onOver(e: DragEvent) {
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
      lastOverTs = performance.now();
      setHover(true);
      // 일정 시간 dragover 이벤트가 끊기면 hover 자동 해제 (드래그 종료 fallback)
      if (timer === null) {
        timer = window.setInterval(() => {
          if (performance.now() - lastOverTs > 150) {
            setHover(false);
            if (timer !== null) { clearInterval(timer); timer = null; }
          }
        }, 60);
      }
    }
    function onLeave(e: DragEvent) {
      const rt = e.relatedTarget as Node | null;
      if (rt && el && el.contains(rt)) return;  // 자식으로 이동 — 무시
      setHover(false);
    }
    function onDropEv(e: DragEvent) {
      e.preventDefault();
      setHover(false);
      let src = globalDragRef.current;
      if (!src && e.dataTransfer) {
        try {
          const raw = e.dataTransfer.getData("text/plain");
          if (raw) src = JSON.parse(raw) as DragSrc;
        } catch { /* ignore */ }
      }
      globalDragRef.current = null;
      if (src) onDrop(src);
    }
    function onGlobalDragEnd() {
      setHover(false);
      if (timer !== null) { clearInterval(timer); timer = null; }
    }

    el.addEventListener("dragover", onOver);
    el.addEventListener("dragleave", onLeave);
    el.addEventListener("drop", onDropEv);
    // 전역 dragend — 드래그 취소(ESC 등) 시에도 hover 해제
    document.addEventListener("dragend", onGlobalDragEnd);
    document.addEventListener("drop", onGlobalDragEnd);

    return () => {
      el.removeEventListener("dragover", onOver);
      el.removeEventListener("dragleave", onLeave);
      el.removeEventListener("drop", onDropEv);
      document.removeEventListener("dragend", onGlobalDragEnd);
      document.removeEventListener("drop", onGlobalDragEnd);
      if (timer !== null) clearInterval(timer);
    };
  }, [onDrop, onOverChange, enabled]);
  return ref;
}

export function SetsBoard({ group, onOpenSlotPicker, forceOneColumn, visibleSetIndices }: Props) {
  const players = usePartyStore((s) => s.players);
  const servers = usePartyStore((s) => s.servers);
  const defaultServerId = usePartyStore((s) => s.defaultServerId);
  const renameSet = usePartyStore((s) => s.renameSet);
  const renameParty = usePartyStore((s) => s.renameParty);
  const swapSlots = usePartyStore((s) => s.swapSlots);
  const placeUnassigned = usePartyStore((s) => s.placeUnassigned);
  const returnSlotToUnassigned = usePartyStore((s) => s.returnSlotToUnassigned);
  const toggleSlotOpen = usePartyStore((s) => s.toggleSlotOpen);
  const resetSet = usePartyStore((s) => s.resetSet);
  const resetParty = usePartyStore((s) => s.resetParty);
  const duplicateSet = usePartyStore((s) => s.duplicateSet);

  const openEquip = useEquipModal((s) => s.openFor);

  if (!group.composed || !group.generatedSets.length) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground text-sm">
        아직 파티가 구성되지 않았습니다. 위 옵션을 설정한 뒤 <b>자동 파티 구성</b>을 실행하세요.
      </div>
    );
  }

  function handleSlotDrop(tgt: SlotPos, src: DragSrc) {
    if (src.kind === "ua") {
      placeUnassigned(group.id, tgt.setId, tgt.partyIdx, tgt.slotIdx, src.playerId, src.charId);
      return;
    }
    if (src.setId === tgt.setId && src.partyIdx === tgt.partyIdx && src.slotIdx === tgt.slotIdx) return;
    swapSlots(group.id, src, tgt);
  }
  function handleUaDrop(_tgtSetId: string, src: DragSrc) {
    if (src.kind !== "slot") return;
    // 슬롯을 UA 영역으로 드롭 = 해당 슬롯 공석화 (UA는 자동 재계산)
    returnSlotToUnassigned(group.id, src.setId, src.partyIdx, src.slotIdx);
  }
  async function handleResetSet(setId: string, name: string) {
    if (!(await confirmDialog({ title: "세트 초기화", description: `'${name}' 전체를 초기화하시겠습니까?\n모든 캐릭터가 미배치로 회수됩니다.`, confirmText: "초기화", variant: "destructive" }))) return;
    resetSet(group.id, setId);
  }
  async function handleResetParty(setId: string, partyIdx: number) {
    if (!(await confirmDialog({ title: "파티 초기화", description: "이 파티를 초기화하시겠습니까?", confirmText: "초기화", variant: "destructive" }))) return;
    resetParty(group.id, setId, partyIdx);
  }

  // 파티 수가 2개 이하일 때는 세트를 2열 그리드로 표시. forceOneColumn 시 1열 강제.
  const twoColLayout = !forceOneColumn && group.partyCount <= 2;
  const idxFilter = visibleSetIndices && visibleSetIndices.length > 0
    ? new Set(visibleSetIndices)
    : null;
  const visibleSets = idxFilter
    ? group.generatedSets.map((st, i) => ({ st, i })).filter(({ i }) => idxFilter.has(i))
    : group.generatedSets.map((st, i) => ({ st, i }));
  return (
    <div
      className={cn(
        twoColLayout ? "grid grid-cols-1 xl:grid-cols-2 gap-4" : "space-y-4"
      )}
    >
      {visibleSets.map(({ st, i: setIdx }) => (
        <SetCard
          key={st.id}
          set={st}
          setIdx={setIdx}
          allSets={group.generatedSets}
          participants={group.participants}
          players={players}
          servers={servers}
          defaultServerId={defaultServerId}
          compact={twoColLayout}
          onSlotDrop={handleSlotDrop}
          onUaDrop={handleUaDrop}
          onRenameSet={(name) => renameSet(group.id, st.id, name)}
          onRenameParty={(pi, name) => renameParty(group.id, st.id, pi, name)}
          onResetSet={() => handleResetSet(st.id, st.name)}
          onResetParty={(pi) => handleResetParty(st.id, pi)}
          onDuplicate={() => duplicateSet(group.id, st.id)}
          onToggleSlotOpen={(pi, si) => toggleSlotOpen(group.id, st.id, pi, si)}
          onClearSlot={(pi, si) => returnSlotToUnassigned(group.id, st.id, pi, si)}
          onOpenEquip={openEquip}
          onOpenSlotPicker={(pi, si) => onOpenSlotPicker(st.id, pi, si)}
        />
      ))}
    </div>
  );
}

type CommonHandlers = {
  onSlotDrop: (tgt: SlotPos, src: DragSrc) => void;
  onUaDrop: (setId: string, src: DragSrc) => void;
  onOpenEquip: (pid: string, cid: string) => void;
};

function SetCard(props: {
  set: GeneratedSet;
  setIdx: number;
  allSets: GeneratedSet[];
  participants: PartyGroup["participants"];
  players: ReturnType<typeof usePartyStore.getState>["players"];
  servers: ReturnType<typeof usePartyStore.getState>["servers"];
  defaultServerId: number | null;
  compact?: boolean;
  onSlotDrop: CommonHandlers["onSlotDrop"];
  onUaDrop: CommonHandlers["onUaDrop"];
  onOpenEquip: CommonHandlers["onOpenEquip"];
  onRenameSet: (name: string) => void;
  onRenameParty: (partyIdx: number, name: string) => void;
  onResetSet: () => void;
  onResetParty: (partyIdx: number) => void;
  onDuplicate: () => void;
  onToggleSlotOpen: (partyIdx: number, slotIdx: number) => void;
  onClearSlot: (partyIdx: number, slotIdx: number) => void;
  onOpenSlotPicker: (partyIdx: number, slotIdx: number) => void;
}) {
  const {
    set, setIdx, allSets, participants, players, servers, defaultServerId, compact,
    onSlotDrop, onUaDrop, onOpenEquip,
    onRenameSet, onRenameParty, onResetSet, onResetParty, onDuplicate,
    onToggleSlotOpen, onClearSlot, onOpenSlotPicker,
  } = props;

  // V4.0.9 규칙으로 UA 계산
  const uaItems = computePerSetUa(setIdx, allSets, participants);

  const [editingSet, setEditingSet] = useState(false);
  const [setName, setSetName] = useState(set.name);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  /** V4.0.9 copySetText 포맷: `{세트명} // {파티명} : 캐릭1, 캐릭2, ... // {파티명} : ... // ...`
   *  공석/미배치 슬롯은 `[공석]`. 클립보드 API 미지원 시 textarea fallback. */
  async function handleCopyText() {
    const partyTexts = set.parties.map((party) => {
      const names = party.slots.map((sl) => {
        if (!sl.playerId || !sl.charId) return "[공석]";
        const pl = players.find((p) => p.id === sl.playerId);
        const ch = pl?.characters.find((c) => c.id === sl.charId);
        return ch ? ch.name : "[공석]";
      });
      return `${party.name} : ${names.join(", ")}`;
    });
    if (!partyTexts.length) return;
    const text = `${set.name} // ${partyTexts.join(" // ")}`;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
      } else {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.style.cssText = "position:fixed;opacity:0;pointer-events:none";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch { /* ignore */ }
        document.body.removeChild(ta);
      }
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 1500);
    } catch {
      toast.error("복사 실패", { description: text.length > 200 ? text.slice(0, 200) + "..." : text });
    }
  }

  const filled = set.parties.reduce((a, p) => a + p.slots.filter((s) => !!s.playerId).length, 0);
  const cap = set.parties.length * 4;
  // onDuplicate prop은 호환을 위해 보존 — 현재 UI 노출 안 함 (V4.0.9 동작 복원)
  void onDuplicate;

  // 중복 탐지 — 동일 charId 중복(전역 dedup 위반) + 동일 player가 이 세트에 2회 이상 (V4.0.9 동일)
  const charCount = new Map<string, number>();
  const playerCount = new Map<string, number>();
  set.parties.forEach((p) => p.slots.forEach((s) => {
    if (s.charId) charCount.set(s.charId, (charCount.get(s.charId) ?? 0) + 1);
    if (s.playerId) playerCount.set(s.playerId, (playerCount.get(s.playerId) ?? 0) + 1);
  }));

  // 세트 참여 플레이어
  const playerIds = new Set<string>();
  set.parties.forEach((p) => p.slots.forEach((s) => { if (s.playerId) playerIds.add(s.playerId); }));

  return (
    <div className="rounded-lg border-2 border-slate-600/70 bg-slate-900/30 shadow-sm">
      {/* 세트 헤더 — 짙은 남색-회색 톤 */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-slate-600/40 bg-slate-800/50 flex-wrap rounded-t-md">
        {editingSet ? (
          <input
            autoFocus
            value={setName}
            onChange={(e) => setSetName(e.target.value)}
            onBlur={() => { onRenameSet(setName); setEditingSet(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRenameSet(setName); setEditingSet(false); }
              if (e.key === "Escape") { setSetName(set.name); setEditingSet(false); }
            }}
            className="font-extrabold text-lg bg-transparent border-b-2 border-cat-party outline-none px-1 w-40"
          />
        ) : (
          <button onClick={() => setEditingSet(true)} className="font-extrabold text-lg hover:underline flex items-center gap-1.5">
            {set.name} <Pencil className="h-3.5 w-3.5 opacity-50" />
          </button>
        )}
        <span className="text-xs text-muted-foreground tabular-nums font-bold">
          {filled}명 / {cap}석
        </span>

        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0 ml-2">
          {Array.from(playerIds).map((pid) => {
            const p = players.find((x) => x.id === pid);
            if (!p) return null;
            const col = pBadgeColor(p, pid);
            return (
              <span
                key={pid}
                className="inline-flex items-center justify-center w-5 h-5 rounded-full border text-[10px] font-extrabold"
                style={{ borderColor: col, color: col, background: col + "1a" }}
                title={p.name}
              >
                {p.name.slice(0, 1)}
              </span>
            );
          })}
        </div>

        <Button
          variant="ghost"
          size="xs"
          onClick={handleCopyText}
          title="이 세트의 캐릭터명 전체를 텍스트로 클립보드에 복사"
          className={copyState === "copied" ? "text-emerald-400" : ""}
        >
          <Copy className="h-3 w-3" /> {copyState === "copied" ? "✓ 복사됨" : "복사"}
        </Button>
        <Button variant="ghost" size="xs" onClick={onResetSet} className="text-destructive" title="세트 초기화">
          <RotateCcw className="h-3 w-3" /> 세트 초기화
        </Button>
      </div>

      {/* 파티 그리드 */}
      <div
        className="grid gap-2 p-2"
        style={{ gridTemplateColumns: `repeat(${set.parties.length}, minmax(0, 1fr))` }}
      >
        {set.parties.map((party, pi) => (
          <PartyColumn
            key={pi}
            party={party}
            partyIdx={pi}
            setId={set.id}
            players={players}
            servers={servers}
            defaultServerId={defaultServerId}
            charCount={charCount}
            playerCount={playerCount}
            onSlotDrop={onSlotDrop}
            onRenameParty={(name) => onRenameParty(pi, name)}
            onResetParty={() => onResetParty(pi)}
            onToggleSlotOpen={(si) => onToggleSlotOpen(pi, si)}
            onClearSlot={(si) => onClearSlot(pi, si)}
            onOpenEquip={onOpenEquip}
            onOpenSlotPicker={(si) => onOpenSlotPicker(pi, si)}
          />
        ))}
      </div>

      <UnassignedStrip
        setId={set.id}
        uaItems={uaItems}
        players={players}
        servers={servers}
        defaultServerId={defaultServerId}
        compact={compact}
        onUaDrop={onUaDrop}
        onOpenEquip={onOpenEquip}
      />
    </div>
  );
}

function UnassignedStrip(props: {
  setId: string;
  uaItems: { playerId: string; charId: string }[];
  players: ReturnType<typeof usePartyStore.getState>["players"];
  servers: ReturnType<typeof usePartyStore.getState>["servers"];
  defaultServerId: number | null;
  compact?: boolean;
  onUaDrop: CommonHandlers["onUaDrop"];
  onOpenEquip: CommonHandlers["onOpenEquip"];
}) {
  const { setId, uaItems, players, servers, defaultServerId, compact, onUaDrop, onOpenEquip } = props;
  const empty = uaItems.length === 0;
  const [over, setOver] = useState(false);
  const dropRef = useDropTarget((src) => onUaDrop(setId, src), setOver);

  if (empty && !over) {
    return (
      <div
        ref={dropRef}
        className="border-t border-dashed h-2 bg-muted/5"
        title="슬롯의 캐릭터를 여기로 드래그하여 미배치로 회수"
      />
    );
  }

  return (
    <div
      ref={dropRef}
      className={cn(
        "border-t-2 border-dashed px-3 py-2 bg-muted/10 transition-colors rounded-b-md",
        over && "bg-cat-party/15 border-cat-party"
      )}
    >
      <div className="flex items-center gap-1 mb-1.5">
        <span className="text-[11px] font-extrabold text-muted-foreground tracking-wider uppercase">📦 미배치</span>
        <span className="text-[11px] font-bold text-muted-foreground tabular-nums">({uaItems.length})</span>
        <span className="text-[10px] text-muted-foreground italic ml-2">슬롯의 캐릭터를 이 영역으로 드래그하여 빼낼 수 있습니다</span>
      </div>
      {empty ? (
        <div className="text-[11px] text-muted-foreground italic py-2 text-center">— 여기로 드롭 —</div>
      ) : (
        <div className={cn(
          "grid gap-1.5",
          compact
            ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 2xl:grid-cols-3"
            : "grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5"
        )}>
          {uaItems.map((item) => {
            const player = players.find((p) => p.id === item.playerId);
            const char = player?.characters.find((c) => c.id === item.charId);
            if (!player || !char) return null;
            return (
              <UaCard
                key={`${item.playerId}-${item.charId}`}
                src={{ kind: "ua", playerId: item.playerId, charId: item.charId }}
                player={player}
                char={char}
                servers={servers}
                defaultServerId={defaultServerId}
                onOpenEquip={onOpenEquip}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}

function UaCard(props: {
  src: DragSrc;
  player: ReturnType<typeof usePartyStore.getState>["players"][number];
  char: ReturnType<typeof usePartyStore.getState>["players"][number]["characters"][number];
  servers: ReturnType<typeof usePartyStore.getState>["servers"];
  defaultServerId: number | null;
  onOpenEquip: (pid: string, cid: string) => void;
}) {
  const { src, player, char, servers, defaultServerId, onOpenEquip } = props;
  const dragRef = useDraggable(src);
  const j = jI(char.job);
  const isMain = char.type === "main";
  const playerCol = pBadgeColor(player, player.id);

  return (
    <div
      ref={dragRef}
      className={cn(
        "flex items-stretch rounded border bg-card cursor-grab active:cursor-grabbing shadow-sm min-h-[44px]",
        isMain ? "border-l-[4px] border-l-cat-arcana ring-1 ring-cat-arcana/30" : "border-l-[3px] border-l-cat-barrack"
      )}
      title={`${player.name} · ${char.job} · ${isMain ? "본케" : "부케"} — 드래그로 슬롯에 배치`}
    >
      <div className={cn(
        "w-7 flex flex-col items-center justify-center text-[10px] font-extrabold flex-shrink-0",
        isMain ? "bg-cat-arcana/20 text-cat-arcana" : "bg-cat-barrack/15 text-cat-barrack"
      )}>
        {isMain && <Crown className="h-2.5 w-2.5 mb-0.5" />}
        {isMain ? "본" : "부"}
      </div>
      <div
        className="flex flex-col items-center justify-center px-1 border-l border-r min-w-[40px] flex-shrink-0"
        style={{ background: `${j.color}10` }}
      >
        <span className="text-sm leading-none">{j.icon}</span>
        <span className="text-[8px] font-bold leading-tight mt-0.5" style={{ color: j.color }}>{char.job}</span>
      </div>
      <div className="flex-1 min-w-0 flex items-center gap-1 px-1.5">
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onOpenEquip(player.id, char.id); }}
          draggable={false}
          className="opacity-60 hover:opacity-100 hover:text-cat-party flex-shrink-0"
          title="장비/스킬 보기"
        >
          <Search className="h-3 w-3" />
        </button>
        <span
          className="font-extrabold text-xs truncate cursor-text"
          title={`${char.name} (Shift+클릭: 캐릭터명 복사)`}
          onClick={(e) => {
            if (!e.shiftKey) return;
            e.stopPropagation();
            e.preventDefault();
            void copyText(char.name).then((ok) => {
              if (ok) showToast(`📋 복사됨: ${char.name}`);
            });
          }}
        >
          {charDisplayName(char, servers, defaultServerId)}
        </span>
      </div>
      <div className="flex items-center gap-1 pr-1.5 flex-shrink-0">
        {!!char.cp && <span className="text-gold font-extrabold tabular-nums text-[10px]">{pFmtN(char.cp)}</span>}
      </div>
      <div className="flex items-center pr-1.5">
        <span
          className="inline-block px-1.5 py-0.5 rounded text-[9px] font-extrabold border whitespace-nowrap max-w-[64px] truncate"
          style={{ borderColor: playerCol, color: playerCol, background: playerCol + "1a" }}
          title={player.name}
        >
          {player.name.slice(0, 2)}
        </span>
      </div>
    </div>
  );
}

function PartyColumn(props: {
  party: GeneratedParty;
  partyIdx: number;
  setId: string;
  players: ReturnType<typeof usePartyStore.getState>["players"];
  servers: ReturnType<typeof usePartyStore.getState>["servers"];
  defaultServerId: number | null;
  charCount: Map<string, number>;
  playerCount: Map<string, number>;
  onSlotDrop: CommonHandlers["onSlotDrop"];
  onRenameParty: (name: string) => void;
  onResetParty: () => void;
  onToggleSlotOpen: (slotIdx: number) => void;
  onClearSlot: (slotIdx: number) => void;
  onOpenEquip: CommonHandlers["onOpenEquip"];
  onOpenSlotPicker: (slotIdx: number) => void;
}) {
  const {
    party, partyIdx, setId, players, servers, defaultServerId, charCount, playerCount,
    onSlotDrop, onRenameParty, onResetParty, onToggleSlotOpen, onClearSlot, onOpenEquip, onOpenSlotPicker,
  } = props;

  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(party.name);

  const partyFilled = party.slots.filter((s) => !!s.playerId).length;

  return (
    <div className="rounded-md border bg-background/40">
      <div className="px-2 py-1.5 border-b bg-muted/40 flex items-center gap-1.5 rounded-t-md">
        {editing ? (
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => { onRenameParty(name); setEditing(false); }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { onRenameParty(name); setEditing(false); }
              if (e.key === "Escape") { setName(party.name); setEditing(false); }
            }}
            className="bg-transparent border-b border-cat-party outline-none flex-1 text-xs font-extrabold px-1"
          />
        ) : (
          <button onClick={() => setEditing(true)} className="flex-1 text-left text-xs font-extrabold hover:underline">
            {party.name}
          </button>
        )}
        <span className="text-[10px] text-muted-foreground tabular-nums">{partyFilled}/4</span>
        <button
          onClick={onResetParty}
          className="text-[10px] px-1.5 py-0.5 rounded border text-muted-foreground hover:text-destructive hover:border-destructive"
          title="파티 초기화"
        >
          <RotateCcw className="h-3 w-3 inline" /> 초기화
        </button>
      </div>
      <div className="p-1.5 space-y-1">
        {party.slots.map((slot, si) => {
          const charDup = !!slot.charId && (charCount.get(slot.charId) ?? 0) > 1;
          const playerDup = !!slot.playerId && (playerCount.get(slot.playerId) ?? 0) > 1;
          return (
            <SlotCell
              key={si}
              slot={slot}
              setId={setId}
              partyIdx={partyIdx}
              slotIdx={si}
              players={players}
              servers={servers}
              defaultServerId={defaultServerId}
              isDup={charDup || playerDup}
              dupKind={charDup ? "char" : playerDup ? "player" : null}
              onSlotDrop={onSlotDrop}
              onToggleSlotOpen={() => onToggleSlotOpen(si)}
              onClearSlot={() => onClearSlot(si)}
              onOpenEquip={onOpenEquip}
              onOpenSlotPicker={() => onOpenSlotPicker(si)}
            />
          );
        })}
      </div>
    </div>
  );
}

function SlotCell(props: {
  slot: GeneratedSlot;
  setId: string;
  partyIdx: number;
  slotIdx: number;
  players: ReturnType<typeof usePartyStore.getState>["players"];
  servers: ReturnType<typeof usePartyStore.getState>["servers"];
  defaultServerId: number | null;
  isDup: boolean;
  dupKind: "char" | "player" | null;
  onSlotDrop: CommonHandlers["onSlotDrop"];
  onToggleSlotOpen: () => void;
  onClearSlot: () => void;
  onOpenEquip: CommonHandlers["onOpenEquip"];
  onOpenSlotPicker: () => void;
}) {
  const {
    slot, setId, partyIdx, slotIdx, players, servers, defaultServerId, isDup, dupKind,
    onSlotDrop, onToggleSlotOpen, onClearSlot, onOpenEquip, onOpenSlotPicker,
  } = props;

  const slotPos: SlotPos = { setId, partyIdx, slotIdx };
  const dragSrc: DragSrc = { kind: "slot", setId, partyIdx, slotIdx };

  const filled = !!slot.playerId && !!slot.charId;
  const player = filled ? players.find((p) => p.id === slot.playerId) : null;
  const char = player && slot.charId ? player.characters.find((c) => c.id === slot.charId) : null;
  const j = char ? jI(char.job) : null;

  const [over, setOver] = useState(false);
  const dragRef = useDraggable(filled ? dragSrc : null);
  const dropRef = useDropTarget((src) => onSlotDrop(slotPos, src), setOver);

  // 두 ref를 동일 요소에 부착
  const combinedRef = (el: HTMLDivElement | null) => {
    dragRef.current = el;
    dropRef.current = el;
  };

  if (filled && player && char && j) {
    const isMain = char.type === "main";
    const playerCol = pBadgeColor(player, player.id);
    return (
      <div
        ref={combinedRef}
        className={cn(
          "flex items-stretch rounded border cursor-grab active:cursor-grabbing transition-all min-h-[44px] bg-card",
          isMain
            ? "border-l-[4px] border-l-cat-arcana ring-1 ring-cat-arcana/30 shadow-[inset_0_0_0_1px_rgba(0,0,0,0)]"
            : "border-l-[3px] border-l-cat-barrack",
          isDup && "border-destructive ring-2 ring-destructive/70 bg-destructive/10",
          over && "ring-2 ring-cat-party scale-[1.02]"
        )}
        title={
          dupKind === "char"
            ? `⚠ 같은 캐릭터가 여러 슬롯에 배치됨 — ${player.name} · ${char.job}`
            : dupKind === "player"
              ? `⚠ 같은 플레이어가 이 세트 내 여러 슬롯에 배치됨 — ${player.name}`
              : `${player.name} · ${char.job} — 드래그로 자리 교체`
        }
      >
        <div
          className={cn(
            "w-8 flex flex-col items-center justify-center text-[10px] font-extrabold flex-shrink-0",
            isMain ? "bg-cat-arcana/20 text-cat-arcana" : "bg-cat-barrack/15 text-cat-barrack"
          )}
        >
          {isMain && <Crown className="h-2.5 w-2.5 mb-0.5" />}
          {isMain ? "본" : "부"}
        </div>

        <div
          className="flex flex-col items-center justify-center px-1.5 py-0.5 min-w-[48px] flex-shrink-0"
          style={{ background: `${j.color}10` }}
        >
          <span className="text-base leading-none">{j.icon}</span>
          <span className="text-[9px] font-bold leading-tight mt-0.5" style={{ color: j.color }}>{char.job}</span>
        </div>

        <div
          className="flex-1 min-w-0 flex items-center gap-1 px-2 py-1"
          style={{ background: `${j.color}10` }}
        >
          {!!char.cp && (
            <span className="text-gold font-extrabold tabular-nums text-sm">{pFmtN(char.cp)}</span>
          )}
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onOpenEquip(player.id, char.id); }}
            draggable={false}
            className="opacity-60 hover:opacity-100 hover:text-cat-party flex-shrink-0"
            title="장비/스킬 보기"
          >
            <Search className="h-3.5 w-3.5" />
          </button>
          <span
            className="font-extrabold text-sm truncate flex-1 cursor-text"
            title={`${char.name} (Shift+클릭: 캐릭터명 복사)`}
            onClick={(e) => {
              if (!e.shiftKey) return;
              e.stopPropagation();
              e.preventDefault();
              void copyText(char.name).then((ok) => {
                if (ok) showToast(`📋 복사됨: ${char.name}`);
              });
            }}
          >
            {charDisplayName(char, servers, defaultServerId)}
          </span>
        </div>

        <div
          className="flex items-center gap-1 px-1.5 flex-shrink-0"
          style={{ background: `${j.color}10` }}
        >
          <span
            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold border whitespace-nowrap max-w-[80px] truncate"
            style={{ borderColor: playerCol, color: playerCol, background: playerCol + "1a" }}
            title={player.name}
          >
            {player.name.slice(0, 2)}
          </span>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onClearSlot(); }}
            draggable={false}
            className="opacity-40 hover:opacity-100 hover:text-destructive flex-shrink-0 p-0.5 rounded hover:bg-destructive/10"
            title="배치 해제 (미배치로 회수)"
          >
            <Eraser className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // 빈 슬롯
  const open = slot.isOpen;
  return (
    <div
      ref={dropRef}
      className={cn(
        "flex items-center justify-between gap-2 rounded border border-dashed min-h-[44px] px-2 text-xs transition-all",
        open
          ? "border-muted-foreground/30 bg-muted/30 text-muted-foreground"
          : "border-muted-foreground/20 bg-muted/20 text-muted-foreground/40",
        over && "ring-2 ring-cat-party scale-[1.02]"
      )}
    >
      {open ? (
        <>
          <button
            type="button"
            onClick={onOpenSlotPicker}
            className="flex-1 flex items-center justify-center gap-2 hover:bg-muted/50 -mx-2 -my-1 px-2 py-1 rounded transition-colors"
            title="공석 — 클릭하여 캐릭터 DB에서 선택 배치"
          >
            <span className="px-1.5 py-0.5 rounded bg-muted-foreground/20 text-muted-foreground text-[10px] font-extrabold">공석</span>
          </button>
          <button
            type="button"
            onClick={onToggleSlotOpen}
            className="text-[10px] opacity-50 hover:opacity-100 hover:text-muted-foreground flex-shrink-0"
            title="이 슬롯을 비활성화"
          >
            ⊘
          </button>
        </>
      ) : (
        <button
          type="button"
          onClick={onToggleSlotOpen}
          className="flex-1 flex items-center justify-center gap-2"
          title="클릭하여 공석화"
        >
          <X className="h-3 w-3" />
          <span>비활성 슬롯</span>
        </button>
      )}
    </div>
  );
}
