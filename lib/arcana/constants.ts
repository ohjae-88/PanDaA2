import type { SkillCategory } from "./types";

/** Inven 직업 번호 ↔ 내부 jobId (V4.0.9 동일) */
export const JOB_NUM_TO_ID: Record<number, string> = {
  2: "sword",
  3: "guardian",
  4: "archer",
  5: "assassin",
  6: "spirit",
  7: "mage",
  8: "healer",
  9: "protector",
};
export const ID_TO_JOB_NUM: Record<string, number> = Object.fromEntries(
  Object.entries(JOB_NUM_TO_ID).map(([n, id]) => [id, Number(n)])
);

/** Inven 카테고리 숫자 → 내부 카테고리 문자열 */
export const INVEN_CAT_MAP: Record<number, SkillCategory> = {
  1: "Active",
  2: "Passive",
  3: "Dp",
};

/** 카테고리 순서 + 한글 라벨 */
export const SKILL_CATS: SkillCategory[] = ["Active", "Passive", "Dp"];
export const SKILL_CAT_KO: Record<SkillCategory, string> = {
  Active: "액티브",
  Passive: "패시브",
  Dp: "스티그마",
};

/** 액티브 추가 특화 슬롯 개방 레벨 */
export const ACTIVE_EXTRA_SLOT_LEVELS = [8, 12, 20] as const;

/** 카테고리별 특화 효과 개방 레벨 */
export const SPECIAL_EFFECT_LEVELS: Partial<Record<SkillCategory, number[]>> = {
  Active: [8, 12, 16],
  Dp: [5, 10, 15, 20],
  // Passive: 없음
};

/** 시드 기본 레벨 정책 — 카테고리별 base + daevanion */
export const SKILL_BASELV_SEED: Record<SkillCategory, { base: number; daevanion: number }> = {
  Active: { base: 10, daevanion: 4 },
  Passive: { base: 0, daevanion: 4 },
  Dp: { base: 0, daevanion: 0 },
};

/** Inven 아이콘 베이스 URL */
export const ICON_BASE =
  "https://assets.playnccdn.com/static-aion2-gamedata/resources/";

/** localStorage 키 — V4.0.9 동일 prefix */
export const LS_SKILL_DB = "a2-card-skill-db";
export const LS_ARCANA_DB = "a2-card-arcana-db";
export const LS_SET_DB = "a2-card-set-db";
export const LS_CHARS = "a2-card-chars";
export const LS_BUILDS = "a2-card-builds-v2";
export const LS_OWNED = "a2-card-owned";
export const LS_UI_STATE = "a2-card-ui-state";

/** 장비 종류 (V4.0.9 EQUIP_KINDS) */
export const EQUIP_KINDS = [
  { code: "weapon",   name: "무기",   emoji: "⚔️", cats: ["Active", "Passive"] },
  { code: "shield",   name: "가더",   emoji: "🛡",  cats: ["Active", "Passive"] },
  { code: "helmet",   name: "투구",   emoji: "⛑",  cats: ["Passive"] },
  { code: "shoulder", name: "어깨",   emoji: "🎽", cats: ["Passive"] },
  { code: "torso",    name: "상의",   emoji: "👕", cats: ["Passive"] },
  { code: "pants",    name: "바지",   emoji: "👖", cats: ["Passive"] },
  { code: "gloves",   name: "장갑",   emoji: "🧤", cats: ["Passive"] },
  { code: "cape",     name: "망토",   emoji: "🧣", cats: ["Passive"] },
  { code: "boots",    name: "장화",   emoji: "🥾", cats: ["Passive"] },
  { code: "earring",  name: "귀걸이", emoji: "🦻", cats: ["Passive"] },
  { code: "necklace", name: "목걸이", emoji: "📿", cats: ["Passive"] },
  { code: "ring",     name: "반지",   emoji: "💍", cats: ["Active"] },
  { code: "legacy",   name: "기타",   emoji: "🧰", cats: ["Active", "Passive"], hidden: true },
] as const;
export const EQUIP_KIND_BY_CODE: Record<string, { code: string; name: string; emoji: string; cats: readonly string[]; hidden?: boolean }> =
  Object.fromEntries(EQUIP_KINDS.map((k) => [k.code, k]));

