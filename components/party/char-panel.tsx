"use client";

import { useMemo } from "react";
import { Plus, Pencil, Trash2, Shirt, ExternalLink, Sword, Search } from "lucide-react";
import { usePartyStore, charDisplayName } from "@/lib/party/store";
import { useEquipModal } from "@/lib/party/equip-modal-store";
import { jI, pColor, pFmtN } from "@/lib/party/constants";
import type { Player, PartyCharacter } from "@/lib/party/types";
import { Button } from "@/components/ui/button";
import { cn, copyText, showToast } from "@/lib/utils";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

type Props = {
  activePid: string | null;
  onAddChar: (pid: string) => void;
  onEditChar: (pid: string, cid: string) => void;
  onEquip: (pid: string, cid: string) => void;
};

export function CharPanel({ activePid, onAddChar, onEditChar, onEquip }: Props) {
  const players = usePartyStore((s) => s.players);
  const servers = usePartyStore((s) => s.servers);
  const defaultServerId = usePartyStore((s) => s.defaultServerId);
  const removeCharacter = usePartyStore((s) => s.removeCharacter);

  if (activePid === null) {
    return <AllPlayersView onAddChar={onAddChar} onEditChar={onEditChar} onEquip={onEquip} />;
  }

  const player = players.find((p) => p.id === activePid);
  if (!player) {
    return (
      <div className="rounded-lg border bg-card p-6 text-center text-muted-foreground text-sm">
        <Sword className="h-8 w-8 inline-block opacity-40 mb-2" />
        <div>왼쪽에서 플레이어를 선택하세요.</div>
      </div>
    );
  }

  const mains = player.characters.filter((c) => c.type === "main").sort((a, b) => (b.cp || 0) - (a.cp || 0));
  const subs = player.characters.filter((c) => c.type === "sub").sort((a, b) => (b.cp || 0) - (a.cp || 0));
  const sorted = [...mains, ...subs];

  function handleProfile(c: PartyCharacter) {
    if (!c.serverId) { toast.error("서버 정보가 없습니다. 캐릭터 수정에서 서버를 설정해주세요."); return; }
    const url = `https://www.aion2tool.com/char/serverid=${c.serverId}/${encodeURIComponent(c.name)}`;
    window.open(url, "_blank", "noopener,noreferrer");
  }
  const pid = player.id;
  const handleDelete = async (c: PartyCharacter) => {
    if (!(await confirmDialog({ title: "캐릭터 삭제", description: `'${c.name}'을 삭제하시겠습니까?`, confirmText: "삭제", variant: "destructive" }))) return;
    removeCharacter(pid, c.id);
  };

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      <div className="flex items-center justify-between px-3 py-2 border-b bg-muted/30">
        <div className="font-extrabold text-sm">
          {player.name}의 캐릭터
          <span className="text-muted-foreground font-normal text-[11px] ml-2">
            본 {mains.length} · 부 {subs.length} · 총 {sorted.length}
          </span>
        </div>
        <Button size="sm" onClick={() => onAddChar(player.id)}>
          <Plus className="h-4 w-4" /> 캐릭터 추가
        </Button>
      </div>
      {sorted.length === 0 ? (
        <div className="text-center py-10 text-muted-foreground text-xs">
          <Sword className="h-7 w-7 inline-block opacity-40 mb-2" />
          <div>캐릭터 없음</div>
        </div>
      ) : (
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-2 py-1.5 text-left w-12">구분</th>
              <th className="px-2 py-1.5 text-left w-32">직업</th>
              <th className="px-2 py-1.5 text-left">캐릭터명</th>
              <th className="px-2 py-1.5 text-right text-gold w-20">전투력</th>
              <th className="px-2 py-1.5 text-right text-muted-foreground w-20">아이템 Lv</th>
              <th className="px-2 py-1.5 w-32">액션</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((c) => {
              const j = jI(c.job);
              const jobBg = `${j.color}10`;
              return (
                <tr key={c.id} className="border-t hover:bg-accent/5">
                  <td className="px-2 py-1.5">
                    <span
                      className={cn(
                        "inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold",
                        c.type === "main"
                          ? "bg-cat-arcana/20 text-cat-arcana"
                          : "bg-cat-barrack/20 text-cat-barrack"
                      )}
                    >
                      {c.type === "main" ? "본케" : "부케"}
                    </span>
                  </td>
                  <td className="px-2 py-1.5" style={{ background: jobBg }}>
                    <button
                      onClick={() => handleProfile(c)}
                      title="aion2tool.com 프로필"
                      className="hover:underline"
                    >
                      <span className="text-lg align-middle">{j.icon}</span>
                      <span className="ml-1 font-bold align-middle" style={{ color: j.color }}>{c.job}</span>
                    </button>
                  </td>
                  <td className="px-2 py-1.5">
                    <div className="flex items-center gap-1">
                      <CharSearchButton pid={player.id} cid={c.id} />
                      <button
                        onClick={(e) => {
                          if (e.shiftKey) {
                            e.preventDefault();
                            e.stopPropagation();
                            void copyText(c.name).then((ok) => {
                              if (ok) showToast(`📋 복사됨: ${c.name}`);
                            });
                            return;
                          }
                          onEditChar(player.id, c.id);
                        }}
                        className="font-extrabold text-sm hover:underline"
                        title={`${c.name} (Shift+클릭: 캐릭터명 복사)`}
                      >
                        {charDisplayName(c, servers, defaultServerId)}
                      </button>
                    </div>
                  </td>
                  <td className="px-2 py-1.5 text-right tabular-nums font-bold text-gold" style={{ background: jobBg }}>{pFmtN(c.cp)}</td>
                  <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground" style={{ background: jobBg }}>{c.itemLevel || "—"}</td>
                  <td className="px-2 py-1.5">
                    <div className="flex gap-1 justify-end">
                      {c.characterId && c.serverId && (
                        <Button variant="ghost" size="xs" onClick={() => onEquip(player.id, c.id)} title="장비">
                          <Shirt className="h-3 w-3" />
                        </Button>
                      )}
                      {c.serverId && (
                        <Button variant="ghost" size="xs" onClick={() => handleProfile(c)} title="외부 프로필">
                          <ExternalLink className="h-3 w-3" />
                        </Button>
                      )}
                      <Button variant="ghost" size="xs" onClick={() => onEditChar(player.id, c.id)}>
                        <Pencil className="h-3 w-3" /> 수정
                      </Button>
                      <Button variant="ghost" size="xs" onClick={() => handleDelete(c)} className="text-destructive">
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function AllPlayersView({ onAddChar, onEditChar, onEquip }: Pick<Props, "onAddChar" | "onEditChar" | "onEquip">) {
  const players = usePartyStore((s) => s.players);
  const servers = usePartyStore((s) => s.servers);
  const defaultServerId = usePartyStore((s) => s.defaultServerId);

  const cards = useMemo(() => players, [players]);

  if (!cards.length) {
    return (
      <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
        <Sword className="h-8 w-8 inline-block opacity-40 mb-2" />
        <div className="text-sm">플레이어가 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="font-extrabold text-sm mb-3">
        전체 플레이어 캐릭터
        <span className="text-[11px] text-muted-foreground font-normal ml-2">
          {players.length}명 · 총 {players.reduce((a, p) => a + p.characters.length, 0)}캐릭터
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
        {cards.map((p) => <PlayerCard
          key={p.id}
          player={p}
          servers={servers}
          defaultServerId={defaultServerId}
          onAddChar={onAddChar}
          onEditChar={onEditChar}
          onEquip={onEquip}
        />)}
      </div>
    </div>
  );
}

function PlayerCard({
  player, servers, defaultServerId, onAddChar, onEditChar, onEquip,
}: {
  player: Player;
  servers: ReturnType<typeof usePartyStore.getState>["servers"];
  defaultServerId: number | null;
  onAddChar: (pid: string) => void;
  onEditChar: (pid: string, cid: string) => void;
  onEquip: (pid: string, cid: string) => void;
}) {
  const mains = player.characters.filter((c) => c.type === "main").sort((a, b) => (b.cp || 0) - (a.cp || 0));
  const subs = player.characters.filter((c) => c.type === "sub").sort((a, b) => (b.cp || 0) - (a.cp || 0));
  return (
    <div className="rounded-md border bg-card/40 p-2">
      <div className="flex items-center gap-2 pb-1.5 mb-1.5 border-b">
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0"
          style={{ background: pColor(player.id) }}
        >
          {player.name.slice(0, 1)}
        </div>
        <div className="font-bold text-sm flex-1 truncate">{player.name}</div>
        <span className="text-[10px] text-muted-foreground border rounded-full px-2">{player.characters.length}</span>
        <Button variant="ghost" size="xs" onClick={() => onAddChar(player.id)} title="캐릭터 추가">
          <Plus className="h-3 w-3" />
        </Button>
      </div>
      {player.characters.length === 0 ? (
        <div className="text-[11px] text-muted-foreground italic py-2 text-center">캐릭터 없음</div>
      ) : (
        <div className="space-y-1">
          {mains.map((c) => <CharRow key={c.id} c={c} pid={player.id} servers={servers} defaultServerId={defaultServerId} onEdit={onEditChar} onEquip={onEquip} />)}
          {subs.length > 0 && <div className="text-[9px] text-muted-foreground tracking-wider mt-1.5">부케</div>}
          {subs.map((c) => <CharRow key={c.id} c={c} pid={player.id} servers={servers} defaultServerId={defaultServerId} onEdit={onEditChar} onEquip={onEquip} />)}
        </div>
      )}
    </div>
  );
}

function CharSearchButton({ pid, cid, small }: { pid: string; cid: string; small?: boolean }) {
  const openEquip = useEquipModal((s) => s.openFor);
  // <button> 내부에 중첩되지 않도록 span role=button 사용 (CharRow가 button 래퍼)
  return (
    <span
      role="button"
      tabIndex={0}
      onClick={(e) => { e.stopPropagation(); openEquip(pid, cid); }}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          e.stopPropagation();
          openEquip(pid, cid);
        }
      }}
      className="opacity-60 hover:opacity-100 hover:text-cat-party flex-shrink-0 cursor-pointer inline-flex"
      title="장비/스킬 보기"
    >
      <Search className={small ? "h-3 w-3" : "h-3.5 w-3.5"} />
    </span>
  );
}

function CharRow({
  c, pid, servers, defaultServerId, onEdit, onEquip,
}: {
  c: PartyCharacter;
  pid: string;
  servers: ReturnType<typeof usePartyStore.getState>["servers"];
  defaultServerId: number | null;
  onEdit: (pid: string, cid: string) => void;
  onEquip: (pid: string, cid: string) => void;
}) {
  const j = jI(c.job);
  return (
    <button
      onClick={(e) => {
        if (e.shiftKey) {
          e.preventDefault();
          e.stopPropagation();
          void copyText(c.name).then((ok) => {
            if (ok) showToast(`📋 복사됨: ${c.name}`);
          });
          return;
        }
        onEdit(pid, c.id);
      }}
      className={cn(
        "w-full flex items-center gap-2 px-2 py-2 rounded border bg-background/50 hover:bg-accent/10 text-sm text-left transition-colors min-h-[36px]",
        c.type === "main" ? "border-l-2 border-l-cat-arcana" : "border-l-2 border-l-cat-barrack"
      )}
      title={`${c.name} (Shift+클릭: 캐릭터명 복사)`}
    >
      <span className="text-lg leading-none">{j.icon}</span>
      <CharSearchButton pid={pid} cid={c.id} />
      <span className="font-bold flex-1 truncate">
        {charDisplayName(c, servers, defaultServerId)}
      </span>
      {c.cp ? (
        <span className="text-gold font-extrabold tabular-nums">{pFmtN(c.cp)}</span>
      ) : null}
      {c.characterId && c.serverId && (
        <span
          role="button"
          onClick={(e) => { e.stopPropagation(); onEquip(pid, c.id); }}
          className="text-muted-foreground hover:text-gold"
          title="장비"
        >
          <Shirt className="h-3.5 w-3.5" />
        </span>
      )}
    </button>
  );
}
