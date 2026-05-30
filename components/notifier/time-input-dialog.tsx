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
  const [remainStr, setRemainStr] = useState("00:00:00");

  useEffect(() => {
    if (!open || !item) return;
    setMode("remain");
    setSpawn(nowLocalInput());
    setRemainStr("00:00:00");
  }, [open, item]);

  if (!item) return null;

  // 숫자만 추출 후 좌측부터 2자리씩 콜론 자동 삽입 ("010040" → "01:00:40")
  function formatDigits(raw: string): string {
    const d = raw.replace(/\D/g, "").slice(0, 6);
    const groups: string[] = [];
    for (let i = 0; i < d.length; i += 2) groups.push(d.slice(i, i + 2));
    return groups.join(":");
  }

  // "HH:MM:SS" / "MM:SS" / "SS" 모두 허용 → 초 단위. 잘못된 입력은 null.
  function parseHMS(str: string): number | null {
    const parts = str.split(":").map((p) => p.trim());
    if (parts.length > 3) return null;
    if (parts.some((p) => p === "" || !/^\d+$/.test(p))) return null;
    const nums = parts.map(Number);
    let h = 0, m = 0, s = 0;
    if (nums.length === 3) [h, m, s] = nums;
    else if (nums.length === 2) [m, s] = nums;
    else [s] = nums;
    return h * 3600 + m * 60 + s;
  }

  function handleApply() {
    if (!item) return;
    if (mode === "spawn") {
      if (!spawn) { toast.error("잡은 일시를 입력하세요."); return; }
      const ts = new Date(spawn).getTime();
      if (Number.isNaN(ts)) { toast.error("일시 형식 오류"); return; }
      setLastSpawnTs(item.id, ts);
    } else {
      const remSec = parseHMS(remainStr);
      if (remSec === null) { toast.error("남은 시간 형식 오류 (예: 01:30:00)"); return; }
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
            <Input
              type="text"
              inputMode="numeric"
              placeholder="00:00:00"
              className="text-center tabular-nums text-lg font-bold tracking-wider"
              value={remainStr}
              onChange={(e) => setRemainStr(formatDigits(e.target.value))}
              onKeyDown={(e) => { if (e.key === "Enter") handleApply(); }}
            />
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
