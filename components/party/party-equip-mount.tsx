"use client";

import { usePartyStore } from "@/lib/party/store";
import { useEquipModal } from "@/lib/party/equip-modal-store";
import { jI } from "@/lib/party/constants";
import { EquipDialog } from "@/components/barrack/equip-dialog";

/** 어디서든 useEquipModal.openFor(pid, cid)로 호출 가능. */
export function PartyEquipMount() {
  const { open, pid, cid, close } = useEquipModal();
  const players = usePartyStore((s) => s.players);
  const servers = usePartyStore((s) => s.servers);

  const player = pid ? players.find((p) => p.id === pid) : null;
  const char = player && cid ? player.characters.find((c) => c.id === cid) : null;
  const server = char ? servers.find((s) => s.serverId === char.serverId) : null;
  const job = char ? jI(char.job) : null;

  if (!char) return null;

  return (
    <EquipDialog
      open={open}
      directChar={{
        cid: char.characterId ?? "",
        serverId: char.serverId ?? 0,
        name: char.name,
        cp: char.cp,
        itemLevel: char.itemLevel,
        classIcon: job?.icon,
        classColor: job?.color,
        className: char.job,
        serverName: server?.name,
        raceForUrl: server?.race,
      }}
      onClose={close}
    />
  );
}
