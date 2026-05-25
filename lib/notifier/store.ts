"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { NotifierItem, NotifierState, NotifierSettings, NotifierGroup, SpecificTime } from "./types";
import { buildSeedItems } from "./seed";
import { nextSpawnMs } from "./time";
import { BUILD_SNAPSHOT, hasSnapshot } from "@/lib/defaults/snapshot";

type Store = NotifierState & {
  // 아이템 관리
  upsertItem: (item: NotifierItem) => void;
  removeItem: (id: string) => void;
  setItems: (items: NotifierItem[]) => void;
  resetSeed: () => void;

  // 액션
  markSpawned: (id: string) => void;
  setLastSpawnTs: (id: string, ts: number) => void;
  toggleNotify: (id: string) => void;
  toggleImportant: (id: string) => void;

  // 설정 / 정렬
  updateSettings: (patch: Partial<NotifierSettings>) => void;
  setItemOrder: (ids: string[]) => void;
  setGroupOrder: (groups: string[]) => void;

  // 알림 키
  markNotified: (key: string) => void;
  clearNotifiedForItem: (id: string) => void;

  // 일괄 편집
  bulkUpdateNotify: (updates: { id: string; enabled: boolean; beforeMin: number }[]) => void;

  // 표시 토글 (사용자설정 모드)
  toggleDisplayHidden: (id: string) => void;
  setItemDisplayHidden: (id: string, hidden: boolean) => void;

  // 그룹 관리
  upsertGroup: (g: NotifierGroup) => void;
  removeGroup: (groupId: string) => void;
  setItemGroups: (id: string, groupIds: string[]) => void;

  // 자동 진행 (10분 그레이스)
  autoAdvanceCooldowns: () => boolean;
};

const defaultSettings: NotifierSettings = {
  notifyAtZero: false,
  notifyAtZeroSec: 0,
  viewMode: "group",
  displayFilter: "all",
  combineEnabled: false,
  combineThresholdMin: 5,
  soundEnabled: true,
  soundVolume: 0.6,
  alarmHighlightSec: 15,
  alarmSoundId: "beep",
};

// 빌드 스냅샷 우선 — 신규 사용자 첫 실행 시 적용
const initialItems: NotifierItem[] = hasSnapshot("notifierItems")
  ? JSON.parse(JSON.stringify(BUILD_SNAPSHOT.notifierItems!))
  : [];
const initialSettings: NotifierSettings = hasSnapshot("notifierSettings")
  ? { ...defaultSettings, ...BUILD_SNAPSHOT.notifierSettings! }
  : defaultSettings;
const initialGroups: NotifierGroup[] = hasSnapshot("notifierGroups")
  ? JSON.parse(JSON.stringify(BUILD_SNAPSHOT.notifierGroups!))
  : [];

