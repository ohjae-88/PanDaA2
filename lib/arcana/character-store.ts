"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArcanaCharacter } from "./types";
import { LS_CHARS } from "./constants";

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

type Store = {
  characters: ArcanaCharacter[];
  setAll: (chars: ArcanaCharacter[]) => void;
  addCharacter: (name: string, jobId: string) => ArcanaCharacter;
  renameCharacter: (id: string, name: string) => void;
  removeCharacter: (id: string) => void;
  setJob: (id: string, jobId: string) => void;
};

export const useArcanaCharStore = create<Store>()(
  persist(
    (set) => ({
      characters: [],
      setAll: (chars) => set({ characters: chars }),
      addCharacter: (name, jobId) => {
        const c: ArcanaCharacter = {
          id: uid("ch"),
          name: name.trim() || "캐릭터",
          jobId,
          createdAt: Date.now(),
        };
        set((s) => ({ characters: [...s.characters, c] }));
        return c;
      },
      renameCharacter: (id, name) =>
        set((s) => ({
          characters: s.characters.map((c) => (c.id === id ? { ...c, name } : c)),
        })),
      removeCharacter: (id) =>
        set((s) => ({ characters: s.characters.filter((c) => c.id !== id) })),
      setJob: (id, jobId) =>
        set((s) => ({
          characters: s.characters.map((c) => (c.id === id ? { ...c, jobId } : c)),
        })),
    }),
    { name: LS_CHARS }
  )
);
