"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { useBarrackStore } from "@/lib/barrack/store";
import { cn } from "@/lib/utils";

type Props = { open: boolean; charId: string | null; onClose: () => void };

export function CorridorDialog({ open, charId, onClose }: Props) {
  const char = useBarrackStore((s) => (charId ? s.characters.find((c) => c.id === charId) : null));
  const patch = useBarrackStore((s) => s.patchCharacter);

  const [lower, setLower] = useState(0);
  const [lowerMax, setLowerMax] = useState(3);
  const [middle, setMiddle] = useState(0);
  const [middleMax, setMiddleMax] = useState(3);

  useEffect(() => {
    if (!open || !char) return;
    setLower(char.corridor?.lower ?? 0);
    setLowerMax(char.corridor?.lowerMax ?? 3);
    setMiddle(char.corridor?.middle ?? 0);
    setMiddleMax(char.corridor?.middleMax ?? 3);
  }, [open, char]);

  if (!char) return null;

  function handleSave() {
    if (!char) return;
    patch(char.id, { corridor: { lower, lowerMax, middle, middleMax } });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>🏛 회랑 결과 입력 — {char.name}</DialogTitle>
        </DialogHeader>

        <CorridorRow
          title="하층 (Lower)"
          done={lower}
          max={lowerMax}
          onDone={setLower}
          onMax={setLowerMax}
        />
        <CorridorRow
          title="중층 (Middle)"
          done={middle}
          max={middleMax}
          onDone={setMiddle}
          onMax={setMiddleMax}
        />

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSave}>저장</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CorridorRow({
  title, done, max, onDone, onMax,
}: { title: string; done: number; max: number; onDone: (n: number) => void; onMax: (n: number) => void }) {
  return (
    <div className="rounded-lg border p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-sm">{title}</span>
        <Label className="text-xs text-muted-foreground">
          최대
          <select
            className="ml-2 bg-background border rounded px-2 py-0.5 text-xs"
            value={max}
            onChange={(e) => onMax(Number(e.target.value))}
          >
            {[1,2,3].map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </Label>
      </div>
      <div className="flex items-center gap-1.5">
        {Array.from({ length: max }, (_, i) => i + 1).map((stage) => (
          <button
            key={stage}
            onClick={() => onDone(stage === done ? stage - 1 : stage)}
            className={cn(
              "flex-1 py-2 rounded border text-xs font-bold transition-colors",
              stage <= done
                ? "bg-gold/20 border-gold/50 text-gold-light"
                : "bg-background border-border text-muted-foreground hover:bg-accent/10"
            )}
          >
            {stage}회
          </button>
        ))}
      </div>
      <div className="text-[11px] text-muted-foreground text-right">
        진행: <span className="font-bold text-gold-light">{done}/{max}</span>
      </div>
    </div>
  );
}
