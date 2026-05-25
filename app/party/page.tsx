"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Settings, Image as ImageIcon, Users as UsersIcon, RefreshCw } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import { Button } from "@/components/ui/button";
import { GroupBar } from "@/components/party/group-bar";
import { ConfigPanel } from "@/components/party/config-panel";
import { SetsBoard } from "@/components/party/sets-board";
import { ParticipantAddDialog } from "@/components/party/participant-add-dialog";
import { RuleEditDialog } from "@/components/party/rule-edit-dialog";
import { PartyEquipMount } from "@/components/party/party-equip-mount";
import { CharPickerDialog } from "@/components/party/char-picker-dialog";
import { PartyRefreshCpDialog } from "@/components/party/refresh-cp-dialog";
import { toast } from "@/lib/util/toast";

export default function PartyPage() {
  const groups = usePartyStore((s) => s.groups);
  const activeGroupId = usePartyStore((s) => s.activeGroupId);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [pAddOpen, setPAddOpen] = useState(false);
  const [ruleEditOpen, setRuleEditOpen] = useState(false);
  const [ruleEditId, setRuleEditId] = useState<string | null>(null);
  const [slotPickerTarget, setSlotPickerTarget] = useState<null | { gid: string; setId: string; partyIdx: number; slotIdx: number }>(null);
  const [refreshCpOpen, setRefreshCpOpen] = useState(false);
  const boardRef = useRef<HTMLDivElement | null>(null);

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  const group = groups.find((g) => g.id === activeGroupId) ?? groups[0];

  async function saveImage() {
    if (!boardRef.current || !group) return;
    try {
      const mod = await import("html2canvas-pro");
      const html2canvas = mod.default;
      const canvas = await html2canvas(boardRef.current, {
        backgroundColor: getComputedStyle(document.body).backgroundColor,
        scale: 2,
      });
      const url = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = url;
      a.download = `party-${group.name}-${Date.now()}.png`;
      a.click();
    } catch (e) {
      toast.error("이미지 저장 실패: " + (e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">
            <UsersIcon className="h-5 w-5" /> 🧩 파티 편집
          </h1>
          <p className="text-xs text-muted-foreground mt-1">그룹을 만들고 참가자를 배치해 자동으로 파티를 구성하세요.</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRefreshCpOpen(true)}
            title="캐릭터 DB의 모든 캐릭터 전투력·아이템레벨을 일괄 갱신"
          >
            <RefreshCw className="h-4 w-4" /> 전체 갱신
          </Button>
          <Button size="sm" variant="ghost" onClick={saveImage} disabled={!group?.composed}>
            <ImageIcon className="h-4 w-4" /> 이미지 저장
          </Button>
          <Link
            href="/party/db"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded border hover:bg-accent/10"
          >
            🗂 캐릭터 DB
          </Link>
          <Link
            href="/party/settings"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded border hover:bg-accent/10"
          >
            <Settings className="h-3 w-3" /> 설정
          </Link>
        </div>
      </div>

      <GroupBar />

      {!group ? (
        <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
          그룹이 없습니다. 위에서 <b>그룹 추가</b>를 눌러 시작하세요.
        </div>
      ) : (
        <>
          <ConfigPanel
            group={group}
            onOpenAddParticipant={() => setPAddOpen(true)}
            onOpenRuleEdit={(id) => { setRuleEditId(id); setRuleEditOpen(true); }}
          />
          <div ref={boardRef}>
            <SetsBoard
              group={group}
              onOpenSlotPicker={(setId, partyIdx, slotIdx) => setSlotPickerTarget({ gid: group.id, setId, partyIdx, slotIdx })}
            />
          </div>
        </>
      )}

      <PartyEquipMount />
      <ParticipantAddDialog open={pAddOpen} gid={group?.id ?? null} onClose={() => setPAddOpen(false)} />
      <RuleEditDialog
        open={ruleEditOpen}
        gid={group?.id ?? null}
        ruleId={ruleEditId}
        onClose={() => setRuleEditOpen(false)}
      />
      <CharPickerDialog
        open={!!slotPickerTarget}
        target={slotPickerTarget}
        onClose={() => setSlotPickerTarget(null)}
      />
      <PartyRefreshCpDialog open={refreshCpOpen} onClose={() => setRefreshCpOpen(false)} />
    </div>
  );
}
