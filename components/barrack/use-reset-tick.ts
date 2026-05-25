"use client";

import { useEffect } from "react";
import { useBarrackStore } from "@/lib/barrack/store";

/**
 * 자동 충전·자동 리셋 — 마운트 시 1회 + 매 60초 호출.
 * V4.0.9의 60초 setInterval(checkResets + ...) 동등.
 */
export function useResetTick(): void {
  useEffect(() => {
    // 초기 1회
    useBarrackStore.getState().autoCheckResets();
    const id = setInterval(() => {
      useBarrackStore.getState().autoCheckResets();
    }, 60 * 1000);
    return () => clearInterval(id);
  }, []);
}