export const useNotifierStore = create<Store>()(
  persist(
    (set, get) => ({
      items: initialItems,
      notified: {},
      settings: initialSettings,
      itemOrder: [],
      groupOrder: [],
      groupDefs: initialGroups,

      upsertItem: (item) =>
        set((s) => {
          const idx = s.items.findIndex((x) => x.id === item.id);
          if (idx < 0) return { items: [...s.items, item] };
          const next = s.items.slice();
          const prev = next[idx];
          next[idx] = item;
          // 알림 관련 필드 변경 시 notified 키 정리 — 변경한 설정이 즉시 적용되도록
          const notifyChanged =
            prev.notifyBeforeMin !== item.notifyBeforeMin ||
            prev.notifyEnabled !== item.notifyEnabled ||
            prev.cycleType !== item.cycleType ||
            prev.cycleMinutes !== item.cycleMinutes ||
            JSON.stringify(prev.specificTimes || []) !== JSON.stringify(item.specificTimes || []);
          if (!notifyChanged) return { items: next };
          const notified = { ...s.notified };
          Object.keys(notified).forEach((k) => {
            if (k.startsWith(item.id + "_")) delete notified[k];
          });
          return { items: next, notified };
        }),

      removeItem: (id) =>
        set((s) => ({
          items: s.items.filter((x) => x.id !== id),
          itemOrder: s.itemOrder.filter((x) => x !== id),
        })),

      setItems: (items) => set({ items }),

      resetSeed: () =>
        set({
          items: buildSeedItems(),
          notified: {},
          itemOrder: [],
          groupOrder: [],
        }),

      markSpawned: (id) =>
        set((s) => {
          const items = s.items.map((it) =>
            it.id === id ? { ...it, lastSpawnTs: Date.now() } : it
          );
          const notified = { ...s.notified };
          Object.keys(notified).forEach((k) => {
            if (k.startsWith(id + "_")) delete notified[k];
          });
          return { items, notified };
        }),

      setLastSpawnTs: (id, ts) =>
        set((s) => {
          const items = s.items.map((it) => (it.id === id ? { ...it, lastSpawnTs: ts } : it));
          const notified = { ...s.notified };
          Object.keys(notified).forEach((k) => {
            if (k.startsWith(id + "_")) delete notified[k];
          });
          return { items, notified };
        }),

      toggleNotify: (id) =>
        set((s) => {
          const items = s.items.map((it) =>
            it.id === id ? { ...it, notifyEnabled: !it.notifyEnabled } : it
          );
          // 알림 토글 시 — 켜기/끄기 양쪽에서 notified 정리. 켤 때 즉시 재발화 가능하도록.
          const notified = { ...s.notified };
          Object.keys(notified).forEach((k) => {
            if (k.startsWith(id + "_")) delete notified[k];
          });
          return { items, notified };
        }),

      toggleImportant: (id) =>
        set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, important: !it.important } : it)),
        })),

      updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),
      setItemOrder: (ids) => set({ itemOrder: ids }),
      setGroupOrder: (groups) => set({ groupOrder: groups }),

      markNotified: (key) =>
        set((s) => {
          const now = Date.now();
          const sExt = s as unknown as { _notifiedPrunedAt?: number };
          const lastPrune = sExt._notifiedPrunedAt ?? 0;
          // 매 호출 O(N) prune 회피 — 5분 간격으로만 prune 실행
          if (now - lastPrune < 5 * 60_000) {
            return { notified: { ...s.notified, [key]: true } };
          }
          // 24시간 이전 ts 키 정리. 키 형식: `${id}_${ts}` 등 마지막 큰 숫자가 ts.
          const CUTOFF = now - 24 * 60 * 60_000;
          const next: Record<string, true> = {};
          for (const k of Object.keys(s.notified)) {
            const m = k.match(/(\d{10,})/);
            const ts = m ? parseInt(m[1], 10) : NaN;
            if (!Number.isFinite(ts) || ts >= CUTOFF) next[k] = true;
          }
          next[key] = true;
          return ({ notified: next, _notifiedPrunedAt: now } as unknown) as Partial<typeof s>;
        }),

      clearNotifiedForItem: (id) =>
        set((s) => {
          const next = { ...s.notified };
          Object.keys(next).forEach((k) => {
            if (k.startsWith(id + "_")) delete next[k];
          });
          return { notified: next };
        }),

      bulkUpdateNotify: (updates) =>
        set((s) => {
          const map = new Map(updates.map((u) => [u.id, u]));
          const items = s.items.map((it) => {
            const u = map.get(it.id);
            if (!u) return it;
            return { ...it, notifyEnabled: u.enabled, notifyBeforeMin: u.beforeMin };
          });
          const notified = { ...s.notified };
          updates.forEach((u) => {
            if (!u.enabled) {
              Object.keys(notified).forEach((k) => {
                if (k.startsWith(u.id + "_")) delete notified[k];
              });
            }
          });
          return { items, notified };
        }),

      toggleDisplayHidden: (id) =>
        set((s) => ({
          items: s.items.map((it) =>
            it.id === id ? { ...it, displayHidden: !it.displayHidden } : it
          ),
        })),

      setItemDisplayHidden: (id, hidden) =>
        set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, displayHidden: hidden } : it)),
        })),

      upsertGroup: (g) =>
        set((s) => {
          const list = s.groupDefs ?? [];
          const idx = list.findIndex((x) => x.id === g.id);
          const next = list.slice();
          if (idx < 0) next.push(g);
          else next[idx] = g;
          return { groupDefs: next };
        }),

      removeGroup: (groupId) =>
        set((s) => {
          const list = (s.groupDefs ?? []).filter((g) => g.id !== groupId);
          // 아이템들에서 해당 그룹 제거
          const items = s.items.map((it) =>
            it.groups?.includes(groupId)
              ? { ...it, groups: it.groups.filter((g) => g !== groupId) }
              : it
          );
          return { groupDefs: list, items };
        }),

      setItemGroups: (id, groupIds) =>
        set((s) => ({
          items: s.items.map((it) => (it.id === id ? { ...it, groups: groupIds } : it)),
        })),

      autoAdvanceCooldowns: () => {
        const GRACE = 10 * 60_000;
        let changed = false;
        const items = get().items.map((it) => {
          if (it.cycleType !== "cooldown" || !it.lastSpawnTs) return it;
          const cycleMs = (it.cycleMinutes || 0) * 60_000;
          if (cycleMs <= 0) return it;
          let last = it.lastSpawnTs;
          const now = Date.now();
          while (last + cycleMs + GRACE <= now) {
            last += cycleMs;
            changed = true;
          }
          return last === it.lastSpawnTs ? it : { ...it, lastSpawnTs: last };
        });
        if (changed) set({ items });
        return changed;
      },
    }),
    {
      name: "a2-notifier",
      // notified 키는 메모리 캐시 — persist 제외 (localStorage I/O 압력 완화)
      partialize: (state) => {
        const out = { ...state } as Partial<NotifierState> & Record<string, unknown>;
        delete (out as Record<string, unknown>).notified;
        return out;
      },
      // hydration 안전: 첫 로드 시 빈 배열이면 시드 주입
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 누락 필드 마이그레이션
        state.settings = { ...defaultSettings, ...(state.settings ?? {}) };
        state.groupDefs = state.groupDefs ?? [];
        // partialize로 persist 제외했으므로 rehydrate 후 notified 빈 객체 보장
        state.notified = state.notified ?? {};
        if (state.items.length === 0) {
          state.items = buildSeedItems();
        }
      },
    }
  )
);

