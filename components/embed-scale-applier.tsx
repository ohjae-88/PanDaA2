"use client";

import { useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useUiStore } from "@/lib/ui-store";

/**
 * 임베드 모드(?embedded=1)일 때 iframe 내부에 mountd되어 body에 zoom 적용.
 * 부수적으로 가로 스크롤바 강제 숨김.
 *
 * 메인 앱 컨텍스트(임베드 아님)에서는 no-op.
 */
export function EmbedScaleApplier() {
  const sp = useSearchParams();
  const isEmbedded = sp?.get("embedded") === "1";
  const embedScale = useUiStore((s) => s.embedScale);

  useEffect(() => {
    if (!isEmbedded) return;
    if (typeof document === "undefined") return;
    // 텍스트 배율로 변경 — root font-size만 조정. rem 기반 페이지(Tailwind text-xs, p-2 등) 비례 확대/축소.
    // CSS zoom 사용 안 함 → 컨텐츠 박스 크기가 부풀지 않음 → 100%+ 시 오버레이창 초과 문제 없음.
    const html = document.documentElement;
    const prevFs = html.style.fontSize;
    html.style.fontSize = `${16 * embedScale}px`;

    // 스크롤바는 시각적으로만 숨김 (스크롤 기능 유지)
    const style = document.createElement("style");
    style.setAttribute("data-embed-scrollbar-hide", "1");
    style.textContent = `
      *::-webkit-scrollbar { width: 0; height: 0; display: none; }
      * { scrollbar-width: none; -ms-overflow-style: none; }
    `;
    document.head.appendChild(style);

    return () => {
      html.style.fontSize = prevFs;
      style.remove();
    };
  }, [isEmbedded, embedScale]);

  return null;
}
