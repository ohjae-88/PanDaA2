"use client";

import { create } from "zustand";

/**
 * 비동기 confirm 다이얼로그 — window.confirm() 대체.
 *
 * 사용 패턴:
 *   import { confirmDialog } from "@/lib/util/confirm";
 *   if (!await confirmDialog("정말 삭제하시겠습니까?")) return;
 *
 *   confirmDialog({
 *     title: "삭제 확인",
 *     description: "복구할 수 없습니다.",
 *     confirmText: "삭제",
 *     cancelText: "취소",
 *     variant: "destructive",
 *   });
 *
 * `<ConfirmDialogHost />` 는 layout.tsx에 1회 마운트되어 store 상태를 다이얼로그로 렌더.
 */

export type ConfirmOptions = {
  title?: string;
  description?: string;
  confirmText?: string;
  cancelText?: string;
  variant?: "default" | "destructive";
};

type State = {
  open: boolean;
  options: ConfirmOptions;
  resolve: ((v: boolean) => void) | null;
  show: (opts: ConfirmOptions) => Promise<boolean>;
  respond: (v: boolean) => void;
};

export const useConfirmStore = create<State>((set, get) => ({
  open: false,
  options: {},
  resolve: null,
  show: (opts) =>
    new Promise<boolean>((resolve) => {
      // 이전 promise가 미해결 상태면 cancel 처리 — 중첩 호출 방지
      const prev = get().resolve;
      if (prev) prev(false);
      set({ open: true, options: opts, resolve });
    }),
  respond: (v) => {
    const r = get().resolve;
    set({ open: false, resolve: null });
    if (r) r(v);
  },
}));

/**
 * 짧은 문자열만 넘기면 description으로 사용. 객체 넘기면 전체 옵션.
 */
export function confirmDialog(opts: string | ConfirmOptions): Promise<boolean> {
  const o: ConfirmOptions = typeof opts === "string" ? { description: opts } : opts;
  return useConfirmStore.getState().show(o);
}
