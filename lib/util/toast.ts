"use client";

/**
 * Toast 헬퍼 — sonner 직접 노출 + 일관된 기본값.
 *
 * 사용 패턴:
 *   import { toast } from "@/lib/util/toast";
 *   toast.success("저장됨");
 *   toast.error("실패: " + msg);
 *   toast.info("동기화 완료");
 *
 * 기존 alert() 대체. confirm()은 동기 API 한계로 별도 대체 필요 (AlertDialog).
 */

import { toast as sonnerToast } from "sonner";

export const toast = {
  success: (msg: string, opts?: { description?: string; duration?: number }) =>
    sonnerToast.success(msg, opts),
  error: (msg: string, opts?: { description?: string; duration?: number }) =>
    sonnerToast.error(msg, opts),
  info: (msg: string, opts?: { description?: string; duration?: number }) =>
    sonnerToast(msg, opts),
  warning: (msg: string, opts?: { description?: string; duration?: number }) =>
    sonnerToast.warning(msg, opts),
};
