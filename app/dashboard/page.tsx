"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Sun, RotateCcw, Eye, EyeOff, UserPlus, Users, Zap, ChevronDown, ChevronUp, Download, Upload, Building2, RefreshCw } from "lucide-react";
import { exportBarrackTxt, importBarrackTxt } from "@/lib/barrack/backup";
import { useResetTick } from "@/components/barrack/use-reset-tick";
import { CorridorBulkDialog } from "@/components/barrack/corridor-bulk-dialog";
import { EquipDialog } from "@/components/barrack/equip-dialog";
import { RefreshCpDialog } from "@/components/barrack/refresh-cp-dialog";
import { ArtisanDialog } from "@/components/barrack/artisan-dialog";
import { Hammer } from "lucide-react";
import { useBarrackStore, sortCharacters } from "@/lib/barrack/store";
import { Button } from "@/components/ui/button";
import { AccountTabs } from "@/components/barrack/account-tabs";
import { CharacterCard } from "@/components/barrack/character-card";
import { CharacterDialog } from "@/components/barrack/character-dialog";
import { AccountDialog } from "@/components/barrack/account-dialog";
import { KinaCard } from "@/components/barrack/kina-card";
import { ChargePanel } from "@/components/barrack/charge-panel";
import { AccountServerBar } from "@/components/barrack/account-server-bar";
import { CorridorDialog } from "@/components/barrack/corridor-dialog";
import { HiddenCharRow } from "@/components/barrack/hidden-char-row";
import { OdEditDialog } from "@/components/barrack/od-edit-dialog";
import { formatToday } from "@/lib/barrack/time";
import { confirmDialog } from "@/lib/util/confirm";
import type { Character } from "@/lib/barrack/types";
import Link from "next/link";

function groupByServer(chars: Character[]): { server: string; chars: Character[] }[] {
  const map: Record<string, Character[]> = {};
  for (const c of chars) {
    const k = c.server || "";
    (map[k] ??= []).push(c);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([server, chars]) => ({ server, chars }));
}

