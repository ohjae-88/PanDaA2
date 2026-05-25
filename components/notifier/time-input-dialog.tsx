"use client";

import { useEffect, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifierStore } from "@/lib/notifier/store";
import { serverNow } from "@/lib/notifier/time-sync";
import { toast } from "@/lib/util/toast";

type Props = { open: boolean; itemId: string | null; onClose: () => void };

function nowLocalInput(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function NotifierTimeInputDialog({ open, itemId, onClose }: Props) {
  const item = useNotifierStore((s) => (itemId ? s.items.find((x) => x.id === itemId) : null));
  const setLastSpawnTs = useNotifierStore((s) => s.setLastSpawnTs);

  const [mode, setMode] = useState<"spawn" | "remain">("remain");
  const [spawn, setSpawn] = useState(nowLocalInput());
  const [h, setH] = useState(0);
  const [m, setM] = useState(0);
  const [s, setS] = useState(0);

  useEffect(() => {
    if (!open || !item) return;
    setMode("remain");
    setSpawn(nowLocalInput());
    setH(Math.floor((item.cycleMinutes || 0) / 60));
    setM((item.cycleMinutes || 0) % 60);
    setS(0);
  }, [open, item]);

  if (!item) return null;

  function handleApply() {
    if (!item) return;
    if (mode === "spawn") {
      if (!spawn) { toast.error("잡은 일시를 입력하세요."); return; }
      const ts = new Date(spawn).getTime();
      if (Number.isNaN(ts)) { toast.error("일시 형식 오류"); return; }
      setLastSpawnTs(item.id, ts);
    } else {
      const remSec = h * 3600 + m * 60 + s;
      if (remSec < 0) { toast.error("남은 시간을 입력하세요."); return; }
      // 서버 시간(serverNow) 기준으로 계산해야 잔여 표시와 일치.
      // Date.now()를 쓰면 로컬 시계 오차만큼(예: 4~5초) 어긋남.
      const ts = serverNow() - Math.max(0, item.cycleMinutes * 60 - remSec) * 1000;
      setLastSpawnTs(item.id, ts);
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>⏱ 시간 입력 — {item.name}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground">쿨타임: {item.cycleMinutes}분</div>
        <div className="flex gap-2">
          <Button
            variant={mode === "spawn" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("spawn")}
          >잡은 시간 입력</Button>
          <Button
            variant={mode === "remain" ? "default" : "ghost"}
            size="sm"
            onClick={() => setMode("remain")}
          >남은 시간 입력</Button>
        </div>

        {mode === "spawn" ? (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">잡은 일시</Label>
            <Input type="datetime-local" value={spawn} onChange={(e) => setSpawn(e.target.value)} />
          </div>
        ) : (
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">남은 시간 (시 : 분 : 초)</Label>
            <div className="flex items-center gap-2">
              <Input type="number" min={0} className="w-[64px] text-center" value={h} onChange={(e) => setH(Number(e.target.value) || 0)} />
              <span className="text-lg font-bold">:</span>
              <Input type="number" min={0} max={59} className="w-[64px] text-center" value={m} onChange={(e) => setM(Number(e.target.value) || 0)} />
              <span className="text-lg font-bold">:</span>
              <Input type="number" min={0} max={59} className="w-[64px] text-center" value={s} onChange={(e) => setS(Number(e.target.value) || 0)} />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button onClick={handleApply}>적용</Button>
          <Button variant="ghost" onClick={onClose}>취소</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
