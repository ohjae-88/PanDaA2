"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArcanaCard } from "./types";
import { DEFAULT_ARCANA } from "./arcana-seed";
import { LS_ARCANA_DB, SET_LEVELUP_POLICY, CARD_MAX_LV } from "./constants";

type Store = {
  cards: ArcanaCard[];
  setCards: (cards: ArcanaCard[]) => void;
  resetSeed: () => void;
  patchCard: (id: string, patch: Partial<ArcanaCard>) => void;
  addCard: (card: ArcanaCard) => void;
  removeCard: (id: string) => void;
  /** 카드 직업별 스킬 슬롯 설정 */
  setCardSkillsForJob: (id: string, jobId: string, skillIds: string[]) => void;
};

function ensureCardShape(c: Partial<ArcanaCard>): ArcanaCard {
  const setKey = c.setKey || "";
  return {
    id: c.id || `arc_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    slot: c.slot || "Grail",
    setKey,
    grade: c.grade || "u",
    season: c.season || "",
    name: c.name || "",
    icon: c.icon || "",
    stats: c.stats && typeof c.stats === "object" ? c.stats : {},
    skillsByJob: c.skillsByJob && typeof c.skillsByJob === "object" ? c.skillsByJob : {},
    levelUp: c.levelUp || { ...(SET_LEVELUP_POLICY[setKey] || { skillPoint: 0, statPoint: 0 }) },
    maxLv: c.maxLv || CARD_MAX_LV,
  };
}

export const useArcanaStore = create<Store>()(
  persist(
    (set) => ({
      cards: [],

      setCards: (cards) => set({ cards: cards.map(ensureCardShape) }),
      resetSeed: () => set({ cards: DEFAULT_ARCANA.map(ensureCardShape) }),
      patchCard: (id, patch) =>
        set((s) => ({
          cards: s.cards.map((c) => (c.id === id ? ensureCardShape({ ...c, ...patch }) : c)),
        })),
      addCard: (card) =>
        set((s) => ({ cards: [...s.cards, ensureCardShape(card)] })),
      removeCard: (id) =>
        set((s) => ({ cards: s.cards.filter((c) => c.id !== id) })),
      setCardSkillsForJob: (id, jobId, skillIds) =>
        set((s) => ({
          cards: s.cards.map((c) => {
            if (c.id !== id) return c;
            const next = { ...(c.skillsByJob || {}) };
            next[jobId] = skillIds.slice();
            return { ...c, skillsByJob: next };
          }),
        })),
    }),
    {
      name: LS_ARCANA_DB,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (!Array.isArray(state.cards) || state.cards.length === 0) {
          state.cards = DEFAULT_ARCANA.map(ensureCardShape);
        } else {
          state.cards = state.cards.map(ensureCardShape);
        }
      },
    }
  )
);
