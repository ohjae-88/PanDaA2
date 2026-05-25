"use client";

/**
 * 크로스 윈도우 store 동기화 (Tauri 멀티 윈도우 전용).
 *
 * 메인 윈도우에서 store mutate → 오버레이 윈도우에 자동 반영, 반대도 동일.
 * 두 윈도우는 별개의 JS 컨텍스트 + 별개의 Zustand 인스턴스이므로 localStorage
 * 공유만으로는 자동 동기화되지 않는다. Tauri 이벤트로 브로드캐스트하고 수신 측
 * `persist.rehydrate()`로 최신 상태를 다시 읽어들인다.
 *
 * 무한 루프 방지: rehydrate 도중에는 emit 억제 + payload에 source label 포함하여
 * 자기 emit 무시.
 *
 * 브라우저(Tauri 비실행) 환경에서는 no-op.
 */

import { isTauri } from "@/lib/tauri";
import { useOverlayStore } from "./store";
import { useNotifierStore } from "@/lib/notifier/store";
import { useBarrackStore } from "@/lib/barrack/store";
import { usePartyStore } from "@/lib/party/store";
import { useUiStore } from "@/lib/ui-store";

type SyncableStore = {
  subscribe: (listener: () => void) => () => void;
  persist?: { rehydrate: () => void | Promise<void> };
};

const STORES: Record<string, SyncableStore> = {
  "a2-overlay": useOverlayStore as unknown as SyncableStore,
  "a2-notifier": useNotifierStore as unknown as SyncableStore,
  "a2-barrack": useBarrackStore as unknown as SyncableStore,
  "a2-party": usePartyStore as unknown as SyncableStore,
  "a2-ui": useUiStore as unknown as SyncableStore,
};

const EVENT_NAME = "a2-store-sync";

type SyncPayload = { key: string; source: string };

let initialized = false;
let suppressEmit = false;
let teardown: (() => void) | null = null;

/** localStorage `storage` 이벤트 폴백 — iframe 등 Tauri 이벤트 미지원 컨텍스트에서도 동기화 */
function attachStorageFallback(): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (!e.key) return;
    const store = STORES[e.key];
    if (!store?.persist) return;
    suppressEmit = true;
    try {
      Promise.resolve(store.persist.rehydrate()).finally(() => {
        Promise.resolve().then(() => {
          suppressEmit = false;
        });
      });
    } catch {
      suppressEmit = false;
    }
  };
  window.addEventListener("storage", onStorage);
  return () => window.removeEventListener("storage", onStorage);
}

export async function initStoreSync(): Promise<() => void> {
  if (initialized) return teardown ?? (() => {});
  initialized = true;
  // 브라우저/iframe 폴백 — storage 이벤트로 cross-document sync
  const detachStorage = attachStorageFallback();
  if (!isTauri()) {
    teardown = detachStorage;
    return teardown;
  }

  const [eventMod, windowMod] = await Promise.all([
    import("@tauri-apps/api/event"),
    import("@tauri-apps/api/window"),
  ]);
  const { emit, listen } = eventMod;
  const myLabel = windowMod.getCurrentWindow().label;

  // 장비창 — 표시 전용, store mutate 없음. sync 비용만 발생 → 제외.
  if (myLabel === "equip") {
    teardown = detachStorage;
    return teardown;
  }

  // 수신 — 다른 윈도우에서 store 변경되면 rehydrate
  const unlisten = await listen<SyncPayload>(EVENT_NAME, async (e) => {
    if (!e.payload || e.payload.source === myLabel) return;
    const store = STORES[e.payload.key];
    if (!store?.persist) return;
    suppressEmit = true;
    try {
      await store.persist.rehydrate();
    } finally {
      // microtask 뒤로 미뤄서 rehydrate가 트리거한 subscribe 콜백까지 흡수
      Promise.resolve().then(() => {
        suppressEmit = false;
      });
    }
  });

  // 송신 — 각 store 변경 시 500ms 디바운스로 broadcast (sub-second 동기화 불필요)
  const timers: Record<string, ReturnType<typeof setTimeout> | null> = {};
  const subs: Array<() => void> = [];
  for (const [key, store] of Object.entries(STORES)) {
    const off = store.subscribe(() => {
      if (suppressEmit) return;
      if (timers[key]) clearTimeout(timers[key]!);
      timers[key] = setTimeout(() => {
        timers[key] = null;
        emit(EVENT_NAME, { key, source: myLabel } satisfies SyncPayload).catch(
          () => {}
        );
      }, 500);
    });
    subs.push(off);
  }

  teardown = () => {
    detachStorage();
    unlisten();
    subs.forEach((u) => u());
    Object.values(timers).forEach((t) => t && clearTimeout(t));
    initialized = false;
    teardown = null;
  };
  return teardown;
}
