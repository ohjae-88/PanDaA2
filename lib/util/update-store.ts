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

type UpdateState = {
  /** null = 아직 확인 안 함 */
  info: UpdateInfo | null;
  open: boolean;
  checking: boolean;
  installing: boolean;
  progress: UpdateProgress | null;

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

  check: async (silent = false) => {
    if (get().checking) return;
    set({ checking: true });
    try {
      const info = await checkForUpdate();
      if (!info) {
        // 플러그인 미활성화 / 네트워크 오류
        if (!silent) toast.warning("업데이트 서버에 연결할 수 없습니다.");
        set({ checking: false });
        return;
      }
      set({ info, checking: false });
      if (info.available) {
        set({ open: true });
      } else {
        if (!silent) toast.success(`최신 버전입니다. (v${info.currentVersion})`);
      }
    } catch {
      if (!silent) toast.error("업데이트 확인 중 오류가 발생했습니다.");
      set({ checking: false });
    }
  },

  install: async () => {
    set({ installing: true, progress: { downloaded: 0, total: null } });
    try {
      const ok = await downloadAndInstall((downloaded, total) => {
        set({ progress: { downloaded, total } });
      });
      if (!ok) {
        toast.error("설치에 실패했습니다. 직접 다운로드해 주세요.");
        set({ installing: false, progress: null });
      }
      // 성공 시 앱이 재시작되므로 상태 초기화 불필요
    } catch {
      toast.error("설치 중 오류가 발생했습니다.");
      set({ installing: false, progress: null });
    }
  },

  openDialog: () => set({ open: true }),
  closeDialog: () => set({ open: false }),
}));