/** 기본 장비 슬롯 — 14개 자동 생성 */
export const DEFAULT_EQUIP_SLOTS: { kind: string; index?: number }[] = [
  { kind: "weapon" },
  { kind: "shield" },
  { kind: "helmet" },
  { kind: "shoulder" },
  { kind: "torso" },
  { kind: "pants" },
  { kind: "gloves" },
  { kind: "cape" },
  { kind: "boots" },
  { kind: "earring", index: 1 },
  { kind: "earring", index: 2 },
  { kind: "necklace" },
  { kind: "ring", index: 1 },
  { kind: "ring", index: 2 },
];

export const EQUIP_INDEX_MARK: Record<number, string> = {
  1: "①", 2: "②", 3: "③", 4: "④", 5: "⑤", 6: "⑥", 7: "⑦", 8: "⑧", 9: "⑨", 10: "⑩",
};

export function equipSlotLabel(es: { kind: string; index?: number }): string {
  const k = EQUIP_KIND_BY_CODE[es.kind] || { name: es.kind, code: es.kind, emoji: "", cats: [] };
  if (k.code === "legacy") return "기타 (이전 데이터)";
  if (!es.index) return k.name;
  return k.name + (EQUIP_INDEX_MARK[es.index] || ` (${es.index})`);
}

/** 6슬롯 정의 (V4.0.9 동일) */
export const SLOTS = [
  { code: "Grail",     name: "성배",   emoji: "🍷" },
  { code: "Parchment", name: "양피지", emoji: "📜" },
  { code: "Compass",   name: "나침반", emoji: "🧭" },
  { code: "Bell",      name: "종",     emoji: "🔔" },
  { code: "Mirror",    name: "거울",   emoji: "🪞" },
  { code: "Libra",     name: "천칭",   emoji: "⚖️" },
] as const;
export const ARCANA_ORDER = SLOTS.map((s) => s.code);
export const ARCANA_KO: Record<string, string> = Object.fromEntries(
  SLOTS.map((s) => [s.code, s.name])
);
export const ARCANA_EMOJI: Record<string, string> = Object.fromEntries(
  SLOTS.map((s) => [s.code, s.emoji])
);

/** 5등급 (V4.0.9 동일 — 등급 코드 미확정 시 임시) */
export const GRADES_TBL = [
  { code: "l", name: "전승" },
  { code: "e", name: "영웅" },
  { code: "u", name: "유일" },
  { code: "r", name: "고급" },
  { code: "n", name: "일반" },
] as const;
export const GRADES = GRADES_TBL.map((g) => g.code);
export const GRADE_KO: Record<string, string> = Object.fromEntries(
  GRADES_TBL.map((g) => [g.code, g.name])
);
export const DEFAULT_GRADE = "u";

/** 7세트 — 최근 시즌(S3) 부터 상단 */
export const SETS = [
  { code: "PveSet1",     name: "징벌", season: "S3" },
  { code: "PvpSet1",     name: "불굴", season: "S3" },
  { code: "CureSet1",    name: "수호", season: "S3" },
  { code: "DefenceSet1", name: "순수", season: "S2" },
  { code: "OffenseSet2", name: "광분", season: "S2" },
  { code: "PveSet2",     name: "활력", season: "S1" },
  { code: "DefenceSet2", name: "마력", season: "S1" },
] as const;
export const SET_BY_CODE: Record<string, { code: string; name: string; season: string }> =
  Object.fromEntries(SETS.map((s) => [s.code, s]));
export const SET_ORDER = new Map<string, number>(SETS.map((s, i) => [s.code, i]));

