"use client";

import { ChevronDown } from "lucide-react";
import { useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: ReactNode;
  /** 우측 보조 텍스트 (예: 항목 개수) */
  meta?: ReactNode;
  /** 초기 펼침 상태 */
  defaultOpen?: boolean;
  /** 강조 색상 클래스 (Tailwind) — 좌측 4px 선 */
  accent?: string;
  children: ReactNode;
};

/** 접기/펼치기 카드 — 통합 설정 페이지 등에서 카테고리 분리용 */
export function CollapsibleSection({ title, meta, defaultOpen = false, accent, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={cn("rounded-lg border border-border/60 bg-card overflow-hidden", accent && "border-l-4")}
      style={accent ? { borderLeftColor: `var(--cat-${accent.replace("cat-", "")}-color, currentColor)` } : undefined}>
      <button
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/10 transition-colors",
          accent && accent
        )}
      >
        <ChevronDown
          className={cn("h-4 w-4 transition-transform flex-shrink-0", open ? "rotate-0" : "-rotate-90")}
        />
        <span className="font-extrabold text-sm flex-1">{title}</span>
        {meta && <span className="text-[11px] text-muted-foreground">{meta}</span>}
      </button>
      {open && <div className="px-4 py-3 border-t border-border/40 space-y-3">{children}</div>}
    </div>
  );
}
