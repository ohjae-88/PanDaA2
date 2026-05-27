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
  if (!invoke) return `${process.env.NEXT_PUBLIC_APP_VERSION ?? "0.0.0"} (browser)`;
  return invoke<string>("app_version");
}

export async function openDownloadFolder(): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke("open_download_folder");
}

/** 업데이트 실패 로그를 앱 로그 디렉토리에 저장. 저장된 파일 경로 반환, 실패 시 null. */
export async function saveUpdateErrorLog(content: string): Promise<string | null> {
  const invoke = await getInvoke();
  if (!invoke) return null;
  try {
    return await invoke<string>("save_update_error_log", { content });
  } catch {
    return null;
  }
}

/** 파일 탐색기에서 지정 파일을 선택된 상태로 열기. */
export async function revealInExplorer(path: string): Promise<void> {
  const invoke = await getInvoke();
  if (!invoke) return;
  await invoke("reveal_in_explorer", { path });
}
