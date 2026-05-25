"use client";

import { useEffect, useState } from "react";
import { ArcanaDbEditor } from "@/components/arcana/arcana-db-editor";
import { SetEditor } from "@/components/arcana/set-editor";
import { cn } from "@/lib/utils";

type Tab = "card" | "set";

export default function ArcanaDbCardPage() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  const [tab, setTab] = useState<Tab>("card");

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">🗂 아르카나 DB</h1>
        <p className="text-xs text-muted-foreground mt-1">
          아르카나 카드 마스터 — 7세트 × 6슬롯 = 42장 / 세트 효과 tier 2·4 편집
        </p>
      </div>

      {/* 탭 */}
      <div className="flex items-center gap-1 border-b">
        {([
          { id: "card", label: "🃏 카드 마스터" },
          { id: "set", label: "📜 세트 효과" },
        ] as const).map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              "px-3 py-1.5 text-sm font-bold border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-cat-arcana text-cat-arcana"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!hydrated ? (
        <div className="text-muted-foreground">로딩 중…</div>
      ) : tab === "card" ? (
        <ArcanaDbEditor />
      ) : (
        <SetEditor />
      )}
    </div>
  );
}
