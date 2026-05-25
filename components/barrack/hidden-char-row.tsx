"use client";

import { Pencil, Eye } from "lucide-react";
import type { Character } from "@/lib/barrack/types";
import { useBarrackStore, weeklyScore } from "@/lib/barrack/store";
import { CLASSES } from "@/lib/barrack/constants";
import { fmtN } from "@/lib/barrack/time";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

type Props = { char: Character; onEdit: (id: string) => void };

export function HiddenCharRow({ char, onEdit }: Props) {
  const db = useBarrackStore((s) => s.dbSettings);
  const toggleHidden = useBarrackStore((s) => s.toggleCharHidden);
  const cls = CLASS_MAP[char.classId] || { icon: "❓", name: "?", color: "#666" };
  const sc = weeklyScore(char, db);

  return (
    <div
      className="flex items-center gap-3 px-3 py-1.5 border bg-card/40 rounded text-xs"
      style={{ borderLeftColor: cls.color, borderLeftWidth: 3 }}
    >
      <span className="text-lg flex-shrink-0">{cls.icon}</span>
      <button
        className="font-bold hover:underline truncate min-w-[100px]"
        onClick={() => onEdit(char.id)}
        style={{ color: cls.color }}
        title={char.name}
      >
        {char.name}
      </button>
      <span className="text-muted-foreground truncate flex-1 min-w-0">
        {cls.name} · Lv.{char.level} · {char.race}{char.server && ` · ${char.server}`}
      </span>
      <span className="text-muted-foreground tabular-nums">⚔ {fmtN(char.cp)}</span>
      <span
        className={cn("tabular-nums font-bold", sc.pct >= 100 ? "text-gold-light" : "text-muted-foreground")}
        title={`주간 진행 ${sc.done}/${sc.total}`}
      >
        주간 {sc.pct}%
      </span>
      <div className="flex gap-0.5 flex-shrink-0">
        <Button variant="ghost" size="xs" onClick={() => onEdit(char.id)} title="수정">
          <Pencil className="h-3 w-3" />
        </Button>
        <Button variant="ghost" size="xs" onClick={() => toggleHidden(char.id)} title="보이기">
          <Eye className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}
