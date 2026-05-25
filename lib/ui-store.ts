"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

/**
 * 메인 앱 전역 UI 상태 — 오버레이 store와 분리.
 * 메인 앱 화면 배율 + 오버레이 임베드 iframe 내부 배율.
 */
type UiState = {
  /** 메인 앱 화면 배율 (CSS body.zoom). 0.5 ~ 2.0 */
  mainScale: number;
  /**
   * 오버레이 확장 모드 임베드 페이지 텍스트 배율 (root font-size).
   * rem 베이스 컨텐츠(Tailwind text-xs, p-2 등)에 비례 적용.
   * 0.5 ~ 2.0
   */
  embedScale: number;
};

type UiActions = {
  setMainScale: (v: number) => void;
  setEmbedScale: (v: number) => void;
};

export const useUiStore = create<UiState & UiActions>()(
  persist(
    (set) => ({
      mainScale: 1.0,
      embedScale: 1.0,
      setMainScale: (v) => set({ mainScale: Math.max(0.5, Math.min(2.0, v)) }),
      setEmbedScale: (v) => set({ embedScale: Math.max(0.5, Math.min(2.0, v)) }),
    }),
    {
      name: "a2-ui",
      version: 3,
      migrate: (persisted: unknown, _v) => {
        const p = (persisted ?? {}) as Partial<UiState>;
        // 이전(zoom 기반) embedScale은 0.7 등 작은 값이었음 — 텍스트 배율(default 1.0)로 초기화
        return {
          mainScale: typeof p.mainScale === "number" ? p.mainScale : 1.0,
          embedScale: 1.0,
        };
      },
    }
  )
);
