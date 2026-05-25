"use client";

import { useState } from "react";
import { Coins, Eye, EyeOff, Pencil } from "lucide-react";
import { useBarrackStore, getTotalKina } from "@/lib/barrack/store";
import { fmtN } from "@/lib/barrack/time";
import { Button } from "@/components/ui/button";
import { KinaEditDialog } from "./kina-edit-dialog";
import { cn } from "@/lib/utils";

export function KinaCard({ page = "dash" }: { page?: "dash" | "simple" }) {
  const accounts = useBarrackStore((s) => s.accounts);
  const characters = useBarrackStore((s) => s.characters);
  const hidden = useBarrackStore((s) => s.kinaHidden[page]);
  const setHidden = useBarrackStore((s) => s.setKinaHidden);
  const [editOpen, setEditOpen] = useState(false);

  const total = getTotalKina(accounts, characters);

  return (
    <>
      <div className="flex items-center gap-1.5">
        <button
          onClick={() => setEditOpen(true)}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border bg-card px-3 py-1.5 hover:bg-accent/10 transition-colors",
            hidden && "opacity-30"
          )}
          title="전체 키나 합계 (클릭하여 수정)"
        >
          <Coins className="h-4 w-4 text-gold" />
          <span className="text-xs text-muted-foreground">전체 키나</span>
          <span className="font-extrabold text-gold-light tabular-nums">
            {hidden ? "****" : fmtN(total)}
          </span>
          <Pencil className="h-3 w-3 text-muted-foreground" />
        </button>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setHidden(page, !hidden)}
          title={hidden ? "키나 표시" : "키나 숨기기"}
        >
          {hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
      </div>
      <KinaEditDialog open={editOpen} onClose={() => setEditOpen(false)} />
    </>
  );
}
