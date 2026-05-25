/**
 * 빌드 기본값 스냅샷 — 배포 시 신규 사용자가 처음 실행할 때 적용되는 기본 설정.
 *
 * 포함 대상:
 *  - barrackDb: 배럭관리 DB 설정 (오드 한도, 키나 구간, 서버 목록 등)
 *  - notifierItems: 알리미 DB 항목 목록 (보스/이벤트)
 *  - notifierSettings: 알리미 설정 (알림음·합산·강조 등)
 *  - notifierGroups: 알리미 그룹 정의
 *  - overlay: 오버레이 통합 설정 (시각 옵션, 알리미/배럭 표시 옵션 등)
 *
 * 제외 대상 (사용자별 데이터 — 빌드에 포함되지 않음):
 *  - 배럭 캐릭터/계정
 *  - 파티 그룹/플레이어/세트
 *  - 아르카나 빌드 등
 *
 * 갱신 방법:
 *  - 메인 프로그램 → 💾 통합 저장 → "🛠 현재 설정을 빌드 기본값으로" 클릭
 *  - 다운로드 파일을 `lib/defaults/build-snapshot.json`으로 덮어쓰기
 *  - 빌드 (`빌드.bat`) → 배포 시 신규 설치자에게 적용
 */

import type { DbSettings } from "@/lib/barrack/types";
import type { NotifierItem, NotifierSettings, NotifierGroup } from "@/lib/notifier/types";
import type { OverlayState } from "@/lib/overlay/store";

import rawSnapshot from "./build-snapshot.json";

export type BuildSnapshot = {
  barrackDb?: DbSettings;
  notifierItems?: NotifierItem[];
  notifierSettings?: Partial<NotifierSettings>;
  notifierGroups?: NotifierGroup[];
  overlay?: Partial<OverlayState>;
};

/** 컴파일 타임에 로드되는 스냅샷 — JSON이 비어있으면 빈 객체 */
export const BUILD_SNAPSHOT: BuildSnapshot = (rawSnapshot ?? {}) as BuildSnapshot;

export function hasSnapshot(key: keyof BuildSnapshot): boolean {
  const v = (BUILD_SNAPSHOT as Record<string, unknown>)[key];
  if (v === undefined || v === null) return false;
  if (Array.isArray(v)) return v.length > 0;
  if (typeof v === "object") return Object.keys(v).length > 0;
  return true;
}
