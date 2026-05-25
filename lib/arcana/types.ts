/** 아르카나 도메인 타입 — V4.0.9 호환 모델.
 *  스킬 DB / 아르카나 DB / 카드 빌드 공용 타입. */

import type { ClassId } from "@/lib/barrack/types";

/** 스킬 카테고리 */
export type SkillCategory = "Active" | "Passive" | "Dp";

/** 스킬 시드 베이스 레벨 — 카테고리별 자동 적용 (액티브 base 10 + 데바니온 4 등) */
export type SkillBaseLv = {
  base: number;
  daevanion: number;
};

/** 단일 스킬 마스터 */
export type Skill = {
  /** 내부 id (`sk_{skillId}` 형식) */
  id: string;
  /** Inven 사이트 skill id (정수) */
  skillId: number;
  name: string;
  category: SkillCategory;
  /** 절대 URL 또는 빈 문자열 */
  icon: string;
  /** 영문 jobId — V4 'jobId'와 'job'(한글) 모두 보유. 신규 스키마는 jobId 우선. */
  jobId: ClassId | string;
  /** 한글 직업명 — V4 호환 */
  job?: string;
  /** 시드 기본 레벨 — 카테고리별 자동 */
  baseLv?: SkillBaseLv;
  /** 데바니온 보유 여부 (UI 토글) — 미지정 시 baseLv.daevanion>0 으로 간주 */
  daevanion?: boolean;
  /** 카테고리별 특화 효과 — Active:[8,12,16], Dp:[5,10,15,20] 레벨별 텍스트 */
  specialEffects?: SpecialEffect[];
};

/** 스킬 특화 효과 — 레벨별 텍스트 */
export type SpecialEffect = {
  level: number;
  text: string;
};

/** 아르카나 카드 슬롯 */
export type ArcanaSlot = "Grail" | "Parchment" | "Compass" | "Bell" | "Mirror" | "Libra";

/** 카드 등급 코드 */
export type ArcanaGrade = "l" | "e" | "u" | "r" | "n";

/** 세트 코드 */
export type SetCode =
  | "PveSet1" | "PvpSet1" | "CureSet1"
  | "DefenceSet1" | "OffenseSet2"
  | "PveSet2" | "DefenceSet2";

/** 카드 레벨업 정책 — 1레벨업당 추가 포인트 */
export type LevelUpPolicy = {
  skillPoint: number;
  statPoint: number;
};

/** 카드별 직업 → skill id 배열 (적용 스킬 슬롯) */
export type SkillsByJob = Record<string, string[]>;

/** 단일 아르카나 카드 마스터 */
export type ArcanaCard = {
  id: string;
  slot: ArcanaSlot | string;
  setKey: SetCode | string;
  grade: ArcanaGrade | string;
  season: string;
  name: string;
  icon: string;
  /** 기본 스텟 — `STAT_LABEL`의 키 → 값 */
  stats: Record<string, number>;
  /** 직업별 적용 스킬 (CARD_SKILL_SLOTS=4 한도 권장) */
  skillsByJob: SkillsByJob;
  levelUp: LevelUpPolicy;
  maxLv: number;
};

/** 세트 효과 */
export type SetEffect = {
  text: string;
  stats?: Record<string, number>;
  cond?: string;
  cooldownSec?: number;
};

export type SetTier = {
  n: number;
  effects: SetEffect[];
};

export type ArcanaSetMaster = {
  id: string;
  name: string;
  season: string;
  match: { setKey: string };
  tiers: SetTier[];
};

/** 아르카나 빌드용 캐릭터 (배럭과 별도) */
export type ArcanaCharacter = {
  id: string;
  name: string;
  jobId: string;
  createdAt: number;
};

/** 빌드의 단일 슬롯 — 보유카드 참조(ownedCardId) 또는 임의 분배(masterId+gains) */
export type SlotEntry = {
  /** ownedCards에서 가져온 카드 id (선호) */
  ownedCardId?: string | null;
  /** 임의 모드: 카드 마스터 직접 참조 + 빌드 내부 분배 */
  masterId?: string | null;
  level?: number;
  gains?: {
    stats?: Record<string, number>;
    /** 카드의 스킬 슬롯에 분배된 포인트 — skillId → 점수 */
    skills?: Record<string, number>;
  };
  /** 카드별 활성화한 스킬 ID 배열 (V4 동등). 카드의 skillsByJob[jobId]의 부분집합. */
  enabledSkills?: string[];
  /** 활성화 토글된 cond 효과 키 */
  activeCondEffects?: string[];
};

/** 장비 슬롯 인스턴스 */
export type EquipSlotInstance = {
  /** 사용자 정의 id (uid) */
  id: string;
  /** EQUIP_KINDS의 code (weapon/shield/...) */
  kind: string;
  /** 동일 kind가 여러 개일 때 인덱스 (예: 귀걸이 1/2) */
  index?: number;
  /** 부여된 스킬 — skillId → 점수 */
  skills?: Record<string, number>;
};

/** 빌드 */
export type ArcanaBuild = {
  id: string;
  charId: string;
  name: string;
  /** 6슬롯 (Grail..Libra) → SlotEntry */
  slots: Record<string, SlotEntry>;
  /** 장비 슬롯 14+ */
  equipSlots: EquipSlotInstance[];
  /** 빌드 헤더 — 아르카나 참고표 펼침 여부 + 셀 선택 */
  arcanaRefOpen?: boolean;
  arcanaRefSelected?: Record<string, boolean>;
  /** 활성화 토글된 세트 cond 효과 */
  activeSetCondEffects?: string[];
  createdAt: number;
};

/** 보유/계획 카드 — masterId 참조 + 사용자 분배 (stats/skills) */
export type OwnedCard = {
  id: string;
  /** ArcanaCard.id */
  masterId: string;
  /** 0(미보유=계획) / 1~maxLv */
  level: number;
  /** 사용자가 캐릭터에 묶음 (캐릭터 단위 풀) */
  charId?: string | null;
  gains: {
    stats?: Record<string, number>;
    skills?: Record<string, number>;
  };
  /** 카드별 활성화한 스킬 ID 배열 (V4 동등). 옵션 활성 상태 영속. */
  enabledSkills?: string[];
  note?: string;
};
