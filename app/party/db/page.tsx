"use client";

import { useEffect, useState } from "react";
import { UserPlus, Download, Upload, ArrowDownAZ, Sword } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import { jI } from "@/lib/party/constants";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { PlayerList } from "@/components/party/player-list";
import { CharPanel } from "@/components/party/char-panel";
import { PlayerAddDialog } from "@/components/party/player-add-dialog";
import { CharDialog } from "@/components/party/char-dialog";
import { EquipDialog } from "@/components/barrack/equip-dialog";
import { PartyEquipMount } from "@/components/party/party-equip-mount";
import type { PlayerSortMode } from "@/lib/party/types";
import { toast } from "@/lib/util/toast";

export default function PartyDbPage() {
  const players = usePartyStore((s) => s.players);
  const servers = usePartyStore((s) => s.servers);
  const importAllFromFile = usePartyStore((s) => s.importAllFromFile);
  const importDBOnly = usePartyStore((s) => s.importDBOnly);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [activePid, setActivePid] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [sortMode, setSortMode] = useState<PlayerSortMode>("name");

  const [playerAddOpen, setPlayerAddOpen] = useState(false);
  const [charOpen, setCharOpen] = useState(false);
  const [charDialogPid, setCharDialogPid] = useState<string | null>(null);
  const [charDialogCid, setCharDialogCid] = useState<string | null>(null);

  const [equipOpen, setEquipOpen] = useState(false);
  const [equipChar, setEquipChar] = useState<null | { pid: string; cid: string }>(null);

  function openCharAdd(pid: string) {
    setCharDialogPid(pid);
    setCharDialogCid(null);
    setCharOpen(true);
  }
  function openCharEdit(pid: string, cid: string) {
    setCharDialogPid(pid);
    setCharDialogCid(cid);
    setCharOpen(true);
  }
  function openEquip(pid: string, cid: string) {
    setEquipChar({ pid, cid });
    setEquipOpen(true);
  }

  function exportAll() {
    const s = usePartyStore.getState();
    const blob = new Blob([JSON.stringify({
      players: s.players,
      groups: s.groups,
      activeGroupId: s.activeGroupId,
      servers: s.servers,
      defaultServerId: s.defaultServerId,
    }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "party-compose-all.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function exportDBOnly() {
    const blob = new Blob([JSON.stringify({ players }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "character-db.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  function importFile() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,.txt";
    inp.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = (ev) => {
        try {
          const d = JSON.parse(String(ev.target?.result));
          // 형식 1: {players: ...} only → DB 만 교체
          // 형식 2: 전체 {players, groups, ...}
          if (d.groups || d.activeGroupId || d.servers) importAllFromFile(d);
          else if (Array.isArray(d.players)) importDBOnly(d.players);
          else if (Array.isArray(d)) importDBOnly(d);
          else throw new Error("형식 오류");
          toast.success("데이터를 불러왔습니다.");
        } catch (err) {
          toast.error("파일 형식 오류: " + (err as Error).message);
        }
      };
      rd.readAsText(f);
    };
    inp.click();
  }

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  // 장비 모달용 캐릭터 정보
  const equipPlayer = equipChar ? players.find((p) => p.id === equipChar.pid) : null;
  const equipCharObj = equipPlayer ? equipPlayer.characters.find((c) => c.id === equipChar!.cid) : null;
  const equipServer = equipCharObj ? servers.find((s) => s.serverId === equipCharObj.serverId) : null;
  const equipJob = equipCharObj ? jI(equipCharObj.job) : null;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <Sword className="h-5 w-5" /> 🗂 캐릭터 DB
          </h1>
          <p className="text-xs text-muted-foreground mt-1">파티 구성에 사용할 플레이어 · 캐릭터 마스터</p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" onClick={() => setPlayerAddOpen(true)}>
            <UserPlus className="h-4 w-4" /> 플레이어 추가
          </Button>
          <div className="inline-flex rounded-md border overflow-hidden bg-card">
            <button
              onClick={() => setSortMode("name")}
              className={cn("px-3 py-1.5 text-xs font-bold", sortMode === "name" ? "bg-cat-party/15 text-cat-party" : "text-muted-foreground hover:text-foreground")}
              title="이름 가나다순"
            >
              <ArrowDownAZ className="h-3 w-3 inline-block mr-1" />가나다
            </button>
            <button
              onClick={() => setSortMode("cp")}
              className={cn("px-3 py-1.5 text-xs font-bold border-l", sortMode === "cp" ? "bg-cat-party/15 text-cat-party" : "text-muted-foreground hover:text-foreground")}
              title="본케 최고 전투력순"
            >
              전투력↓
            </button>
          </div>
          <Button size="sm" variant="ghost" onClick={exportDBOnly}>
            <Download className="h-4 w-4" /> DB 저장
          </Button>
          <Button size="sm" variant="ghost" onClick={exportAll}>
            <Download className="h-4 w-4" /> 전체 저장
          </Button>
          <Button size="sm" variant="ghost" onClick={importFile}>
            <Upload className="h-4 w-4" /> 불러오기
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-start">
        <PlayerList
          activePid={activePid}
          onSelect={setActivePid}
          sortMode={sortMode}
          query={query}
          onQueryChange={setQuery}
        />
        <div className="flex-1 min-w-0">
          <CharPanel
            activePid={activePid}
            onAddChar={openCharAdd}
            onEditChar={openCharEdit}
            onEquip={openEquip}
          />
        </div>
      </div>

      <PartyEquipMount />
      <PlayerAddDialog open={playerAddOpen} onClose={() => setPlayerAddOpen(false)} />
      <CharDialog
        open={charOpen}
        pid={charDialogPid}
        cid={charDialogCid}
        onClose={() => setCharOpen(false)}
      />
      {equipCharObj && (
        <EquipDialog
          open={equipOpen}
          directChar={{
            cid: equipCharObj.characterId ?? "",
            serverId: equipCharObj.serverId ?? 0,
            name: equipCharObj.name,
            classIcon: equipJob?.icon,
            classColor: equipJob?.color,
            className: equipCharObj.job,
            serverName: equipServer?.name,
            raceForUrl: equipServer?.race,
          }}
          onClose={() => setEquipOpen(false)}
        />
      )}
    </div>
  );
}
