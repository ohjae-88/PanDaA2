"use client";

import { useEffect } from "react";
import { useUpdateStore } from "@/lib/util/update-store";
import { UpdateDialog } from "@/components/update-dialog";
import { isTauri } from "@/lib/tauri";

/**
 * 앱 시작 시 업데이트 자동 확인.
 * - 비 Tauri 환경(Next.js dev)에서는 스킵.
 * - silent=true → 업데이트 없으면 토스트 없음.
 * - AppProviders에 마운트.
 */
export function UpdateCheckProvider() {
  const check = useUpdateStore((s) => s.check);

  useEffect(() => {
    if (!isTauri()) return;
    // 마운트 직후 즉시 확인하면 앱 초기화와 경쟁 → 2초 딜레이
    const t = setTimeout(() => { check(true); }, 2000);
    return () => clearTimeout(t);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return <UpdateDialog />;
}
