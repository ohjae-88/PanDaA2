"use client";

import { useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { Bell, BellOff, GripVertical, Settings } from "lucide-react";
import {
  useNotifierStore,
  sortGroupItems,
  distributeToColumns,
} from "@/lib/notifier/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

import { NotifierCard } from "@/components/notifier/notifier-card";
import { NotifierGroupBundle } from "@/components/notifier/notifier-group-bundle";
import { nextSpawnMs } from "@/lib/notifier/time";
import type { NotifierGroup, NotifierItem } from "@/lib/notifier/types";
import { NotifierEditDialog } from "@/components/notifier/edit-dialog";
import { NotifierTimeInputDialog } from "@/components/notifier/time-input-dialog";
import { NotifierBulkAlertDialog } from "@/components/notifier/bulk-alert-dialog";
import { NotifierAlertModal } from "@/components/notifier/alert-modal";
import { CombinedAlertModal } from "@/components/notifier/combined-alert-modal";
import { ServerClockBadge } from "@/components/notifier/server-clock-badge";
import { useNotifierTick } from "@/components/notifier/use-notifier-tick";

const GROUP_ORDER = ["이벤트", "어비스", "천족", "마족"];

export default function NotifierPage() {
  useNotifierTick();

  const items = useNotifierStore((s) => s.items);
  const settings = useNotifierStore((s) => s.settings);
  const itemOrder = useNotifierStore((s) => s.itemOrder);
  const groupOrder = useNotifierStore((s) => s.groupOrder);
  const setItemOrder = useNotifierStore((s) => s.setItemOrder);
  const setGroupOrder = useNotifierStore((s) => s.setGroupOrder);
  const updateSettings = useNotifierStore((s) => s.updateSettings);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [timeOpen, setTimeOpen] = useState(false);
  const [timeId, setTimeId] = useState<string | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);

  // Hydration guard — Zustand persist hydrates client-side only
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const mode = settings.viewMode ?? "group";
  const displayFilter = settings.displayFilter ?? "all";
  const groupDefs = useNotifierStore((s) => s.groupDefs ?? []);

  // 표시 항목 필터링
  // - all   : DB의 모든 항목
  // - alarm : 알림(개별 OR 그룹)이 켜진 항목
  // - custom: displayHidden=false 인 항목 (사용자설정)
  const onItems = useMemo(() => {
    if (displayFilter === "alarm") {
      return items.filter((it) => {
        if (it.notifyEnabled) return true;
        const memberOf = it.groups ?? [];
        return memberOf.some((gid) => groupDefs.find((g) => g.id === gid)?.enabled);
      });
    }
    if (displayFilter === "custom") {
      return items.filter((it) => !it.displayHidden);
    }
    return items;
  }, [items, displayFilter, groupDefs]);

  // 그룹된 항목은 묶음(bundle)으로, 나머지는 단독 아이템으로 변환
  type Renderable =
    | { kind: "item"; item: NotifierItem; anchorTime: number; type: string; id: string }
    | { kind: "group"; group: NotifierGroup; members: NotifierItem[]; anchorTime: number; type: string; id: string };

  const renderables = useMemo<Renderable[]>(() => {
    const inSomeGroup = new Set<string>();
    const groupRends: Renderable[] = [];
    for (const g of groupDefs) {
      const memberPool = onItems.filter((it) => it.groups?.includes(g.id));
      if (!memberPool.length) continue;
      const sorted = memberPool.slice().sort((a, b) => {
        const ta = nextSpawnMs(a) ?? Infinity;
        const tb = nextSpawnMs(b) ?? Infinity;
        return ta - tb;
      });
      const anchor = sorted[0];
      const anchorTime = nextSpawnMs(anchor) ?? Infinity;
      sorted.forEach((it) => inSomeGroup.add(it.id));
      groupRends.push({
        kind: "group",
        group: g,
        members: sorted,
        anchorTime,
        type: anchor.type || "기타",
        id: `g:${g.id}`,
      });
    }
    const standalones: Renderable[] = onItems
      .filter((it) => !inSomeGroup.has(it.id))
      .map((it) => ({
        kind: "item",
        item: it,
        anchorTime: nextSpawnMs(it) ?? Infinity,
        type: it.type || "기타",
        id: it.id,
      }));
    return [...groupRends, ...standalones].sort((a, b) => a.anchorTime - b.anchorTime);
  }, [onItems, groupDefs]);

  // 카테고리 컬럼 — 각 type 별로 renderables 모음
  const groups = useMemo(() => {
    const g: Record<string, Renderable[]> = {};
    renderables.forEach((r) => (g[r.type] ??= []).push(r));
    const persisted = (groupOrder || []).filter((k) => g[k]);
    const remaining = Object.keys(g).filter((k) => !persisted.includes(k));
    const fallback = [
      ...GROUP_ORDER.filter((k) => remaining.includes(k)),
      ...remaining.filter((k) => !GROUP_ORDER.includes(k)),
    ];
    return [...persisted, ...fallback].map((k) => ({ type: k, items: g[k] }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renderables, groupOrder]);

  // 3분할 — renderables 균등 분배
  const columns = useMemo(() => {
    const cols: Renderable[][] = [[], [], []];
    const perCol = Math.ceil(renderables.length / 3) || 1;
    renderables.forEach((r, i) => {
      const idx = Math.min(2, Math.floor(i / perCol));
      cols[idx].push(r);
    });
    return cols;
  }, [renderables]);

  // 단독 아이템 정렬 — 카드 드래그용
  // (drag&drop은 그룹 외 단독 아이템에서만 의미 있음)
  void sortGroupItems; void distributeToColumns; void itemOrder;

  // 카드 드래그 (그룹 내)
  const [draggingId, setDraggingId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function onCardDragStart(e: React.DragEvent<HTMLDivElement>, id: string) {
    setDraggingId(id);
    e.dataTransfer.effectAllowed = "move";
    try {
      e.dataTransfer.setData("text/plain", id);
    } catch {}
  }
  function onCardDragOver(e: React.DragEvent<HTMLDivElement>, id: string) {
    if (!draggingId || draggingId === id) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverId(id);
  }
  function onCardDrop(e: React.DragEvent<HTMLDivElement>, targetId: string) {
    e.preventDefault();
    if (!draggingId || draggingId === targetId) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    // 같은 그룹인지 확인
    const findGroup = (id: string) => groups.find((g) => g.items.some((x) => x.id === id))?.type;
    if (findGroup(draggingId) !== findGroup(targetId)) {
      setDraggingId(null);
      setDragOverId(null);
      return;
    }
    // 모든 카드 ID를 화면 순서대로 수집 + 재배치
    const allIds: string[] = [];
    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = e.clientY - targetRect.top < targetRect.height / 2;
    groups.forEach((g) => {
      g.items.forEach((it) => {
        if (it.id === draggingId) return; // 일단 제외
        if (it.id === targetId) {
          if (before) allIds.push(draggingId);
          allIds.push(it.id);
          if (!before) allIds.push(draggingId);
        } else {
          allIds.push(it.id);
        }
      });
    });
    setItemOrder(allIds);
    setDraggingId(null);
    setDragOverId(null);
  }

  // 그룹 드래그
  const [groupDragId, setGroupDragId] = useState<string | null>(null);
  const [groupDragOverId, setGroupDragOverId] = useState<string | null>(null);

  function onGroupDragStart(e: React.DragEvent<HTMLDivElement>, type: string) {
    if ((e.target as HTMLElement).closest('[data-id]')) return; // 카드 위에서는 무시
    setGroupDragId(type);
    e.dataTransfer.effectAllowed = "move";
  }
  function onGroupDragOver(e: React.DragEvent<HTMLDivElement>, type: string) {
    if (!groupDragId || groupDragId === type) return;
    e.preventDefault();
    setGroupDragOverId(type);
  }
  function onGroupDrop(e: React.DragEvent<HTMLDivElement>, targetType: string) {
    if (!groupDragId || groupDragId === targetType) {
      setGroupDragId(null);
      setGroupDragOverId(null);
      return;
    }
    e.preventDefault();
    const all = groups.map((g) => g.type);
    const fromIdx = all.indexOf(groupDragId);
    const toIdx = all.indexOf(targetType);
    if (fromIdx < 0 || toIdx < 0) return;
    const targetRect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const before = e.clientX - targetRect.left < targetRect.width / 2;
    const reordered = all.filter((x) => x !== groupDragId);
    const insertAt = before ? reordered.indexOf(targetType) : reordered.indexOf(targetType) + 1;
    reordered.splice(insertAt, 0, groupDragId);
    setGroupOrder(reordered);
    setGroupDragId(null);
    setGroupDragOverId(null);
  }

  function openEdit(id: string) {
    setEditId(id);
    setEditOpen(true);
  }
  function openTime(id: string) {
    setTimeId(id);
    setTimeOpen(true);
  }

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <span>⏰</span> 알리미
        </h1>
        <div className="flex-1 flex justify-center">
          <ServerClockBadge />
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 레이아웃 토글 — 전체(3분할) / 구분(카테고리별) */}
          <div className="inline-flex rounded-md border overflow-hidden bg-card">
            <button
              onClick={() => updateSettings({ viewMode: "all" })}
              className={cn(
                "px-4 py-1.5 text-xs font-bold transition-colors",
                mode === "all" ? "bg-gold/15 text-gold-light" : "text-muted-foreground hover:text-foreground"
              )}
            >전체</button>
            <button
              onClick={() => updateSettings({ viewMode: "group" })}
              className={cn(
                "px-4 py-1.5 text-xs font-bold border-l transition-colors",
                mode === "group" ? "bg-gold/15 text-gold-light" : "text-muted-foreground hover:text-foreground"
              )}
            >구분</button>
          </div>
          {/* 표시 항목 필터 — 전체 / 알람 / 사용자설정 */}
          <div className="inline-flex rounded-md border overflow-hidden bg-card">
            {(["all", "alarm", "custom"] as const).map((f, i) => (
              <button
                key={f}
                onClick={() => updateSettings({ displayFilter: f })}
                className={cn(
                  "px-3 py-1.5 text-xs font-bold transition-colors",
                  i > 0 && "border-l",
                  displayFilter === f
                    ? "bg-cat-notifier/15 text-cat-notifier"
                    : "text-muted-foreground hover:text-foreground"
                )}
                title={
                  f === "all" ? "알리미DB의 모든 항목 표시" :
                  f === "alarm" ? "알람(개별 또는 그룹)이 켜진 항목만 표시" :
                  "알리미DB의 보이기 설정이 켜진 항목만 표시"
                }
              >
                {f === "all" ? "전체" : f === "alarm" ? "알람" : "사용자설정"}
              </button>
            ))}
          </div>
          <Button size="sm" onClick={() => setBulkOpen(true)}>
            <Bell className="h-4 w-4" /> 알림 편집
          </Button>
          <Link href="/notifier/settings" className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-bold rounded-md border hover:bg-accent/10">
            <Settings className="h-3 w-3" /> 설정
          </Link>
        </div>
      </div>

      {onItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-muted-foreground">
          <BellOff className="h-10 w-10 opacity-50" />
          <div className="text-sm">
            {displayFilter === "alarm" && "알람이 켜진 항목이 없습니다."}
            {displayFilter === "custom" && "표시 설정된 항목이 없습니다. 알리미DB에서 보이기를 켜주세요."}
            {displayFilter === "all" && "알리미DB에 항목이 없습니다."}
          </div>
          {displayFilter === "alarm" && (
            <Button size="sm" onClick={() => setBulkOpen(true)}>🔔 알림 편집 열기</Button>
          )}
        </div>
      ) : mode === "all" ? (
        <div className="rounded-lg border bg-card p-4">
          <div className="grid grid-cols-3 gap-3">
            {columns.map((col, ci) => (
              <div key={ci} className="flex flex-col gap-3 min-w-0">
                {col.map((r) =>
                  r.kind === "group" ? (
                    <NotifierGroupBundle
                      key={r.id}
                      group={r.group}
                      members={r.members}
                      onEdit={openEdit}
                      onTimeInput={openTime}
                      fixedHeight
                    />
                  ) : (
                    <NotifierCard
                      key={r.id}
                      item={r.item}
                      onEdit={openEdit}
                      onTimeInput={openTime}
                      fixedHeight
                    />
                  )
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex gap-4 overflow-x-auto items-start">
          {groups.map(({ type, items: gItems }) => (
            <div
              key={type}
              draggable
              onDragStart={(e) => onGroupDragStart(e, type)}
              onDragOver={(e) => onGroupDragOver(e, type)}
              onDrop={(e) => onGroupDrop(e, type)}
              className={cn(
                "flex-1 min-w-[340px] rounded-lg border bg-card p-3 flex flex-col",
                groupDragId === type && "opacity-50",
                groupDragOverId === type && "outline-2 outline-dashed outline-accent -outline-offset-2"
              )}
            >
              <div className="flex items-center gap-2 mb-2 cursor-grab">
                <GripVertical className="h-4 w-4 text-muted-foreground" />
                <span className="font-extrabold">{type}</span>
                <span className="text-xs text-muted-foreground rounded-full border px-2 py-0.5">
                  {gItems.length}
                </span>
              </div>
              <div className="flex flex-col gap-2.5">
                {gItems.map((r) =>
                  r.kind === "group" ? (
                    <NotifierGroupBundle
                      key={r.id}
                      group={r.group}
                      members={r.members}
                      onEdit={openEdit}
                      onTimeInput={openTime}
                    />
                  ) : (
                    <NotifierCard
                      key={r.id}
                      item={r.item}
                      onEdit={openEdit}
                      onTimeInput={openTime}
                      draggable
                      onDragStart={onCardDragStart}
                      onDragOver={onCardDragOver}
                      onDrop={onCardDrop}
                      isDragging={draggingId === r.item.id}
                      isDragOver={dragOverId === r.item.id}
                    />
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <NotifierEditDialog open={editOpen} itemId={editId} onClose={() => setEditOpen(false)} />
      <NotifierTimeInputDialog open={timeOpen} itemId={timeId} onClose={() => setTimeOpen(false)} />
      <NotifierBulkAlertDialog open={bulkOpen} onClose={() => setBulkOpen(false)} />
      <NotifierAlertModal />
      <CombinedAlertModal />
    </div>
  );
}
