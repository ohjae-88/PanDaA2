"use client";

/**
 * 업데이트 전역 상태 (zustand).
 *
 * 사용처:
 *  - UpdateCheckProvider : 앱 시작 시 자동 확인
 *  - SiteHeader          : 수동 확인 버튼
 *  - UpdateDialog        : 설치 다이얼로그
 */

import { create } from "zustand";
import { checkForUpdate, downloadAndInstall, type UpdateInfo } from "./updater";
import { toast } from "./toast";

export type UpdateProgress = { downloaded: number; total: number | null };

export const RELEASES_URL = "https://github.com/ohjae-88/PanDaA2/releases/latest";

type UpdateState = {
  /** null = 아직 확인 안 함 */
  info: UpdateInfo | null;
  open: boolean;
  checking: boolean;
  installing: boolean;
  progress: UpdateProgress | null;
  /** 업데이트 서버 연결 실패 또는 설치 실패 여부 */
  failed: boolean;
  /** 설치 실패 시 저장된 로그 파일 경로 (null = 저장 안 됨) */
  errorLogPath: string | null;

  /** 업데이트 확인. 신규 버전 있으면 다이얼로그 자동 오픈. */
  check: (silent?: boolean) => Promise<void>;
  /** 다운로드 + 설치 + 재시작 */
  install: () => Promise<void>;
  openDialog: () => void;
  closeDialog: () => void;
};

export const useUpdateStore = create<UpdateState>((set, get) => ({
  info: null,
  open: false,
  checking: false,
  installing: false,
  progress: null,
  failed: false,
  errorLogPath: null,

  check: async (silent = false) => {
    if (get().checking) return;
    set({ checking: true, failed: false, errorLogPath: null });
    try {
      const info = await checkForUpdate();
      if (!info) {
        // 플러그인 미활성화 / 네트워크 오류 / latest.json 없음
        if (!silent) {
          // 수동 확인 시 다이얼로그에 다운로드 링크 표시
          set({ failed: true, open: true, checking: false });
        } else {
          set({ checking: false });
        }
        return;
      }
      set({ info, checking: false });
      if (info.available) {
        set({ open: true });
      } else {
        if (!silent) toast.success(`최신 버전입니다. (v${info.currentVersion})`);
      }
    } catch {
      if (!silent) {
        set({ failed: true, open: true, checking: false });
      } else {
        set({ checking: false });
      }
    }
  },

  install: async () => {
    set({ installing: true, progress: { downloaded: 0, total: null }, failed: false, errorLogPath: null });
    try {
      const result = await downloadAndInstall((downloaded, total) => {
        set({ progress: { downloaded, total } });
      });
      if (!result.ok) {
        set({
          failed: true,
          installing: false,
          progress: null,
          errorLogPath: result.errorLogPath,
        });
      }
      // 성공 시 앱이 재시작되므로 상태 초기화 불필요
    } catch {
      set({ failed: true, installing: false, progress: null, errorLogPath: null });
    }
  },

  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false, failed: false, errorLogPath: null }),
}));
