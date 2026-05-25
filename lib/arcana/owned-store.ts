"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OwnedCard } from "./types";
import { LS_OWNED } from "./constants";

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function ensureOwnedShape(o: Partial<OwnedCard>): OwnedCard {
  return {
    id: o.id || uid("owned"),
    masterId: o.masterId || "",
    level: typeof o.level === "number" ? o.level : 1,
    charId: o.charId ?? null,
    gains: {
      stats: o.gains?.stats ?? {},
      skills: o.gains?.skills ?? {},
    },
    enabledSkills: Array.isArray(o.enabledSkills) ? [...o.enabledSkills] : [],
    note: o.note ?? "",
  };
}

type Store = {
  ownedCards: OwnedCard[];

  setAll: (cards: OwnedCard[]) => void;

  addOwned: (init: Partial<OwnedCard>) => OwnedCard;
  patchOwned: (id: string, patch: Partial<OwnedCard>) => void;
  removeOwned: (id: string) => void;
  removeByChar: (charId: string) => void;

  setLevel: (id: string, level: number) => void;
  setGainStats: (id: string, stats: Record<string, number>) => void;
  setGainSkills: (id: string, skills: Record<string, number>) => void;
};

export const useOwnedStore = create<Store>()(
  persist(
    (set) => ({
      ownedCards: [],

      setAll: (cards) => set({ ownedCards: cards.map(ensureOwnedShape) }),

      addOwned: (init) => {
        const card = ensureOwnedShape(init);
        set((s) => ({ ownedCards: [...s.ownedCards, card] }));
        return card;
      },
      patchOwned: (id, patch) =>
        set((s) => ({
          ownedCards: s.ownedCards.map((c) => (c.id === id ? ensureOwnedShape({ ...c, ...patch }) : c)),
        })),
      removeOwned: (id) =>
        set((s) => ({ ownedCards: s.ownedCards.filter((c) => c.id !== id) })),
      removeByChar: (charId) =>
        set((s) => ({ ownedCards: s.ownedCards.filter((c) => c.charId !== charId) })),

      setLevel: (id, level) =>
        set((s) => ({
          ownedCards: s.ownedCards.map((c) => (c.id === id ? { ...c, level } : c)),
        })),
      setGainStats: (id, stats) =>
        set((s) => ({
          ownedCards: s.ownedCards.map((c) => (c.id === id ? { ...c, gains: { ...c.gains, stats } } : c)),
        })),
      setGainSkills: (id, skills) =>
        set((s) => ({
          ownedCards: s.ownedCards.map((c) => (c.id === id ? { ...c, gains: { ...c.gains, skills } } : c)),
        })),
    }),
    {
      name: LS_OWNED,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Array.isArray(state.ownedCards)) {
          state.ownedCards = state.ownedCards.map(ensureOwnedShape);
        }
      },
    }
  )
);
