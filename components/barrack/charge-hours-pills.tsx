"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { toast } from "@/lib/util/toast";

type Props = {
  hours: number[];
  onChange: (hours: number[]) => void;
};

export function ChargeHoursPills({ hours, onChange }: Props) {
  const [input, setInput] = useState("");
  const sorted = [...new Set(hours.map(Number))].sort((a, b) => a - b);

  function add() {
    const h = parseInt(input, 10);
    if (!Number.isFinite(h) || h < 0 || h > 23) {
      toast.error("0~23 사이 시각을 입력하세요.");
      return;
    }
    if (sorted.includes(h)) {
      setInput("");
      return;
    }
    onChange([...sorted, h]);
    setInput("");
  }
  function remove(h: number) {
    onChange(sorted.filter((x) => x !== h));
  }

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap gap-1.5 min-h-[28px]">
        {sorted.map((h) => (
          <span
            key={h}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-bold rounded border bg-muted/40"
          >
            {String(h).padStart(2, "0")}시
            <button
              type="button"
              onClick={() => remove(h)}
              className="text-muted-foreground hover:text-rose-400"
              aria-label="삭제"
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        {sorted.length === 0 && (
          <span className="text-xs text-muted-foreground italic">시각 없음</span>
        )}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          max={23}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); add(); } }}
          placeholder="0~23"
          className="w-20 h-7 px-2 text-xs border rounded bg-background"
        />
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-1 px-2 h-7 text-xs font-bold rounded border bg-card hover:bg-accent/10"
        >
          <Plus className="h-3 w-3" /> 추가
        </button>
      </div>
    </div>
  );
}
