"use client";

import { isTauri } from "@/lib/tauri";

async function tauriInvoke<T = unknown>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error("Tauri 환경에서만 사용 가능 (브라우저 미지원)");
  const mod = await import("@tauri-apps/api/core");
  return mod.invoke<T>(cmd, args);
}

export function openOverlay(): Promise<void> {
  return tauriInvoke<void>("open_overlay");
}
export function closeOverlay(): Promise<void> {
  return tauriInvoke<void>("close_overlay");
}
export function toggleOverlay(): Promise<boolean> {
  return tauriInvoke<boolean>("toggle_overlay");
}
export function setOverlayPassthrough(ignore: boolean): Promise<void> {
  return tauriInvoke<void>("set_overlay_passthrough", { ignore });
}
export function setOverlayAlwaysOnTop(on: boolean): Promise<void> {
  return tauriInvoke<void>("set_overlay_always_on_top", { on });
}
export function isOverlayOpen(): Promise<boolean> {
  return tauriInvoke<boolean>("is_overlay_open");
}
export function setOverlaySize(width: number, height: number): Promise<void> {
  return tauriInvoke<void>("set_overlay_size", { width, height });
}
export function setOverlayPosition(x: number, y: number): Promise<void> {
  return tauriInvoke<void>("set_overlay_position", { x, y });
}
export type OverlayGeometry = { x: number; y: number; w: number; h: number };
export async function getOverlayGeometry(): Promise<OverlayGeometry | null> {
  try {
    return await tauriInvoke<OverlayGeometry | null>("get_overlay_geometry");
  } catch {
    return null;
  }
}
export function registerOverlayPassthroughHotkey(accelerator: string): Promise<void> {
  return tauriInvoke<void>("register_overlay_passthrough_hotkey", { accelerator });
}
export function unregisterOverlayPassthroughHotkey(): Promise<void> {
  return tauriInvoke<void>("unregister_overlay_passthrough_hotkey");
}
export function showMainWindow(): Promise<void> {
  return tauriInvoke<void>("show_main_window");
}
export function registerOverlayHeaderToggleHotkey(accelerator: string): Promise<void> {
  return tauriInvoke<void>("register_overlay_header_toggle_hotkey", { accelerator });
}
export function unregisterOverlayHeaderToggleHotkey(): Promise<void> {
  return tauriInvoke<void>("unregister_overlay_header_toggle_hotkey");
}

/** 사용자 정의 단축키 등록 — 누르면 'custom-hotkey-fired' 이벤트 emit (payload = id). */
export function registerCustomHotkey(id: string, accelerator: string): Promise<void> {
  return tauriInvoke<void>("register_custom_hotkey", { id, accelerator });
}
export function unregisterCustomHotkey(id: string): Promise<void> {
  return tauriInvoke<void>("unregister_custom_hotkey", { id });
}
export function unregisterAllCustomHotkeys(): Promise<void> {
  return tauriInvoke<void>("unregister_all_custom_hotkeys");
}

/** 앱 완전 종료 — Rust 측에서 app.exit(0) */
export function exitApp(): Promise<void> {
  return tauriInvoke<void>("exit_app");
}

/** 오버레이 윈도우 open/close 이벤트 구독 — payload: boolean (true=open, false=closed).
 *  반환된 unlisten 함수 호출로 해제. Tauri 비실행 시 no-op cleanup 반환. */
export async function onOverlayStateChanged(
  cb: (open: boolean) => void
): Promise<() => void> {
  if (!isTauri()) return () => {};
  const { listen } = await import("@tauri-apps/api/event");
  const un = await listen<boolean>("overlay-state-changed", (e) => {
    cb(!!e.payload);
  });
  return un;
}

/** 앱 재시작 — Rust 측에서 app.restart(). 기존 프로세스 종료 후 새 프로세스 spawn. */
export function restartApp(): Promise<void> {
  return tauriInvoke<void>("restart_app");
}