/** 카드 이미지 URL 패턴 — Icon_Arcana_Card_{Slot}_{Grade}_{Set}.png */
export const ARCANA_ICON_BASE =
  "https://assets.playnccdn.com/static-aion2-gamedata/resources/Icon_Arcana_Card_";
export function arcanaIconUrl(slot: string, grade: string, set: string): string {
  return `${ARCANA_ICON_BASE}${slot}_${grade}_${set}.png`;
}

/** 세트별 레벨업 정책 (V4.0.9 SET_LEVELUP_POLICY) */
export const SET_LEVELUP_POLICY: Record<string, { skillPoint: number; statPoint: number }> = {
  PveSet2:     { skillPoint: 1, statPoint: 0 },
  DefenceSet2: { skillPoint: 1, statPoint: 0 },
  OffenseSet2: { skillPoint: 1, statPoint: 0 },
  DefenceSet1: { skillPoint: 1, statPoint: 0 },
  PveSet1:     { skillPoint: 1, statPoint: 5 },
  PvpSet1:     { skillPoint: 1, statPoint: 5 },
  CureSet1:    { skillPoint: 1, statPoint: 5 },
};

/** 세트×슬롯 → 기본 스텟 키 (V4.0.9 ARCANA_BASE_STAT_KEYS) */
export const ARCANA_BASE_STAT_KEYS: Record<string, Record<string, string[]>> = {
  PveSet2:     { Grail:["time"],  Parchment:["life"], Compass:["freedom"], Bell:["justice"],     Mirror:["illusion"], Libra:[] },
  DefenceSet2: { Grail:["space"], Parchment:["fate"], Compass:["death"],   Bell:["destruction"], Mirror:["wisdom"],   Libra:[] },
  OffenseSet2: { Grail:["time"],  Parchment:["life"], Compass:["freedom"], Bell:["justice"],     Mirror:["illusion"], Libra:["justice","life"] },
  DefenceSet1: { Grail:["space"], Parchment:["fate"], Compass:["death"],   Bell:["destruction"], Mirror:["wisdom"],   Libra:["destruction","fate"] },
  PveSet1:     { Grail:["space"], Parchment:["fate"], Compass:["death"],   Bell:["destruction"], Mirror:["wisdom"],   Libra:["destruction","fate"] },
  PvpSet1:     { Grail:["time"],  Parchment:["fate"], Compass:["freedom"], Bell:["justice"],     Mirror:["wisdom"],   Libra:["destruction","life"] },
  CureSet1:    { Grail:["time"],  Parchment:["life"], Compass:["freedom"], Bell:["justice"],     Mirror:["illusion"], Libra:["justice","life"] },
};
export const BASE_STAT_VALUE = 20;
/** 카드 10종 기본 스텟 키 */
export const ARCANA_STAT_KEYS = [
  "time", "life", "freedom", "justice", "illusion",
  "space", "fate", "death", "destruction", "wisdom",
] as const;
export const CARD_MAX_LV = 5;
export const CARD_SKILL_SLOTS = 4;

/** STAT_LABEL — 스텟 키 → 한글 라벨 (V4.0.9 동일) */
export const STAT_LABEL: Record<string, string> = {
  atk: "공격력", def: "방어력", hp: "HP", mp: "MP",
  crit: "치명타(%)", critDmg: "치명타 피해(%)", critRes: "치명 저항",
  heal: "치유량", acc: "명중", dodge: "회피", pen: "관통", tough: "강인함",
  pAtk: "물리 공격력", mAtk: "마법 공격력", pDef: "물리 방어력", mDef: "마법 방어력",
  pveAtk: "PVE 공격력", pveDef: "PVE 방어력",
  pvpAtk: "PVP 공격력", pvpDef: "PVP 방어력",
  pveDmgInc: "PVE 피해 증폭(%)", pveDmgRes: "PVE 피해 내성(%)",
  pvpDmgInc: "PVP 피해 증폭(%)", pvpDmgRes: "PVP 피해 내성(%)",
  bossDmgInc: "보스 피해 증폭(%)", bossDmgRes: "보스 피해 내성(%)",
  critDmgInc: "치명타 피해 증폭(%)", critDmgRes: "치명타 피해 내성(%)",
  weaponDmgInc: "무기 피해 증폭(%)", weaponDmgRes: "무기 피해 내성(%)",
  regen: "재생(%)",
  time: "시간", life: "생명", freedom: "자유", justice: "정의", illusion: "환상",
  space: "공간", fate: "운명", death: "죽음", destruction: "파괴", wisdom: "지혜",
};

