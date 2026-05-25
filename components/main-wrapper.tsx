"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** 메인 콘텐츠 래퍼 — 오버레이 윈도우 / 임베드 모드에서는 컨테이너 패딩/최대폭 제거.
 *  오버레이 윈도우 경로에서는 body bg도 투명화하여 둥근 모서리 + 잘림 방지. */
export function MainWrapper({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isOverlayWindow = pathname.startsWith("/overlay/window/");
  const isEquipWindow = pathname.startsWith("/overlay/equip");
  const isEmbedded = searchParams?.get("embedded") === "1";

  // body bg 동적 토글 — 오버레이 윈도우는 투명, 메인 앱은 solid
  useEffect(() => {
    if (typeof document === "undefined") return;
    const html = document.documentElement;
    const body = document.body;
    if (isOverlayWindow) {
      body.classList.add("bg-transparent");
      body.classList.remove("bg-background");
      html.classList.add("bg-transparent");
      // 둥근 모서리 보이도록 html/body도 잘림 방지
      body.style.overflow = "hidden";
      html.style.background = "transparent";
    } else {
      body.classList.add("bg-background");
      body.classList.remove("bg-transparent");
      html.classList.remove("bg-transparent");
      html.style.background = "";
    }
  }, [isOverlayWindow]);

  return (
    <main
      className={cn(
        isOverlayWindow
          ? "h-screen w-screen bg-transparent"
          : isEquipWindow
            ? "h-screen w-screen"
            : isEmbedded
              ? "h-screen w-screen bg-transparent p-2"
              : "container mx-auto px-4 py-6 max-w-[1600px]"
      )}
    >
      {children}
    </main>
  );
}
