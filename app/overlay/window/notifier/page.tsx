"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** 이전 경로 호환용 — 통합 오버레이로 리다이렉트 */
export default function NotifierOverlayWindowLegacy() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/overlay/window/");
  }, [router]);
  return (
    <div className="h-screen w-screen flex items-center justify-center text-xs text-muted-foreground">
      통합 오버레이로 이동 중…
    </div>
  );
}
