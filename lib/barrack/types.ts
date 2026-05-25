export type ClassId =
  | "guardian" | "sword" | "healer" | "protector"
  | "archer" | "mage" | "assassin" | "spirit";

export type Race = "천족" | "마족";

export type RaidType = "expedition" | "transcend" | "sanctuary_ludra" | "sanctuary_bagot";

/** 캐릭터 콘텐츠 변경 로그 — doRaid 호출 시 누적.
 *  - target: "both"=1회 (보상+보스 동시), "reward"=보상만, "boss"=보스/입장권만
 *  - delta: -1(사용/처치) / +1(환급) */
export type ContentChangeLog = {
  raidKey: RaidType;
  target: "reward" | "boss" | "both";
  delta: number;
  ts: number;
};

export type RaidState = {
  rewardBase: number;
  reward: number;
  rewardExtra: number;
  bossBase: number;
  boss: number;
  bossExtra: number;
  odConsumed: number;
};

export type ServerData = {
  dungeon: { base: number; extra: number };
  shugoTickets: number;
  invasionTickets: number;
  shugoLastChargeTs?: number | null;
  weeklyResetDate?: string;
  dungeonDailyDate?: string;
  expRewardTotal?: number;
  traRewardTotal?: number;
  shopOdBuy?: number;
  shopOdConvert?: number;
  shopBox?: number;
  missionDone?: number;
  kina?: number;
  kinaExcluded?: boolean;
};

export type Account = {
  id: string;
  name: string;
  subscribed?: boolean;
  servers: Record<string, ServerData>;
};

export type Character = {
  id: string;
  accountId: string;
  name: string;
  level: number;
  race: Race | string;
  classId: ClassId | string;
  className?: string;
  classIcon?: string;
  server: string;
  cp?: number;
  itemLevel?: number;
  od: number;
  odMax: number;
  odExtra: number;
  passes: string[];
  memo?: string;
  expedition: RaidState;
  transcend: RaidState;
  sanctuary_ludra: RaidState;
  sanctuary_bagot: RaidState;
  awakening: { tickets: number; ticketsExtra: number };
  nightmare: { tickets: number; ticketsExtra: number };
  mission: { done: number };
  shop: { convert: number; buy: number };
  corridor: { lower: number; lowerMax: number; middle: number; middleMax: number };
  hidden: boolean;
  hiddenContents?: Record<string, boolean>;
  /** 최근 콘텐츠 변경 로그 — newest first. max 50개 cap (오래된 것 자동 제거). */
  contentChangeLog?: ContentChangeLog[];
  weeklyResetDate?: string;
  dailyResetDate?: string;
  createdAt?: number;
  // 자동 충전 타임스탬프
  odLastChargeTs?: number | null;
  expRewardLastChargeTs?: number | null;
  traRewardLastChargeTs?: number | null;
  nightmareLastChargeTs?: number | null;
  // raid alias compat
  cid?: string;
  characterId?: string;
};

export type DbSettings = {
  /** 오드 한도 — 계정 구독 여부에 따라 적용 */
  odMaxSub?: number;
  odMaxUnsub?: number;
  od: { chargeHours: number[]; chargeAmount: number };
  dungeon: { weeklyMax: number; cycle: "weekly" | "daily" };
  expedition: { rewardMax: number; bossMax: number; odSub: number; odUnsub: number; rewardChargeAmount: number; chargeHours: number[] };
  transcend:  { rewardMax: number; bossMax: number; odSub: number; odUnsub: number; rewardChargeAmount: number; chargeHours: number[] };
  sanctuary_ludra: { rewardMax: number; bossMax: number; odSub: number; odUnsub: number };
  sanctuary_bagot: { rewardMax: number; bossMax: number; odSub: number; odUnsub: number };
  awakening: { weeklyTickets: number; cycle: "weekly" | "daily" };
  nightmare: { dailyGain: number; maxTickets: number; cycle: "daily" | "weekly" };
  mission:   { dailyMax: number; cycle: "daily" | "weekly" };
  shopOd:    { max: number; resetVal: number; cycle: "weekly" | "daily" };
  shopOdConvert: { max: number; resetVal: number; cycle: "weekly" | "daily" };
  shopBox:   { max: number; resetVal: number; cycle: "weekly" | "daily" };
  charConvert: { max: number; resetVal: number; cycle: "weekly" | "daily" };
  charBuy:     { max: number; resetVal: number; cycle: "weekly" | "daily" };
  kinaRates: {
    expedition: { tiers: { rate: number; threshold: number }[]; fallbackRate: number };
    transcend:  { tiers: { rate: number; threshold: number }[]; fallbackRate: number };
  };
  serverList: { race: string; name: string; id: string }[];
};
