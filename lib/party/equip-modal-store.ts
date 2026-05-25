"use client";

import { create } from "zustand";

type EquipModalState = {
  open: boolean;
  pid: string | null;
  cid: string | null;
  openFor: (pid: string, cid: string) => void;
  close: () => void;
};

export const useEquipModal = create<EquipModalState>((set) => ({
  open: false,
  pid: null,
  cid: null,
  openFor: (pid, cid) => set({ open: true, pid, cid }),
  close: () => set({ open: false, pid: null, cid: null }),
}));
