"use client";

import { usePathname } from "next/navigation";
import { StoreSyncProvider } from "@/components/store-sync-provider";
import { HotkeyProvider } from "@/components/overlay/hotkey-provider";
import { HotkeyRuntime } from "@/components/hotkey-runtime";
import { CloseConfirmDialog } from "@/components/close-confirm-dialog";
import { SecondInstanceDialog } from "@/components/second-instance-dialog";
import { NotifierTickRunner } from "@/components/notifier/notifier-tick-runner";

/**
 * 앱 전역 Provider — pathname에 따라 경량화.
 *
 *  - `/overlay/equip` (장비창 신규 윈도우): 표시 전용. HotkeyRuntime / 다이얼로그 listener /
 *    NotifierTickRunner 모두 불필요 → 미마운트 (리소스 절감).
 *  - 그 외 경로 (메인 + 오버레이 등): 전체 마운트.
 *
 *  StoreSyncProvider는 모든 윈도우에서 필요 (store 변경 즉시 반영). 단, 장비창은 store mutate
 *  거의 없으므로 한 윈도우 추가 비용은 작음. 추가 분리 시 StoreSyncProvider도 제외 가능.
 */
export function AppProviders() {
  const pathname = usePathname() ?? "";
  const isEquipWindow = pathname.startsWith("/overlay/equip");

  if (isEquipWindow) {
    // 장비창 — 최소 Provider만 (store 데이터 동기화는 유지)
    return <StoreSyncProvider />;
  }

  return (
    <>
      <StoreSyncProvider />
      <HotkeyProvider />
      <HotkeyRuntime />
      <CloseConfirmDialog />
      <SecondInstanceDialog />
      <NotifierTickRunner />
    </>
  );
}