/** 그룹·잔여시간 정렬 헬퍼 */
export function sortGroupItems(items: NotifierItem[], itemOrder: string[]): NotifierItem[] {
  const ord = itemOrder || [];
  return items.slice().sort((a, b) => {
    const ai = ord.indexOf(a.id);
    const bi = ord.indexOf(b.id);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    const an = nextSpawnMs(a);
    const bn = nextSpawnMs(b);
    if (an == null && bn == null) return 0;
    if (an == null) return 1;
    if (bn == null) return -1;
    return an - bn;
  });
}

/** "전체" 모드: 3분할 균등 배치 */
export function distributeToColumns(items: NotifierItem[], cols = 3): NotifierItem[][] {
  const sorted = items.slice().sort((a, b) => {
    const an = nextSpawnMs(a);
    const bn = nextSpawnMs(b);
    if (an == null && bn == null) return 0;
    if (an == null) return 1;
    if (bn == null) return -1;
    return an - bn;
  });
  const out: NotifierItem[][] = Array.from({ length: cols }, () => []);
  const perCol = Math.max(1, Math.ceil(sorted.length / cols));
  sorted.forEach((it, i) => {
    const c = Math.min(cols - 1, Math.floor(i / perCol));
    out[c].push(it);
  });
  return out;
}

/** SpecificTime 생성 헬퍼 */
export function makeSpecificTime(day = -1, hour = 21, minute = 0): SpecificTime {
  return { day, hour, minute };
}
