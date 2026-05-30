export type NotifierCycleType = "cooldown" | "specific";

export type SpecificTime = {
  /** -1=매일, -2=매시간, 0..6=요일(일~토) */
  day: number;
  hour: number;
  minute: number;
};

export type NotifierItem = {
  id: string;
  type: string;           // 이벤트 / 어비스 / 천족 / 마족 / 기타
  tier: number;           // 1~5
  name: string;
  area: string;
  cycleType: NotifierCycleType;
  cycleMinutes: number;
  specificTimes: SpecificTime[];
  lastSpawnTs: number | null;
  notifyEnabled: boolean;
  notifyBeforeMin: number;
  important?: boolean;
  /** OCR 화면 동기화 매칭용 이름 — 미설정 시 name 사용 (게임 표기가 다를 때 수정) */
  ocrName?: string;
  /** 사용자설정 표시 모드에서 숨김 (별도 보이기/숨기기 토글) */
  displayHidden?: boolean;
  /** 소속 그룹 ID 목록 (다중 그룹 지원) */
  groups?: string[];
};

/** 그룹 알림 — 그룹 단위로 합쳐서 알림 발송 */
export type NotifierGroup = {
  id: string;
  name: string;
  /** 그룹 알림 ON/OFF */
  enabled: boolean;
  /** 그룹 알림 시간 (분 전) */
  beforeMin: number;
  /** 그룹 내 항목별 개별 알림 ON/OFF (false = 개별 알림 미사용, 그룹 알림만 받음) */
  perItemEnabled?: Record<string, boolean>;
};

/** 표시 레이아웃 */
export type NotifierViewMode = "group" | "all";
/** 표시 항목 필터 */
export type NotifierDisplayFilter = "all" | "alarm" | "custom";

export type NotifierSettings = {
  /** 직전 알림 (모든 알림 항목 N초 전 추가 알림) */
  notifyAtZero: boolean;
  notifyAtZeroSec: number;
  /** 표시 레이아웃: group=구분별, all=한 카드에 3분할 */
  viewMode: NotifierViewMode;
  /** 표시 항목 필터: all=전체, alarm=현재 알람 임계 이내, custom=사용자설정 hidden 제외 */
  displayFilter: NotifierDisplayFilter;
  /** 기본 합산 알림 — 여러 항목의 잔여시간이 N분 이내면 하나의 모달로 합쳐 알림 */
  combineEnabled: boolean;
  combineThresholdMin: number;
  /** 알림음 사용 (오버레이/메인 공통 — 알람 발생 시 비프음 재생) */
  soundEnabled?: boolean;
  /** 알림음 볼륨 0~1 */
  soundVolume?: number;
  /** 알람 카드 강조 지속 시간 (초). 0이면 강조 안 함 */
  alarmHighlightSec?: number;
  /** 알림음 종류 id — ALARM_SOUNDS 등록값 ("beep"=합성, 그 외=파일) */
  alarmSoundId?: string;
};

export type NotifierState = {
  items: NotifierItem[];
  notified: Record<string, true>;
  settings: NotifierSettings;
  itemOrder: string[];
  groupOrder: string[];
  /** 사용자 정의 알림 그룹 */
  groupDefs?: NotifierGroup[];
};
