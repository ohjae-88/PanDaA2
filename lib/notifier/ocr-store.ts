"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import { isTauri } from "@/lib/tauri";

export type OcrRegion = { x: number; y: number; w: number; h: number };
export type OcrLine = { text: string; x: number; y: number; w: number; h: number };
export type CaptureResult = { width: number; height: number; png_base64: string };
export type WinInfo = { id: number; title: string; app: string };

/** AION2 보스 목록 기본 캡처 영역 (물리px, 1920×1080 기준 좌측 목록) */
export const DEFAULT_OCR_REGION: OcrRegion = { x: 0, y: 106, w: 267, h: 1246 };

type OcrState = {
  /** 캡처할 영역 (대상 창 기준 물리 픽셀). 미지정 시 null */
  region: OcrRegion | null;
  setRegion: (r: OcrRegion | null) => void;
  /** 대상 프로그램 창 prefix (구분자│앞 부분 저장 → 캐릭터명 바뀌어도 유지).
   *  예) "AION2 │ 홍길동" → "AION2" 저장. null이면 주 모니터 폴백. */
  windowPrefix: string | null;
  setWindowPrefix: (t: string | null) => void;
  /** 영역 지정 시 저장한 썸네일(JPEG data URL, 영역 박스 포함). 세션 동안 유지. */
  previewBase64: string | null;
  setPreviewBase64: (b: string | null) => void;
};

/** 창 제목에서 구분자(│ |) 앞 prefix 추출 */
export function extractPrefix(title: string): string {
  return title.split(/[│|]/).at(0)?.trim() ?? title.trim();
}

export const useOcrStore = create<OcrState>()(
  persist(
    (set) => ({
      region: DEFAULT_OCR_REGION,
      setRegion: (r) => set({ region: r }),
      windowPrefix: null,
      setWindowPrefix: (t) => set({ windowPrefix: t }),
      previewBase64: null,
      setPreviewBase64: (b) => set({ previewBase64: b }),
    }),
    {
      name: "a2-notifier-ocr",
      // previewBase64은 세션 내 메모리만 — localStorage 제외
      partialize: (s) => ({ region: s.region, windowPrefix: s.windowPrefix }),
    }
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
