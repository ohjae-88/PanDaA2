"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBarrackStore, computeOdMax } from "@/lib/barrack/store";

type Props = { open: boolean; charId: string | null; onClose: () => void };

export function OdEditDialog({ open, charId, onClose }: Props) {
  const char = useBarrackStore((s) => (charId ? s.characters.find((c) => c.id === charId) : null));
  const patch = useBarrackStore((s) => s.patchCharacter);
  const accounts = useBarrackStore((s) => s.accounts);
  const db = useBarrackStore((s) => s.dbSettings);

  const [base, setBase] = useState(0);
  const [extra, setExtra] = useState(0);

  useEffect(() => {
    if (!open || !char) return;
    setBase(char.od ?? 0);
    setExtra(char.odExtra ?? 0);
  }, [open, char]);

  if (!char) return null;

  const effOdMax = computeOdMax(char, accounts, db);

  function handleSave() {
    if (!char) return;
    patch(char.id, {
      od: Math.max(0, Math.min(base, effOdMax)),
      odExtra: Math.max(0, extra),
    });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[280px] p-3 gap-2">
        <DialogHeader>
          <DialogTitle className="text-sm">⚡ 오드 수정</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {/* 캐릭터명 카드 — Raid 수정창과 동일 디자인 */}
          <div className="rounded border bg-cat-barrack/10 border-cat-barrack/40 px-2 py-1">
            <div className="text-[9px] text-muted-foreground">캐릭터</div>
            <div className="font-extrabold text-sm text-cat-barrack truncate">{char.name}</div>
          </div>
          <div className="rounded border bg-card/40 p-2 space-y-1.5">
            <div className="text-[11px] font-extrabold text-muted-foreground flex items-center justify-between">
              <span>🔷 기본 오드</span>
              <span className="tabular-nums text-[10px] text-muted-foreground">한도 {effOdMax}</span>
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[11px] w-16 text-muted-foreground flex-shrink-0">기본</Label>
              <Input
                type="number"
                min={0}
                max={effOdMax}
                step={5}
                value={base}
                onChange={(e) => setBase(Number(e.target.value) || 0)}
                className="flex-1 h-8 text-right tabular-nums text-sm"
                autoFocus
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-[11px] w-16 text-muted-foreground flex-shrink-0">추가</Label>
              <Input
                type="number"
                min={0}
                step={5}
                value={extra}
                onChange={(e) => setExtra(Number(e.target.value) || 0)}
                className="flex-1 h-8 text-right tabular-nums text-sm"
              />
            </div>
          </div>
          <div className="rounded border bg-muted/30 px-2 py-1.5 flex items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground flex-shrink-0">⚡ 총</span>
            <span className="font-extrabold text-gold-light tabular-nums text-2xl leading-none">
              {base + extra}
              <span className="text-muted-foreground font-normal text-[10px] ml-1.5">({Math.floor((base + extra) / 80)}회)</span>
            </span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={handleSave} className="flex-[7] h-8">저장</Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="flex-[3] h-8 border">취소</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
