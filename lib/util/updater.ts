"use client";

/**
 * 인앱 업데이트 — tauri-plugin-updater 래퍼.
 *
 * **활성화 전 필수 설정** (현재 미설정 → 호출 시 조용히 실패):
 *  1. 서명 키 생성: `npx @tauri-apps/cli signer generate -w ~/.tauri/myapp.key`
 *  2. `src-tauri/tauri.conf.json` 에 plugins.updater 추가:
 *     ```json
 *     "plugins": {
 *       "updater": {
 *         "active": true,
 *         "endpoints": ["https://github.com/ohjae-88/PanDaA2/releases/latest/download/latest.json"],
 *         "dialog": false,
 *         "pubkey": "<공개키 base64>"
 *       }
 *     }
 *     ```
 *  3. GitHub release 시 `latest.json` 파일 + .sig 서명 첨부 (CI에서 생성)
 *  4. `src-tauri/src/lib.rs` 빌더 체인에 `.plugin(tauri_plugin_updater::Builder::new().build())` 추가
 *  5. `capabilities/default.json` 권한 `updater:default` 추가
 *
 * 호출 흐름: checkUpdate() → 사용자 확인 → downloadAndInstall() → 앱 재시작
 */

import { isTauri } from "@/lib/tauri";
import { log } from "./logger";

export type UpdateInfo = {
  available: boolean;
  currentVersion: string;
  newVersion?: string;
  notes?: string;
};

type UpdateEvent =
  | { event: "Started"; data: { contentLength?: number | null } }
  | { event: "Progress"; data: { chunkLength: number } }
  | { event: "Finished" };

type UpdatePluginUpdate = {
  version: string;
  body?: string;
  downloadAndInstall: (cb: (e: UpdateEvent) => void) => Promise<void>;
};

type UpdaterPlugin = {
  check: () => Promise<UpdatePluginUpdate | null>;
};

async function loadUpdater(): Promise<UpdaterPlugin | null> {
  try {
    const m = await import(/* @vite-ignore */ "@tauri-apps/plugin-updater" as string);
    return m as unknown as UpdaterPlugin;
  } catch {
    return null;
  }
}

async function loadProcess(): Promise<{ relaunch: () => Promise<void> } | null> {
  try {
    const m = await import(/* @vite-ignore */ "@tauri-apps/plugin-process" as string);
    return m as unknown as { relaunch: () => Promise<void> };
  } catch {
    return null;
  }
}

/** 업데이트 확인. 가능 시 정보 반환, 없으면 available=false. */
export async function checkForUpdate(): Promise<UpdateInfo | null> {
  if (!isTauri()) return null;
  try {
    const mod = await loadUpdater();
    if (!mod) return null;
    const update = await mod.check();
    const appMod = await import("@tauri-apps/api/app");
    const currentVersion = await appMod.getVersion();
    if (!update) return { available: false, currentVersion };
    return {
      available: true,
      currentVersion,
      newVersion: update.version,
      notes: update.body,
    };
  } catch (e) {
    log.warn("updater check failed", e);
    return null;
  }
}

/** 다운로드 + 설치 + 재시작. 진행률 콜백 옵션. */
export async function downloadAndInstall(
  onProgress?: (downloaded: number, total: number | null) => void
): Promise<boolean> {
  if (!isTauri()) return false;
  try {
    const mod = await loadUpdater();
    if (!mod) return false;
    const update = await mod.check();
    if (!update) return false;
    let downloaded = 0;
    let total: number | null = null;
    await update.downloadAndInstall((event: UpdateEvent) => {
      if (event.event === "Started") {
        total = event.data.contentLength ?? null;
      } else if (event.event === "Progress") {
        downloaded += event.data.chunkLength;
        onProgress?.(downloaded, total);
      }
    });
    const procMod = await loadProcess();
    if (procMod) await procMod.relaunch();
    return true;
  } catch (e) {
    log.error("updater install failed", e);
    return false;
  }
}
