"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { useNotifierStore } from "@/lib/notifier/store";

type Props = { open: boolean; onClose: () => void };

const GROUP_ORDER = ["이벤트", "어비스", "천족", "마족"];

type RowState = { id: string; enabled: boolean; beforeMin: number };

export function NotifierBulkAlertDialog({ open, onClose }: Props) {
  const items = useNotifierStore((s) => s.items);
  const settings = useNotifierStore((s) => s.settings);
  const bulkUpdate = useNotifierStore((s) => s.bulkUpdateNotify);
  const updateSettings = useNotifierStore((s) => s.updateSettings);

  const [rows, setRows] = useState<Record<string, RowState>>({});
  const [zero, setZero] = useState(false);
  const [zeroSec, setZeroSec] = useState(0);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, RowState> = {};
    items.forEach((it) => {
      init[it.id] = { id: it.id, enabled: it.notifyEnabled, beforeMin: it.notifyBeforeMin };
    });
    setRows(init);
    setZero(settings.notifyAtZero);
    setZeroSec(settings.notifyAtZeroSec);
  }, [open, items, settings]);

  const grouped = useMemo(() => {
    const g: Record<string, typeof items> = {};
    items.forEach((it) => (g[it.type || "기타"] ??= []).push(it));
    const order = [
      ...GROUP_ORDER.filter((k) => g[k]),
      ...Object.keys(g).filter((k) => !GROUP_ORDER.includes(k)),
    ];
    return order.map((k) => ({ type: k, items: g[k].slice().sort((a, b) => (a.tier || 9) - (b.tier || 9)) }));
  }, [items]);

  function setRow(id: string, patch: Partial<RowState>) {
    setRows((r) => ({ ...r, [id]: { ...r[id], ...patch } }));
  }

  function setAll(enabled: boolean) {
    setRows((r) => {
      const out: Record<string, RowState> = {};
      Object.values(r).forEach((v) => (out[v.id] = { ...v, enabled }));
      return out;
    });
  }

  function setGroup(type: string, enabled: boolean) {
    setRows((r) => {
      const out = { ...r };
      items.filter((x) => (x.type || "기타") === type).forEach((x) => (out[x.id] = { ...out[x.id], enabled }));
      return out;
    });
  }

  function handleSave() {
    bulkUpdate(Object.values(rows));
    updateSettings({ notifyAtZero: zero, notifyAtZeroSec: Math.max(0, zeroSec) });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>🔔 알림 일괄 편집</DialogTitle>
        </DialogHeader>
        <div className="flex items-center gap-2 pb-2 border-b">
          <Button variant="ghost" size="sm" onClick={() => setAll(true)}>전체 켜기</Button>
          <Button variant="ghost" size="sm" onClick={() => setAll(false)}>전체 끄기</Button>
          <label className={`ml-auto inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold transition-colors ${zero ? "bg-cat-notifier/15 border-cat-notifier/45 text-cat-notifier" : "border-border text-muted-foreground"}`}>
            <Checkbox checked={zero} onCheckedChange={(v) => setZero(!!v)} />
            <span>⏰ 직전 알림</span>
            <Input type="number" min={0} className="w-[60px] h-7 text-center text-xs" value={zeroSec} onChange={(e) => setZeroSec(Number(e.target.value) || 0)} />
            <span>초 전</span>
          </label>
        </div>

        <div className="max-h-[60vh] overflow-auto flex flex-col gap-4">
          {grouped.map(({ type, items: gItems }) => (
            <div key={type} className="rounded-lg border bg-card p-3">
              <div className="flex items-center justify-between mb-2">
                <div className="font-extrabold">
                  {type} <span className="text-muted-foreground text-xs">({gItems.length})</span>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="xs" onClick={() => setGroup(type, true)}>모두 켜기</Button>
                  <Button variant="ghost" size="xs" onClick={() => setGroup(type, false)}>모두 끄기</Button>
                </div>
              </div>
              {gItems.map((it) => {
                const r = rows[it.id];
                if (!r) return null;
                return (
                  <div key={it.id} className="flex items-center gap-2 py-1 text-sm">
                    <label className="flex-1 flex items-center gap-2 cursor-pointer min-w-0">
                      <Checkbox checked={r.enabled} onCheckedChange={(v) => setRow(it.id, { enabled: !!v })} />
                      <span className="font-semibold">{it.name}</span>
                      <span className="text-xs text-muted-foreground truncate">
                        {it.tier ? `T${it.tier} · ` : ""}{it.area}
                      </span>
                    </label>
                    <Input type="number" min={0} className="w-[60px] h-7 text-center text-xs"
                      value={r.beforeMin}
                      onChange={(e) => setRow(it.id, { beforeMin: Number(e.target.value) || 0 })} />
                    <span className="text-xs text-muted-foreground">분 전</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>

        <DialogFooter>
          <Button onClick={handleSave}>저장</Button>
          <Button variant="ghost" onClick={onClose}>취소</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
