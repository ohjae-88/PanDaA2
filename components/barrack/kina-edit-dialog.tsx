"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useBarrackStore } from "@/lib/barrack/store";
import { fmtN } from "@/lib/barrack/time";
import { Coins } from "lucide-react";
import { cn } from "@/lib/utils";

type Row = {
  accId: string;
  accName: string;
  server: string;
  kina: number;
  excluded: boolean;
};

export function KinaEditDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const accounts = useBarrackStore((s) => s.accounts);
  const characters = useBarrackStore((s) => s.characters);
  const patchServerData = useBarrackStore((s) => s.patchServerData);

  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    if (!open) return;
    const out: Row[] = [];
    for (const a of accounts) {
      const srvs = [...new Set(characters.filter((c) => c.accountId === a.id).map((c) => c.server || ""))];
      for (const s of srvs) {
        const sd = a.servers?.[s];
        out.push({ accId: a.id, accName: a.name, server: s, kina: sd?.kina ?? 0, excluded: !!sd?.kinaExcluded });
      }
    }
    setRows(out);
  }, [open, accounts, characters]);

  const byAcc = useMemo(() => {
    const g: Record<string, { accName: string; rows: Row[] }> = {};
    rows.forEach((r) => {
      g[r.accId] ??= { accName: r.accName, rows: [] };
      g[r.accId].rows.push(r);
    });
    return g;
  }, [rows]);

  const accSum = (rs: Row[]) => rs.reduce((s, r) => s + (r.excluded ? 0 : r.kina || 0), 0);
  const grandSum = rows.reduce((s, r) => s + (r.excluded ? 0 : r.kina || 0), 0);

  function setRow(idx: number, patch: Partial<Row>) {
    setRows((rs) => rs.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  function handleApply() {
    rows.forEach((r) => {
      patchServerData(r.accId, r.server, { kina: r.kina, kinaExcluded: r.excluded });
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Coins className="h-4 w-4 text-gold" /> 키나 수정
          </DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground border-b pb-2">
          전체 합계:{" "}
          <span className="font-extrabold text-gold-light tabular-nums">{fmtN(grandSum)}</span>
        </div>
        <div className="space-y-3 max-h-[60vh] overflow-auto">
          {Object.entries(byAcc).map(([accId, { accName, rows: gRows }]) => (
            <div key={accId} className="rounded-lg border p-3 bg-card">
              <div className="flex items-center justify-between mb-2">
                <span className="font-semibold text-sm">{accName}</span>
                <span className="text-xs text-muted-foreground">
                  합계 <span className="font-bold text-gold-light tabular-nums">{fmtN(accSum(gRows))}</span>
                </span>
              </div>
              <div className="space-y-1.5">
                {gRows.map((r) => {
                  const idx = rows.indexOf(r);
                  return (
                    <div key={r.server} className="flex items-center gap-2">
                      <Switch
                        checked={!r.excluded}
                        onCheckedChange={(v) => setRow(idx, { excluded: !v })}
                      />
                      <span className={cn("text-xs flex-1 min-w-0 truncate", r.excluded && "opacity-40")}>
                        {r.server || "서버 미지정"}
                      </span>
                      <Input
                        type="number"
                        className={cn("w-[120px] h-7 text-right text-xs tabular-nums", r.excluded && "opacity-40")}
                        value={r.kina}
                        onChange={(e) => setRow(idx, { kina: Number(e.target.value) || 0 })}
                      />
                      <span className={cn("text-xs text-gold", r.excluded && "opacity-40")}>K</span>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
        <DialogFooter>
          <Button onClick={handleApply}>적용</Button>
          <Button variant="ghost" onClick={onClose}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