/** 세트 효과 시드 (V4.0.9 SET_EFFECT_DATA) */
export const SET_EFFECT_DATA: Record<string, Record<number, Array<{
  text: string;
  stats?: Record<string, number>;
  cond?: string;
  cooldownSec?: number;
}>>> = {
  PveSet2: {
    2: [{ text: "생명력 70% 이상일 때 PVE 공격력 60 증가", cond: "생명력 70% 이상", stats: { pveAtk: 60 } }],
    4: [{ text: "생명력 70% 이상일 때 PVE 공격력 150 증가", cond: "생명력 70% 이상", stats: { pveAtk: 150 } }],
  },
  DefenceSet2: {
    2: [{ text: "정신력 20% 이하일 때 정신력 1500 회복 (재발동 30초)", cond: "정신력 20% 이하", cooldownSec: 30 }],
    4: [{ text: "정신력 50% 이상일 때 PVE 방어력 1000 증가", cond: "정신력 50% 이상", stats: { pveDef: 1000 } }],
  },
  DefenceSet1: {
    2: [{ text: "PVE 방어력 500 증가", stats: { pveDef: 500 } }],
    4: [
      { text: "치명타 피해 증폭 5% 증가", stats: { critDmgInc: 5 } },
      { text: "생명력 70% 이하일 때 방어력 1000 증가", cond: "생명력 70% 이하", stats: { def: 1000 } },
    ],
  },
  OffenseSet2: {
    2: [{ text: "PVE 공격력 50 증가", stats: { pveAtk: 50 } }],
    4: [
      { text: "보스 피해 증폭 5% 증가", stats: { bossDmgInc: 5 } },
      { text: "생명력 70% 이하일 때 보스 피해 내성 10% 증가", cond: "생명력 70% 이하", stats: { bossDmgRes: 10 } },
    ],
  },
  PveSet1: {
    2: [{ text: "보스 피해 내성 5% 증가", stats: { bossDmgRes: 5 } }],
    4: [
      { text: "PVE 공격력 60 증가", stats: { pveAtk: 60 } },
      { text: "생명력 70% 이상일 때 PVE 피해 증폭 10% 증가", cond: "생명력 70% 이상", stats: { pveDmgInc: 10 } },
    ],
  },
  PvpSet1: {
    2: [{ text: "무기 피해 내성 5% 증가", stats: { weaponDmgRes: 5 } }],
    4: [
      { text: "치명타 피해 내성 5% 증가", stats: { critDmgRes: 5 } },
      {
        text: "기절/넘어짐/공중속박/잡기/빙결/공포 피격 시 5초간 PVP 피해 내성 50% 증가 (재발동 2분 30초)",
        cond: "CC 피격 시",
        cooldownSec: 150,
      },
    ],
  },
  CureSet1: {
    2: [{ text: "재생 5% 증가", stats: { regen: 5 } }],
    4: [
      { text: "무기 피해 증폭 5% 증가", stats: { weaponDmgInc: 5 } },
      {
        text: "생명력 30% 이하일 때 5초간 10,000 피해 흡수 보호막 (재발동 2분)",
        cond: "생명력 30% 이하",
        cooldownSec: 120,
      },
    ],
  },
};
