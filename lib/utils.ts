import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** 텍스트 클립보드 복사 — Clipboard API 우선, 실패 시 textarea fallback.
 *  Tauri webview + 브라우저 + 오버레이 윈도우 모두 동작. */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false;
  try {
    if (typeof navigator !== "undefined" && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch { /* fall through to fallback */ }
  if (typeof document === "undefined") return false;
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;pointer-events:none;left:-9999px;top:0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch { /* ignore */ }
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** 짧은 화면 토스트 표시 — sonner 미사용 환경의 경량 피드백. body에 1.2s 후 자동 제거. */
let _toastTimer: ReturnType<typeof setTimeout> | null = null;
export function showToast(msg: string): void {
  if (typeof document === "undefined") return;
  let el = document.getElementById("__a2_toast__") as HTMLDivElement | null;
  if (!el) {
    el = document.createElement("div");
    el.id = "__a2_toast__";
    el.style.cssText = [
      "position:fixed",
      "left:50%",
      "bottom:32px",
      "transform:translateX(-50%)",
      "background:rgba(20,20,28,0.92)",
      "color:#fbbf24",
      "border:1px solid rgba(251,191,36,0.5)",
      "padding:8px 14px",
      "border-radius:8px",
      "font-size:12px",
      "font-weight:700",
      "z-index:2147483647",
      "pointer-events:none",
      "box-shadow:0 4px 12px rgba(0,0,0,0.4)",
      "transition:opacity 0.18s ease",
    ].join(";");
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    if (!el) return;
    el.style.opacity = "0";
    _toastTimer = setTimeout(() => {
      el?.remove();
      _toastTimer = null;
    }, 250);
  }, 1200);
}
