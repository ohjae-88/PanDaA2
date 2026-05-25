"use client";

import { useEffect, useMemo, useState } from "react";
import { Bell, Users } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useNotifierStore } from "@/lib/notifier/store";
import { toast } from "@/lib/util/toast";
import type { NotifierGroup } from "@/lib/notifier/types";
import { cn } from "@/lib/utils";

type Props = { open: boolean; groupId: string | null; onClose: () => void };

const TYPE_ORDER = ["이벤트", "어비스", "천족", "마족"];

function newGroupId(): string {
  return `g_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function GroupEditDialog({ open, groupId, onClose }: Props) {
  const items = useNotifierStore((s) => s.items);
  const groupDefs = useNotifierStore((s) => s.groupDefs ?? []);
  const upsertGroup = useNotifierStore((s) => s.upsertGroup);
  const setItemGroups = useNotifierStore((s) => s.setItemGroups);

  const editing = groupId ? groupDefs.find((g) => g.id === groupId) : null;
  const [name, setName] = useState("");
  const [enabled, setEnabled] = useState(true);
  const [beforeMin, setBeforeMin] = useState(5);
  /** 항목 id → 소속 여부 */
  const [memberMap, setMemberMap] = useState<Record<string, boolean>>({});
  /** 항목 id → 개별 알림 ON/OFF (그룹 내) */
  const [perItem, setPerItem] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setEnabled(editing.enabled);
      setBeforeMin(editing.beforeMin);
      const members: Record<string, boolean> = {};
      items.forEach((it) => {
        if (it.groups?.includes(editing.id)) members[it.id] = true;
      });
      setMemberMap(members);
      setPerItem(editing.perItemEnabled ?? {});
    } else {
      setName("");
      setEnabled(true);
      setBeforeMin(5);
      setMemberMap({});
      setPerItem({});
    }
  }, [open, editing, items]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = {};
    items.forEach((it) => (g[it.type || "기타"] ??= []).push(it));
    const order = [...TYPE_ORDER.filter((k) => g[k]), ...Object.keys(g).filter((k) => !TYPE_ORDER.includes(k))];
    return order.map((type) => ({ type, items: g[type].slice().sort((a, b) => (a.tier || 9) - (b.tier || 9)) }));
  }, [items]);

  function toggleMember(id: string, v: boolean) {
    setMemberMap((m) => {
      const next = { ...m };
      if (v) next[id] = true;
      else delete next[id];
      return next;
    });
  }
  function togglePerItem(id: string) {
    setPerItem((p) => ({ ...p, [id]: !(p[id] ?? true) }));
  }
  function setTypeMembers(type: string, v: boolean) {
    const ids = (grouped.find((g) => g.type === type)?.items ?? []).map((it) => it.id);
    setMemberMap((m) => {
      const next = { ...m };
      ids.forEach((id) => {
        if (v) next[id] = true;
        else delete next[id];
      });
      return next;
    });
  }

  function handleSave() {
    if (!name.trim()) {
      toast.error("그룹명을 입력하세요.");
      return;
    }
    const memberIds = Object.keys(memberMap).filter((id) => memberMap[id]);
    const gid = editing?.id ?? newGroupId();
    const group: NotifierGroup = {
      id: gid,
      name: name.trim(),
      enabled,
      beforeMin: Math.max(0, beforeMin | 0),
      perItemEnabled: perItem,
    };
    upsertGroup(group);

    // 항목 ↔ 그룹 양방향 동기화
    items.forEach((it) => {
      const inGroup = memberMap[it.id];
      const cur = it.groups ?? [];
      const has = cur.includes(gid);
      if (inGroup && !has) setItemGroups(it.id, [...cur, gid]);
      else if (!inGroup && has) setItemGroups(it.id, cur.filter((g) => g !== gid));
    });
    onClose();
  }

  const memberCount = Object.keys(memberMap).filter((id) => memberMap[id]).length;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> {editing ? "그룹 편집" : "새 그룹 추가"}
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">그룹명</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="예: 천족 상위 보스, 일일 사냥터" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">소속 항목 수</Label>
            <div className="h-9 px-3 rounded-md border bg-muted/30 flex items-center font-bold tabular-nums">
              {memberCount}개
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2 border-t">
          <Switch checked={enabled} onCheckedChange={setEnabled} />
          <span className="font-semibold text-sm">그룹 알림 사용 (합산 알림)</span>
        </div>

        <div className={cn("flex items-center gap-3", !enabled && "opacity-50")}>
          <Label className="text-xs text-muted-foreground w-24">알림 시점</Label>
          <Input
            type="number"
            min={0}
            className="w-24"
            value={beforeMin}
            onChange={(e) => setBeforeMin(Math.max(0, Number(e.target.value) || 0))}
            disabled={!enabled}
          />
          <span className="text-xs text-muted-foreground">분 전 (그룹 내 첫 항목 기준)</span>
        </div>

        <div className="text-xs font-bold border-t pt-3">
          그룹 항목 선택 · 개별 알림 ON/OFF
        </div>
        <p className="text-[11px] text-muted-foreground -mt-2">
          ✓ 체크 = 그룹 소속 / 🔔 토글 = 그룹 내 개별 알림 사용 여부 (꺼지면 합산 알림만 받음)
        </p>

        <div className="max-h-[50vh] overflow-auto space-y-3">
          {grouped.map(({ type, items: tItems }) => {
            const all = tItems.every((it) => memberMap[it.id]);
            const some = tItems.some((it) => memberMap[it.id]);
            return (
              <div key={type} className="rounded border p-2.5 bg-card/40">
                <div className="flex items-center justify-between mb-2">
                  <div className="font-extrabold text-sm">{type} <span className="text-muted-foreground font-normal text-xs">({tItems.length})</span></div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="xs" onClick={() => setTypeMembers(type, !all)}>
                      {all ? "전체 해제" : some ? "전체 선택" : "전체 선택"}
                    </Button>
                  </div>
                </div>
                <div className="space-y-1">
                  {tItems.map((it) => {
                    const inGroup = !!memberMap[it.id];
                    const indivOn = perItem[it.id] ?? true;
                    return (
                      <div key={it.id} className="flex items-center gap-2 text-xs py-0.5">
                        <Checkbox
                          checked={inGroup}
                          onCheckedChange={(v) => toggleMember(it.id, !!v)}
                        />
                        <span className="font-semibold flex-1 min-w-0 truncate">
                          {it.tier ? <span className="text-[10px] text-muted-foreground mr-1">T{it.tier}</span> : null}
                          {it.name}
                        </span>
                        <span className="text-[10px] text-muted-foreground truncate max-w-[120px]">{it.area}</span>
                        <button
                          type="button"
                          onClick={() => togglePerItem(it.id)}
                          disabled={!inGroup}
                          className={cn(
                            "inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold transition-colors disabled:opacity-40",
                            inGroup && indivOn ? "bg-gold/15 border-gold/50 text-gold-light" : "bg-card border-border text-muted-foreground"
                          )}
                          title={
                            !inGroup ? "그룹 소속 항목만 설정 가능" :
                            indivOn ? "개별 알림 ON — 기존 N분 전 알림 발송 + 그룹 알림" : "개별 알림 OFF — 그룹 합산 알림만 받음"
                          }
                        >
                          <Bell className="h-2.5 w-2.5" /> {indivOn ? "개별 ON" : "개별 OFF"}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSave}>{editing ? "저장" : "그룹 추가"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