export default function DashboardPage() {
  useResetTick();
  const accounts = useBarrackStore((s) => s.accounts);
  const moveAccount = useBarrackStore((s) => s.moveAccount);
  const characters = useBarrackStore((s) => s.characters);
  const characterOrder = useBarrackStore((s) => s.characterOrder);
  const setCharacterOrder = useBarrackStore((s) => s.setCharacterOrder);
  const selectedAccId = useBarrackStore((s) => s.selectedAccId);
  const showHidden = useBarrackStore((s) => s.showHiddenChars);
  const setShowHidden = useBarrackStore((s) => s.setShowHiddenChars);
  const dailyReset = useBarrackStore((s) => s.dailyReset);
  const weeklyReset = useBarrackStore((s) => s.weeklyReset);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [charDialogOpen, setCharDialogOpen] = useState(false);
  const [editCharId, setEditCharId] = useState<string | null>(null);
  const [accDialogOpen, setAccDialogOpen] = useState(false);
  const [editAccId, setEditAccId] = useState<string | null>(null);
  const [corridorOpen, setCorridorOpen] = useState(false);
  const [corridorId, setCorridorId] = useState<string | null>(null);
  const [odOpen, setOdOpen] = useState(false);
  const [odId, setOdId] = useState<string | null>(null);
  const [bulkCorridorOpen, setBulkCorridorOpen] = useState(false);
  const [equipOpen, setEquipOpen] = useState(false);
  const [equipId, setEquipId] = useState<string | null>(null);
  const [refreshCpOpen, setRefreshCpOpen] = useState(false);
  const [artisanOpen, setArtisanOpen] = useState(false);

  // 드래그 상태
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const sortedChars = useMemo(
    () => sortCharacters(characters, characterOrder),
    [characters, characterOrder]
  );
  const visibleChars = useMemo(() => sortedChars.filter((c) => !c.hidden), [sortedChars]);
  const hiddenChars = useMemo(() => sortedChars.filter((c) => c.hidden), [sortedChars]);
  const targetAccounts = useMemo(
    () => (selectedAccId ? accounts.filter((a) => a.id === selectedAccId) : accounts),
    [accounts, selectedAccId]
  );

  async function handleDailyReset() {
    if (!(await confirmDialog({ title: "일일 콘텐츠 초기화", description: "일일 콘텐츠를 초기화하시겠습니까?\n(사명·악몽 등)", confirmText: "초기화", variant: "destructive" }))) return;
    dailyReset();
  }
  async function handleWeeklyReset() {
    if (!(await confirmDialog({ title: "주간 콘텐츠 초기화", description: "주간 콘텐츠를 초기화하시겠습니까?\n(원정·초월·성역·각성·상점·회랑 등)", confirmText: "초기화", variant: "destructive" }))) return;
    weeklyReset();
  }

  // ── 드래그 핸들러 (같은 서버 그룹 내에서만 정렬) ──
  function findGroupKey(id: string): string {
    const c = characters.find((x) => x.id === id);
    if (!c) return "";
    return `${c.accountId}::${c.server || ""}`;
  }
  function onDragStart(e: React.DragEvent, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    try { e.dataTransfer.setData("text/plain", id); } catch {}
  }
  function onDragOver(e: React.DragEvent, id: string) {
    if (!draggingId || draggingId === id) return;
    if (findGroupKey(draggingId) !== findGroupKey(id)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  }
  function onDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    if (findGroupKey(draggingId) !== findGroupKey(targetId)) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    // Compose new full order: take current sortedChars order, move draggingId before/after targetId
    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = e.clientY - targetRect.top < targetRect.height / 2;
    const ids = sortedChars.map((c) => c.id).filter((id) => id !== draggingId);
    const insertAt = before
      ? ids.indexOf(targetId)
      : ids.indexOf(targetId) + 1;
    ids.splice(insertAt, 0, draggingId);
    setCharacterOrder(ids);
    setDraggingId(null);
    setDragOverId(null);
  }

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-extrabold">📊 대시보드</h1>
          <Button asChild variant="ghost" size="sm">
            <Link href="/simple"><Zap className="h-4 w-4" /> 심플</Link>
          </Button>
        </div>
        <KinaCard page="dash" />
      </div>
      <p className="text-xs text-muted-foreground -mt-2">{formatToday()}</p>

      <AccountTabs />

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" variant="ghost" onClick={() => { setEditCharId(null); setCharDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> 캐릭터
        </Button>
        <Button size="sm" variant="ghost" onClick={() => { setEditAccId(null); setAccDialogOpen(true); }}>
          <UserPlus className="h-4 w-4" /> 계정
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button size="sm" variant="ghost" onClick={handleDailyReset} className="text-amber-400">
          <Sun className="h-4 w-4" /> 일일 초기화
        </Button>
        <Button size="sm" variant="ghost" onClick={handleWeeklyReset} className="text-amber-400">
          <RotateCcw className="h-4 w-4" /> 주간 초기화
        </Button>
        <div className="w-px h-5 bg-border mx-1" />
        <Button size="sm" variant="ghost" onClick={exportBarrackTxt}>
          <Download className="h-4 w-4" /> 배럭 저장
        </Button>
        <Button size="sm" variant="ghost" onClick={importBarrackTxt}>
          <Upload className="h-4 w-4" /> 배럭 불러오기
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setBulkCorridorOpen(true)}>
          <Building2 className="h-4 w-4" /> 회랑 결과 입력
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setRefreshCpOpen(true)}>
          <RefreshCw className="h-4 w-4" /> 전투력·아이템레벨 업데이트
        </Button>
        <Button size="sm" variant="ghost" onClick={() => setArtisanOpen(true)} title="aion2tool.com 서버 비교 — 나니아 카드 정보">
          <Hammer className="h-4 w-4" /> 아티쟁 결과
        </Button>
        <div className="ml-auto">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setShowHidden(!showHidden)}
          >
            {showHidden ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            숨김 캐릭터 {hiddenChars.length > 0 && `(${hiddenChars.length})`}
          </Button>
        </div>
      </div>

      <ChargePanel page="dash" />

      {accounts.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground rounded-lg border bg-card">
          <Users className="h-10 w-10 opacity-40" />
          <div className="text-sm">계정이 없습니다.</div>
          <Button size="sm" onClick={() => { setEditAccId(null); setAccDialogOpen(true); }}>
            <UserPlus className="h-4 w-4" /> 계정 추가
          </Button>
        </div>
      ) : (
        <div className="space-y-5">
          {targetAccounts.map((acc) => {
            const accVisible = visibleChars.filter((c) => c.accountId === acc.id);
            const accHidden = hiddenChars.filter((c) => c.accountId === acc.id);
            const groups = groupByServer(accVisible);

            // 계정 순서 이동 — 전체뷰에서만, 계정 첫 서버바에 ▲▼ 노출
            const accIndex = accounts.findIndex((a) => a.id === acc.id);
            const canReorder = selectedAccId === "" && accounts.length > 1;
            const moveUp = canReorder && accIndex > 0 ? () => moveAccount(acc.id, -1) : undefined;
            const moveDown = canReorder && accIndex < accounts.length - 1 ? () => moveAccount(acc.id, +1) : undefined;

            return (
              <div key={acc.id} className="space-y-3">
                {groups.length === 0 ? (
                  <AccountServerBar acc={acc} server="" chars={[]}
                    onEditAcc={(id) => { setEditAccId(id); setAccDialogOpen(true); }}
                    onMoveUp={moveUp} onMoveDown={moveDown} />
                ) : groups.map(({ server, chars }, gi) => (
                  <div key={server} className="space-y-2">
                    <AccountServerBar acc={acc} server={server} chars={chars}
                      onEditAcc={(id) => { setEditAccId(id); setAccDialogOpen(true); }}
                      onMoveUp={gi === 0 ? moveUp : undefined} onMoveDown={gi === 0 ? moveDown : undefined} />
                    <div className="space-y-1.5">
                      {chars.map((c) => (
                        <CharacterCard
                          key={c.id}
                          char={c}
                          onEdit={(id) => { setEditCharId(id); setCharDialogOpen(true); }}
                          onCorridor={(id) => { setCorridorId(id); setCorridorOpen(true); }}
                          onOdEdit={(id) => { setOdId(id); setOdOpen(true); }}
                          onEquip={(id) => { setEquipId(id); setEquipOpen(true); }}
                          draggable
                          onDragStart={onDragStart}
                          onDragOver={onDragOver}
                          onDrop={onDrop}
                          isDragging={draggingId === c.id}
                          isDragOver={dragOverId === c.id}
                        />
                      ))}
                    </div>
                  </div>
                ))}

                {/* 숨김 캐릭터 컴팩트 행 */}
                {accHidden.length > 0 && showHidden && (
                  <div className="space-y-1 pt-2 border-t border-dashed">
                    <div className="text-[10px] font-bold text-muted-foreground tracking-wider px-1">
                      🙈 숨긴 캐릭터 ({accHidden.length})
                    </div>
                    {accHidden.map((c) => (
                      <HiddenCharRow
                        key={c.id}
                        char={c}
                        onEdit={(id) => { setEditCharId(id); setCharDialogOpen(true); }}
                      />
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <CharacterDialog open={charDialogOpen} charId={editCharId} onClose={() => setCharDialogOpen(false)} />
      <AccountDialog open={accDialogOpen} accId={editAccId} onClose={() => setAccDialogOpen(false)} />
      <CorridorDialog open={corridorOpen} charId={corridorId} onClose={() => setCorridorOpen(false)} />
      <OdEditDialog open={odOpen} charId={odId} onClose={() => setOdOpen(false)} />
      <CorridorBulkDialog open={bulkCorridorOpen} onClose={() => setBulkCorridorOpen(false)} />
      <EquipDialog open={equipOpen} charId={equipId} onClose={() => setEquipOpen(false)} />
      <RefreshCpDialog open={refreshCpOpen} onClose={() => setRefreshCpOpen(false)} />
      <ArtisanDialog open={artisanOpen} targetName="나니아" onClose={() => setArtisanOpen(false)} />
    </div>
  );
}
