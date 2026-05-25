"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArcanaSetMaster, SetEffect } from "./types";
import { DEFAULT_SETS } from "./arcana-seed";
import { LS_SET_DB } from "./constants";

type Store = {
  sets: ArcanaSetMaster[];
  setAll: (sets: ArcanaSetMaster[]) => void;
  resetSeed: () => void;
  patchSet: (id: string, patch: Partial<ArcanaSetMaster>) => void;
  /** 특정 set의 특정 tier 효과 배열 갱신 */
  setTierEffects: (setId: string, tierN: number, effects: SetEffect[]) => void;
};

export const useSetStore = create<Store>()(
  persist(
    (set) => ({
      sets: [],

      setAll: (sets) => set({ sets }),
      resetSeed: () => set({ sets: JSON.parse(JSON.stringify(DEFAULT_SETS)) }),
      patchSet: (id, patch) =>
        set((s) => ({
          sets: s.sets.map((x) => (x.id === id ? { ...x, ...patch } : x)),
        })),
      setTierEffects: (setId, tierN, effects) =>
        set((s) => ({
          sets: s.sets.map((x) => {
            if (x.id !== setId) return x;
            const tiers = x.tiers.map((t) =>
              t.n === tierN ? { ...t, effects: effects.slice() } : t
            );
            return { ...x, tiers };
          }),
        })),
    }),
    {
      name: LS_SET_DB,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!Array.isArray(state.sets) || state.sets.length === 0) {
          state.sets = JSON.parse(JSON.stringify(DEFAULT_SETS));
        }
      },
    }
  )
);
