"use client";

import { useMemo, useState } from "react";
import { Pencil, Trash2, Users } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import { pColor } from "@/lib/party/constants";
import type { Player, PlayerSortMode } from "@/lib/party/types";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

type Props = {
  activePid: string | null;
  onSelect: (pid: string | null) => void;
  sortMode: PlayerSortMode;
  query: string;
  onQueryChange: (q: string) => void;
};

function sortPlayers(arr: Player[], mode: PlayerSortMode): Player[] {
  if (mode === "name") return arr.slice().sort((a, b) => a.name.localeCompare(b.name, "ko"));
  // 본케 최고 전투력 내림차순
  return arr.slice().sort((a, b) => {
    const ma = Math.max(0, ...a.characters.filter((c) => c.type === "main").map((c) => c.cp || 0));
    const mb = Math.max(0, ...b.characters.filter((c) => c.type === "main").map((c) => c.cp || 0));
    return mb - ma;
  });
}

export function PlayerList({ activePid, onSelect, sortMode, query, onQueryChange }: Props) {
  const players = usePartyStore((s) => s.players);
  const removePlayer = usePartyStore((s) => s.removePlayer);
  const renamePlayer = usePartyStore((s) => s.renamePlayer);
  const reorder = usePartyStore((s) => s.reorderPlayers);

  const total = players.reduce((a, p) => a + p.characters.length, 0);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players;
    return players.filter((p) =>
      p.name.toLowerCase().includes(q) ||
      p.characters.some((c) => c.name.toLowerCase().includes(q))
    );
  }, [players, query]);
  const sorted = useMemo(() => sortPlayers(filtered, sortMode), [filtered, sortMode]);

  const [dragId, setDragId] = useState<string | null>(null);
  function onDragStart(e: React.DragEvent, pid: string) {
    setDragId(pid);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDragOver(e: React.DragEvent) {
    if (!dragId) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  }
  function onDrop(e: React.DragEvent, tgt: string) {
    e.preventDefault();
    if (!dragId || dragId === tgt) return setDragId(null);
    reorder(dragId, tgt);
    setDragId(null);
  }

  function handleRename(pid: string, current: string) {
    const next = prompt("플레이어 이름 변경", current);
    if (next === null) return;
    const trimmed = next.trim();
    if (!trimmed) { toast.error("이름을 입력하세요."); return; }
    renamePlayer(pid, trimmed);
  }
  async function handleDelete(pid: string, name: string) {
    if (!(await confirmDialog({ title: "플레이어 삭제", description: `'${name}'과 소속 캐릭터를 모두 삭제합니다.`, confirmText: "삭제", variant: "destructive" }))) return;
    removePlayer(pid);
  }

  return (
    <div className="flex flex-col gap-2 min-w-[260px] max-w-[280px]">
      <Input
        placeholder="이름·캐릭터 검색"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        className="h-8 text-xs"
      />
      <div className="text-[11px] text-muted-foreground">
        {players.length}명 · {total}캐릭
      </div>
      <div className="rounded-lg border bg-card overflow-auto max-h-[calc(100vh-260px)]">
        {players.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-xs">
            <Users className="h-6 w-6 inline-block mb-1 opacity-50" />
            <div>플레이어 없음</div>
          </div>
        ) : (
          <>
            {/* 전체 선택 */}
            {!query && (
              <button
                onClick={() => onSelect(null)}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left border-b",
                  activePid === null ? "bg-cat-party/[0.07] border-l-2 border-l-cat-party/60" : "hover:bg-accent/10 border-l-2 border-l-transparent"
                )}
              >
                <div className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold bg-muted">
                  전체
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-extrabold">전체 플레이어</div>
                  <div className="text-[10px] text-muted-foreground">{players.length}명 · {total}캐릭</div>
                </div>
              </button>
            )}
            {sorted.map((p) => {
              const mc = p.characters.filter((c) => c.type === "main").length;
              const sc = p.characters.filter((c) => c.type === "sub").length;
              return (
                <div
                  key={p.id}
                  draggable
                  onDragStart={(e) => onDragStart(e, p.id)}
                  onDragOver={onDragOver}
                  onDrop={(e) => onDrop(e, p.id)}
                  className={cn(
                    "flex items-center gap-2 px-2 py-1.5 text-xs border-b cursor-pointer transition-colors",
                    activePid === p.id ? "bg-cat-party/[0.07] border-l-2 border-l-cat-party/60" : "hover:bg-accent/10 border-l-2 border-l-transparent",
                    dragId === p.id && "opacity-50"
                  )}
                  onClick={() => onSelect(p.id)}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold text-foreground/90 flex-shrink-0"
                    style={{ background: pColor(p.id) }}
                  >
                    {p.name.slice(0, 1)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate flex items-center gap-1">
                      {p.name}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleRename(p.id, p.name); }}
                        className="text-muted-foreground hover:text-foreground"
                        title="이름 변경"
                      >
                        <Pencil className="h-3 w-3" />
                      </button>
                    </div>
                    <div className="text-[10px] text-muted-foreground truncate">
                      {mc > 0 && <span className="text-cat-arcana">본 {mc}</span>}
                      {mc > 0 && sc > 0 && " · "}
                      {sc > 0 && <span className="text-cat-barrack">부 {sc}</span>}
                      {mc === 0 && sc === 0 && <span>비어있음</span>}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="xs"
                    onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
