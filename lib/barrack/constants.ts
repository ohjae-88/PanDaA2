import type { DbSettings } from "./types";

export const CLASSES = [
  { id: "guardian",  name: "수호성", icon: "🛡️", color: "#4a90d9" },
  { id: "sword",     name: "검성",   icon: "🗡️", color: "#30bfbf" },
  { id: "healer",    name: "치유성", icon: "💗", color: "#e8609a" },
  { id: "protector", name: "호법성", icon: "💪", color: "#3dbf6e" },
  { id: "archer",    name: "궁성",   icon: "🏹", color: "#d4b800" },
  { id: "mage",      name: "마도성", icon: "🔥", color: "#e8711a" },
  { id: "assassin",  name: "살성",   icon: "🔪", color: "#d94040" },
  { id: "spirit",    name: "정령성", icon: "🏵️", color: "#9b50e0" },
] as const;

export const RAID_TYPES = ["expedition", "transcend", "sanctuary_ludra", "sanctuary_bagot"] as const;

export const RAID_LABELS: Record<string, { name: string; icon: string }> = {
  expedition:      { name: "원정",         icon: "🗺" },
  transcend:       { name: "초월",         icon: "⚡" },
  sanctuary_ludra: { name: "성역(루드라)", icon: "🌟" },
  sanctuary_bagot: { name: "성역(바고트)", icon: "🌙" },
};

export const CONTENTS = [
  { id: "expedition",      name: "원정",         icon: "🗺",  raidType: true  as const },
  { id: "transcend",       name: "초월",         icon: "⚡",  raidType: true  as const },
  { id: "sanctuary_ludra", name: "성역(루드라)", icon: "🌟",  raidType: true  as const },
  { id: "sanctuary_bagot", name: "성역(바고트)", icon: "🌙",  raidType: true  as const },
  { id: "mission",         name: "사명",         icon: "📋",  serverAggType: true as const },
  { id: "shop",            name: "오드",         icon: "💎",  shopType: true as const },
  { id: "corridor",        name: "회랑",         icon: "🏛",  corridorType: true as const },
  { id: "nightmare",       name: "악몽",         icon: "👁",  ticketType: true as const },
  { id: "awakening",       name: "각성전",       icon: "💫",  ticketType: true as const },
];

export const OD_CHARGE_HOURS      = [2, 5, 8, 11, 14, 17, 20, 23];
export const OD_CHARGE_AMOUNT     = 15;
export const EXP_REWARD_HOURS     = [5, 13, 21];
export const TRA_REWARD_HOURS     = [5, 17];
export const NIGHTMARE_CHARGE_HOURS  = [5];
export const NIGHTMARE_CHARGE_AMOUNT = 2;
export const SHUGO_CHARGE_HOURS   = [5];
export const SHUGO_CHARGE_AMOUNT  = 2;

export const DB_DEFAULTS: DbSettings = {
  odMaxSub:        840,
  odMaxUnsub:      420,
  od:              { chargeHours: [2,5,8,11,14,17,20,23], chargeAmount: 15 },
  dungeon:         { weeklyMax: 14, cycle: "weekly" },
  expedition:      { rewardMax: 21, bossMax: 35, odSub: 80, odUnsub: 40, rewardChargeAmount: 1, chargeHours: [5,13,21] },
  transcend:       { rewardMax: 14, bossMax: 28, odSub: 80, odUnsub: 40, rewardChargeAmount: 1, chargeHours: [5,17] },
  sanctuary_ludra: { rewardMax: 2,  bossMax: 4,  odSub: 80, odUnsub: 40 },
  sanctuary_bagot: { rewardMax: 2,  bossMax: 4,  odSub: 80, odUnsub: 40 },
  awakening:       { weeklyTickets: 3, cycle: "weekly" },
  nightmare:       { dailyGain: 2, maxTickets: 14, cycle: "daily" },
  mission:         { dailyMax: 5, cycle: "daily" },
  shopOd:          { max: 16, resetVal: 0, cycle: "weekly" },
  shopOdConvert:   { max: 16, resetVal: 0, cycle: "weekly" },
  shopBox:         { max: 7,  resetVal: 0, cycle: "weekly" },
  charConvert:     { max: 4,  resetVal: 0, cycle: "weekly" },
  charBuy:         { max: 4,  resetVal: 0, cycle: "weekly" },
  kinaRates: {
    expedition: { tiers: [{rate:100,threshold:84},{rate:80,threshold:105},{rate:60,threshold:126},{rate:40,threshold:147}], fallbackRate: 20 },
    transcend:  { tiers: [{rate:100,threshold:56},{rate:80,threshold:70}, {rate:60,threshold:84}, {rate:40,threshold:98}],  fallbackRate: 20 },
  },
  serverList: [
    { race:"천족", name:"시엘",         id:"1001" }, { race:"천족", name:"네자칸",      id:"1002" },
    { race:"천족", name:"바이젤",       id:"1003" }, { race:"천족", name:"카이시넬",    id:"1004" },
    { race:"천족", name:"유스티엘",     id:"1005" }, { race:"천족", name:"아리엘",      id:"1006" },
    { race:"천족", name:"프레기온",     id:"1007" }, { race:"천족", name:"메스람타에다", id:"1008" },
    { race:"천족", name:"히타니에",     id:"1009" }, { race:"천족", name:"나니아",      id:"1010" },
    { race:"천족", name:"타하바타",     id:"1011" }, { race:"천족", name:"루터스",      id:"1012" },
    { race:"천족", name:"페르노스",     id:"1013" }, { race:"천족", name:"다미누",      id:"1014" },
    { race:"천족", name:"카사카",       id:"1015" }, { race:"천족", name:"바카르마",    id:"1016" },
    { race:"천족", name:"첸가룽",       id:"1017" }, { race:"천족", name:"코치룽",      id:"1018" },
    { race:"천족", name:"이슈타르",     id:"1019" }, { race:"천족", name:"티아마트",    id:"1020" },
    { race:"천족", name:"포에타",       id:"1021" },
    { race:"마족", name:"이스라펠",     id:"2001" }, { race:"마족", name:"지켈",        id:"2002" },
    { race:"마족", name:"트리니엘",     id:"2003" }, { race:"마족", name:"루미엘",      id:"2004" },
    { race:"마족", name:"마르쿠탄",     id:"2005" }, { race:"마족", name:"아스펠",      id:"2006" },
    { race:"마족", name:"에레슈키칼",   id:"2007" }, { race:"마족", name:"브리트라",    id:"2008" },
    { race:"마족", name:"네몬",         id:"2009" }, { race:"마족", name:"하달",        id:"2010" },
    { race:"마족", name:"루드라",       id:"2011" }, { race:"마족", name:"울고른",      id:"2012" },
    { race:"마족", name:"무닌",         id:"2013" }, { race:"마족", name:"오다르",      id:"2014" },
    { race:"마족", name:"젠카카",       id:"2015" }, { race:"마족", name:"크로메데",    id:"2016" },
    { race:"마족", name:"콰이링",       id:"2017" }, { race:"마족", name:"바바룽",      id:"2018" },
    { race:"마족", name:"파프니르",     id:"2019" }, { race:"마족", name:"인드나흐",    id:"2020" },
    { race:"마족", name:"이스할겐",     id:"2021" },
  ],
};
