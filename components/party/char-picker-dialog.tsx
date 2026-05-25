"use client";

import { useEffect, useMemo, useState } from "react";
import { Sword, Search } from "lucide-react";
import { usePartyStore, charDisplayName } from "@/lib/party/store";
import { jI, pColor, pFmtN } from "@/lib/party/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Target = {
  gid: string;
  setId: string;
  partyIdx: number;
  slotIdx: number;
};

type Props = {
  open: boolean;
  target: Target | null;
  onClose: () => void;
};

/** 공석 슬롯 클릭 → 캐릭터 DB에서 직접 배치하는 다이얼로그.
 *  참가자에 없으면 자동 등록 (placeCharToSlot 내부 처리). */
export function CharPickerDialog({ open, target, onClose }: Props) {
  const players = usePartyStore((s) => s.players);
  const servers = usePartyStore((s) => s.servers);
  const defaultServerId = usePartyStore((s) => s.defaultServerId);
  const groups = usePartyStore((s) => s.groups);
  const placeCharToSlot = usePartyStore((s) => s.placeCharToSlot);

  const [query, setQuery] = useState("");
  useEffect(() => { if (open) setQuery(""); }, [open]);

  /** 현재 그룹의 모든 세트에서 charId의 배치 위치 — 첫 발견 슬롯 기록.
   *  isCurrentSet: 클릭 시 진입 중인 슬롯과 같은 세트인지 여부. */
  const charPlacement = useMemo(() => {
    const map = new Map<string, { setIdx: number; partyIdx: number; isCurrentSet: boolean }>();
    if (!target) return map;
    const g = groups.find((x) => x.id === target.gid);
    if (!g) return map;
    g.generatedSets.forEach((st, setIdx) => {
      st.parties.forEach((p, pIdx) => {
        p.slots.forEach((sl) => {
          if (!sl.charId) return;
          if (map.has(sl.charId)) return;  // 첫 발견 위치만 기록
          map.set(sl.charId, {
            setIdx,
            partyIdx: pIdx,
            isCurrentSet: st.id === target.setId,
          });
        });
      });
    });
    return map;
  }, [groups, target]);

  if (!target) return null;

  const q = query.trim().toLowerCase();
  const filteredPlayers = players
    .map((p) => {
      const chars = p.characters
        .filter((c) => {
          if (!q) return true;
          return c.name.toLowerCase().includes(q) || c.job.toLowerCase().includes(q) || p.name.toLowerCase().includes(q);
        })
        .sort((a, b) => {
          if (a.type !== b.type) return a.type === "main" ? -1 : 1;
          return (b.cp || 0) - (a.cp || 0);
        });
      return { player: p, chars };
    })
    .filter(({ chars }) => chars.length > 0);

  function pick(pid: string, cid: string) {
    placeCharToSlot(target!.gid, target!.setId, target!.partyIdx, target!.slotIdx, pid, cid);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sword className="h-4 w-4" /> 캐릭터 선택 — 공석에 배치
          </DialogTitle>
        </DialogHeader>
        <div className="text-[11px] text-muted-foreground">
          캐릭터 DB의 모든 캐릭터에서 선택할 수 있습니다. 참가자에 없는 캐릭터를 선택하면 <b>자동으로 참가자에 등록</b>됩니다.
          이미 다른 슬롯에 배치된 캐릭터를 선택하면 해당 슬롯이 공석이 되며 이쪽으로 이동합니다.
        </div>

        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="플레이어 / 캐릭터명 / 직업 검색…"
            className="pl-8"
            autoFocus
          />
        </div>

        <div className="max-h-[60vh] overflow-y-auto rounded border bg-card/40">
          {filteredPlayers.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">검색 결과 없음</div>
          ) : (
            filteredPlayers.map(({ player, chars }) => (
              <div key={player.id} className="border-b last:border-b-0">
                <div className="flex items-center gap-2 px-3 py-1.5 bg-muted/30">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: pColor(player.id) }}
                  >{player.name.slice(0, 1)}</div>
                  <span className="font-bold text-xs">{player.name}</span>
                  <span className="text-[10px] text-muted-foreground">{chars.length}캐릭터</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1 p-1.5">
                  {chars.map((c) => {
                    const j = jI(c.job);
                    const placement = charPlacement.get(c.id);
                    const placed = !!placement;
                    const placedLabel = placement
                      ? (placement.isCurrentSet
                          ? `${placement.partyIdx + 1}P`
                          : `${placement.setIdx + 1}S-${placement.partyIdx + 1}P`)
                      : "";
                    const placedTitle = placement
                      ? (placement.isCurrentSet
                          ? `현재 세트 ${placement.partyIdx + 1}파티에 배치중 — 클릭하면 이쪽으로 이동`
                          : `${placement.setIdx + 1}세트 ${placement.partyIdx + 1}파티에 배치중 — 클릭하면 이쪽으로 이동(중복 배치 가능)`)
                      : "클릭하여 배치";
                    const isMain = c.type === "main";
                    return (
                      <button
                        key={c.id}
                        onClick={() => pick(player.id, c.id)}
                        className={cn(
                          "flex items-stretch rounded border text-left hover:bg-accent/10 transition-colors min-h-[34px]",
                          // 비활성화 시각만 — 실제 disabled 아님. opacity 낮춰 시각 구분.
                          placed && "opacity-55 hover:opacity-90"
                        )}
                        title={placedTitle}
                      >
                        <div
                          className={cn(
                            "w-6 flex items-center justify-center text-[9px] font-extrabold",
                            isMain ? "bg-cat-arcana/15 text-cat-arcana" : "bg-cat-barrack/15 text-cat-barrack"
                          )}
                        >{isMain ? "본" : "부"}</div>
                        <div
                          className="flex flex-col items-center justify-center px-1 border-l border-r min-w-[36px]"
                          style={{ background: `${j.color}10` }}
                        >
                          <span className="text-sm leading-none">{j.icon}</span>
                          <span className="text-[8px] font-bold leading-tight mt-0.5" style={{ color: j.color }}>{c.job}</span>
                        </div>
                        <div className="flex-1 min-w-0 flex items-center gap-1 px-2 py-0.5">
                          <span className="font-extrabold text-xs truncate" title={c.name}>
                            {charDisplayName(c, servers, defaultServerId)}
                          </span>
                        </div>
                        <div className="flex items-center gap-1 pr-2 flex-shrink-0">
                          {!!c.cp && <span className="text-gold font-extrabold tabular-nums text-xs">{pFmtN(c.cp)}</span>}
                          {placement && (
                            <span
                              className={cn(
                                "text-[9px] px-1.5 py-0.5 rounded font-extrabold tabular-nums border",
                                placement.isCurrentSet
                                  ? "bg-cat-party/15 text-cat-party border-cat-party/40"
                                  : "bg-amber-500/15 text-amber-500 border-amber-500/40"
                              )}
                              title={placedTitle}
                            >
                              {placedLabel}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
