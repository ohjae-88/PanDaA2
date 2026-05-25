export type UnifiedPayload = {
  _kind: "a2-unified";
  _version: number;
  exportedAt: string;
  [areaKey: string]: unknown;
};

/** 카테고리 — 통합 저장/불러오기 UI 그룹화 */
export type UnifiedCategory = "user" | "db" | "overlay";

export type UnifiedArea = {
  key: string;
  label: string;
  desc: string;
  /** 카테고리: user(사용자 데이터) / db(DB 데이터) / overlay(오버레이 설정) */
  category: UnifiedCategory;
  /** Domain implemented in this build? (gates export & marks import target) */
  available: () => boolean;
  /** Returns serializable section (null = not available) */
  getSection: () => Record<string, unknown> | null;
  /** Apply section data into the store */
  applySection: (data: Record<string, unknown>) => void;
};

export const UNIFIED_CATEGORY_LABELS: Record<UnifiedCategory, string> = {
  user: "👤 사용자 데이터",
  db: "📚 DB 데이터",
  overlay: "🪟 오버레이 설정",
};
