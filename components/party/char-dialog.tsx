"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { usePartyStore, newCharId } from "@/lib/party/store";
import { PARTY_JOBS } from "@/lib/party/constants";
import type { PartyCharacter } from "@/lib/party/types";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

type Props = { open: boolean; pid: string | null; cid: string | null; onClose: () => void };

const EMPTY: PartyCharacter = {
  id: "", name: "", job: "수호성", type: "main",
  cp: 0, itemLevel: 0, characterId: "", serverId: undefined,
};

export function CharDialog({ open, pid, cid, onClose }: Props) {
  const players = usePartyStore((s) => s.players);
  const servers = usePartyStore((s) => s.servers);
  const defaultServerId = usePartyStore((s) => s.defaultServerId);
  const upsert = usePartyStore((s) => s.upsertCharacter);
  const remove = usePartyStore((s) => s.removeCharacter);

  const player = pid ? players.find((p) => p.id === pid) : null;
  const editing = player && cid ? player.characters.find((c) => c.id === cid) : null;

  const [draft, setDraft] = useState<PartyCharacter>(EMPTY);
  const [race, setRace] = useState<"천족" | "마족">("천족");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft({ ...editing });
      const sv = servers.find((s) => s.serverId === editing.serverId);
      setRace((sv?.race === "마족" ? "마족" : "천족"));
    } else {
      setDraft({ ...EMPTY, id: newCharId(), serverId: defaultServerId ?? undefined });
      const def = servers.find((s) => s.serverId === defaultServerId);
      setRace(def?.race === "마족" ? "마족" : "천족");
    }
  }, [open, editing, servers, defaultServerId]);

  const filteredServers = useMemo(
    () => servers.filter((s) => s.race === race),
    [servers, race]
  );

  function patch<K extends keyof PartyCharacter>(k: K, v: PartyCharacter[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function handleSave() {
    if (!pid) return;
    if (!draft.name.trim()) { toast.error("캐릭터명을 입력하세요."); return; }
    upsert(pid, { ...draft, name: draft.name.trim() });
    onClose();
  }
  async function handleDelete() {
    if (!pid || !editing) return;
    if (!(await confirmDialog({ title: "캐릭터 삭제", description: `'${editing.name}' 캐릭터를 삭제하시겠습니까?`, confirmText: "삭제", variant: "destructive" }))) return;
    remove(pid, editing.id);
    onClose();
  }

  if (!player) return null;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "✎ 캐릭터 수정" : "＋ 캐릭터 추가"} — {player.name}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">캐릭터명</Label>
            <Input value={draft.name} onChange={(e) => patch("name", e.target.value)} autoFocus />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">구분</Label>
            <Select value={draft.type} onValueChange={(v) => patch("type", v as "main" | "sub")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="main">본케</SelectItem>
                <SelectItem value="sub">부케</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">직업</Label>
            <Select value={draft.job} onValueChange={(v) => patch("job", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PARTY_JOBS.map((j) => (
                  <SelectItem key={j.id} value={j.id}>{j.icon} {j.id}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">종족</Label>
            <Select value={race} onValueChange={(v) => setRace(v as "천족" | "마족")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="천족">천족</SelectItem>
                <SelectItem value="마족">마족</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">서버</Label>
            <Select
              value={draft.serverId ? String(draft.serverId) : "_none"}
              onValueChange={(v) => patch("serverId", v === "_none" ? undefined : Number(v))}
            >
              <SelectTrigger><SelectValue placeholder="서버 선택" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_none">미지정</SelectItem>
                {filteredServers.map((s) => (
                  <SelectItem key={s.serverId} value={String(s.serverId)}>{s.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">전투력</Label>
            <Input
              type="number" min={0}
              value={draft.cp ?? 0}
              onChange={(e) => patch("cp", Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">아이템 레벨</Label>
            <Input
              type="number" min={0}
              value={draft.itemLevel ?? 0}
              onChange={(e) => patch("itemLevel", Number(e.target.value) || 0)}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">
              캐릭터 ID (game characterId · 장비/스킬 조회용, 선택)
            </Label>
            <Input
              value={draft.characterId ?? ""}
              onChange={(e) => patch("characterId", e.target.value)}
              placeholder="aion2.plaync.com character ID"
            />
          </div>
        </div>

        <DialogFooter className="justify-between">
          {editing ? (
            <Button variant="ghost" onClick={handleDelete} className="text-destructive">
              🗑 삭제
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button onClick={handleSave}>{editing ? "저장" : "추가"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
