"use client";

import { useEffect } from "react";
import { initStoreSync } from "@/lib/overlay/sync";

/** 메인 + 오버레이 윈도우 모두에서 마운트되어 store 동기화 활성화 */
export function StoreSyncProvider() {
  useEffect(() => {
    let off: (() => void) | null = null;
    initStoreSync().then((u) => {
      off = u;
    });
    return () => {
      off?.();
    };
  }, []);
  return null;
}
