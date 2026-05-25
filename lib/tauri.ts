"use client";

/**
 * Tauri 환경 감지 + 안전한 invoke 래퍼.
 * - 브라우저(개발 중 next dev 단독 실행) 환경에서도 동작하도록 noop 폴백
 * - Tauri 환경에서는 src-tauri/src/lib.rs의 #[tauri::command] 호출
 */

export function isTauri(): boolean {
  if (typeof window === "undefined") return false;
  return Boolean((window as any).__TAURI_INTERNALS__ ?? (window as any).__TAURI__);
}

async function getInvoke() {
  if (!isTauri()) return null;
  try {
    const mod = await import("@tauri-apps/api/core");
    return mod.invoke;
  } catch {
    return null;
  }
}

export async function setAlwaysOnTop(on: boolean): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke("set_always_on_top", { on });
}

export async function toggleWindowVisibility(): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke("toggle_window_visibility");
}

export async function getAppVersion(): Promise<string> {
  const invoke = await getInvoke();
  if (!invoke) return "5.4.0 (browser)";
  return invoke<string>("app_version");
}
