"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Users } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import { useOverlayStore } from "@/lib/overlay/store";
import { SetsBoard } from "@/components/party/sets-board";
import { cn } from "@/lib/utils";

/** 오버레이 축소 모드 — 파티 뷰
 *  - 상단: 그룹 선택 드롭다운 (배럭 패널 캐릭터 선택과 동일 스타일)
 *  - 다음 줄: 세트 선택 버튼 [1][2]...[N] (분할 카드형)
 *  - 본문: 선택된 세트 카드를 1열 수직 배치 (SetsBoard 재사용 + forceOneColumn)
 */
export function PartyOverlayPanel() {
  const groups = usePartyStore((s) => s.groups);
  const activeGroupId = usePartyStore((s) => s.activeGroupId);
  const partyOverlay = useOverlayStore((s) => s.partyOverlay);
  const patchPartyOverlay = useOverlayStore((s) => s.patchPartyOverlay);

  // 선택된 그룹 — partyOverlay 우선, 없으면 active group, 없으면 첫 번째
  const selectedGroup = useMemo(() => {
    const byOverlay = partyOverlay.selectedGroupId
      ? groups.find((g) => g.id === partyOverlay.selectedGroupId)
      : null;
    if (byOverlay) return byOverlay;
    const byActive = activeGroupId ? groups.find((g) => g.id === activeGroupId) : null;
    return byActive ?? groups[0] ?? null;
  }, [groups, activeGroupId, partyOverlay.selectedGroupId]);

  const [groupDropdownOpen, setGroupDropdownOpen] = useState(false);

  if (!groups.length) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic p-4 text-center">
        등록된 파티 그룹 없음 — 메인 프로그램의 파티편집에서 그룹을 생성하세요.
      </div>
    );
  }

  if (!selectedGroup) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic p-4 text-center">
        그룹을 선택하세요.
      </div>
    );
  }

  const totalSets = selectedGroup.generatedSets.length;
  const selected = partyOverlay.selectedSetIndices;
  // 비어있으면 전체 선택으로 표시 (사용자가 첫 진입 시 모든 세트 보임)
  const effectiveSelected = selected.length > 0
    ? selected
    : Array.from({ length: totalSets }, (_, i) => i);

  function toggleSetIdx(idx: number) {
    const cur = partyOverlay.selectedSetIndices;
    // 빈 배열 = "전체 표시". 첫 토글 시 전체 인덱스로 펼친 후 해당 idx 제거.
    const expanded = cur.length > 0 ? cur : Array.from({ length: totalSets }, (_, i) => i);
    let next: number[];
    if (expanded.includes(idx)) {
      next = expanded.filter((x) => x !== idx);
    } else {
      next = [...expanded, idx].sort((a, b) => a - b);
    }
    patchPartyOverlay({ selectedSetIndices: next });
  }

  function selectGroup(id: string) {
    patchPartyOverlay({ selectedGroupId: id, selectedSetIndices: [] });
    setGroupDropdownOpen(false);
  }

  return (
    <div className="flex flex-col h-full text-xs">
      {/* 상단 그룹 선택 헤더 — 클릭 시 드롭다운 (배럭 패널 스타일) */}
      <div className="relative border-b border-border/30 bg-cat-party/5 flex-shrink-0">
        <button
          onClick={() => setGroupDropdownOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-2 py-1.5 hover:bg-cat-party/10 transition-colors"
        >
          <Users className="h-3.5 w-3.5 text-cat-party flex-shrink-0" />
          <span className="font-extrabold truncate flex-1 text-left text-cat-party">
            {selectedGroup.name}
          </span>
          <span className="text-[10px] text-muted-foreground">
            세트 {totalSets}개
          </span>
          <ChevronDown className={cn("h-3 w-3 transition-transform", groupDropdownOpen && "rotate-180")} />
        </button>
        {groupDropdownOpen && (
          <div className="absolute left-0 right-0 top-full z-10 max-h-60 overflow-auto border border-border bg-background/95 backdrop-blur-sm shadow-lg">
            {groups.map((g) => {
              const active = g.id === selectedGroup.id;
              return (
                <button
                  key={g.id}
                  onClick={() => selectGroup(g.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-accent/20",
                    active && "bg-cat-party/20 font-bold"
                  )}
                >
                  <Users className="h-3 w-3 text-cat-party" />
                  <span className="truncate flex-1">{g.name}</span>
                  <span className="text-[9px] text-muted-foreground">
                    {g.generatedSets.length}세트
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* 세트 선택 버튼 행 — 하나의 카드를 N등분 [1][2]...[N] */}
      {totalSets > 0 && (
        <div className="px-1.5 py-1 border-b border-border/20 flex-shrink-0">
          <div
            className="grid border border-cat-party/40 rounded overflow-hidden"
            style={{ gridTemplateColumns: `repeat(${totalSets}, minmax(0, 1fr))` }}
            title="세트 표시 토글 — 클릭으로 ON/OFF"
          >
            {Array.from({ length: totalSets }, (_, i) => {
              const on = effectiveSelected.includes(i);
              return (
                <button
                  key={i}
                  onClick={() => toggleSetIdx(i)}
                  className={cn(
                    "py-0.5 text-[10px] font-extrabold tabular-nums border-r border-cat-party/30 last:border-r-0 transition-colors",
                    on
                      ? "bg-cat-party/25 text-cat-party hover:bg-cat-party/40"
                      : "bg-muted/30 text-muted-foreground hover:bg-cat-party/10"
                  )}
                >
                  {i + 1}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 본문 — SetsBoard 임베드 (1열 강제 + 인덱스 필터) */}
      <div className="flex-1 overflow-auto p-1.5">
        <SetsBoard
          group={selectedGroup}
          onOpenSlotPicker={() => { /* 슬롯 선택 다이얼로그는 메인 프로그램 사용 */ }}
          forceOneColumn
          visibleSetIndices={selected.length > 0 ? selected : undefined}
        />
      </div>
    </div>
  );
}
