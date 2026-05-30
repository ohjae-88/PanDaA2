"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isTauri } from "@/lib/tauri";

export type OcrRegion = { x: number; y: number; w: number; h: number };
export type OcrLine = { text: string; x: number; y: number; w: number; h: number };
export type CaptureResult = { width: number; height: number; png_base64: string };
export type WinInfo = { id: number; title: string; app: string };

type OcrState = {
  /** 캡처할 영역 (대상 창 기준 물리 픽셀). 미지정 시 null */
  region: OcrRegion | null;
  setRegion: (r: OcrRegion | null) => void;
  /** 대상 프로그램 창 제목 (제목으로 재탐색). null이면 주 모니터 폴백 */
  windowTitle: string | null;
  setWindowTitle: (t: string | null) => void;
};

export const useOcrStore = create<OcrState>()(
  persist(
    (set) => ({
      region: null,
      setRegion: (r) => set({ region: r }),
      windowTitle: null,
      setWindowTitle: (t) => set({ windowTitle: t }),
    }),
    { name: "a2-notifier-ocr" }
  )
);

async function getInvoke() {
  if (!isTauri()) return null;
  try {
    const mod = await import("@tauri-apps/api/core");
    return mod.invoke;
  } catch {
    return null;
  }
}

/** 열린 창 목록. Tauri 아니면 null. */
export async function listWindows(): Promise<WinInfo[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  return invoke<WinInfo[]>("ocr_list_windows");
}

/** 지정 창 캡처 → PNG base64. Tauri 아니면 null. */
export async function captureWindow(title: string): Promise<CaptureResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  return invoke<CaptureResult>("ocr_capture_window", { title });
}

/** 주 모니터 전체 캡처 → PNG base64 (폴백). Tauri 아니면 null. */
export async function capturePrimary(): Promise<CaptureResult | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  return invoke<CaptureResult>("ocr_capture_primary");
}

const rg = (r: OcrRegion) => ({ x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h) });

/** 지정 창의 영역 캡처 + OCR. Tauri 아니면 null. */
export async function ocrRegionWindow(title: string, r: OcrRegion): Promise<OcrLine[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  return invoke<OcrLine[]>("ocr_region_window", { title, ...rg(r) });
}

/** 주 모니터 영역 캡처 + OCR (폴백). Tauri 아니면 null. */
export async function ocrRegion(r: OcrRegion): Promise<OcrLine[] | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  return invoke<OcrLine[]>("ocr_region", rg(r));
}
