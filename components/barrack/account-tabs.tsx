"use client";

import { useBarrackStore } from "@/lib/barrack/store";
import { cn } from "@/lib/utils";

export function AccountTabs() {
  const accounts = useBarrackStore((s) => s.accounts);
  const selected = useBarrackStore((s) => s.selectedAccId);
  const setSelected = useBarrackStore((s) => s.setSelectedAccId);

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => setSelected("")}
        className={cn(
          "px-3 py-1 text-xs font-semibold rounded-md border transition-colors",
          selected === ""
            ? "bg-cat-barrack/15 border-cat-barrack/50 text-cat-barrack"
            : "border-border text-muted-foreground hover:text-foreground"
        )}
      >
        전체
      </button>
      {accounts.map((a) => (
        <button
          key={a.id}
          onClick={() => setSelected(a.id)}
          className={cn(
            "px-3 py-1 text-xs font-semibold rounded-md border transition-colors",
            selected === a.id
              ? "bg-cat-barrack/15 border-cat-barrack/50 text-cat-barrack"
              : "border-border text-muted-foreground hover:text-foreground"
          )}
        >
          {a.name}
          {a.subscribed && <span className="ml-1 text-[9px] text-cat-arcana">구독</span>}
        </button>
      ))}
    </div>
  );
}
