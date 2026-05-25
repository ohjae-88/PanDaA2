import type { NotifierItem } from "./types";

type SeedEntry = Omit<NotifierItem, "id" | "lastSpawnTs" | "notifyEnabled" | "notifyBeforeMin" | "specificTimes"> & {
  specificTimes?: NotifierItem["specificTimes"];
};

/** 260520_보스젠.CSV 기반 시드 (31개) */
export const NOTIFIER_SEED: SeedEntry[] = [
  { type: "이벤트", tier: 1, name: "슈고",            area: "-",                              cycleType: "cooldown", cycleMinutes: 60 },
  { type: "어비스", tier: 1, name: "아티팩트",        area: "에레슈란타 하층(랜덤)",          cycleType: "specific", cycleMinutes: 60 },
  { type: "어비스", tier: 1, name: "감시자 카이라",   area: "에레슈란타 하층(랜덤)",          cycleType: "cooldown", cycleMinutes: 60 },
  { type: "어비스", tier: 1, name: "집행자 아그로,타마사,카이라", area: "에레슈란타 하층(뿌리,유황,군도)", cycleType: "specific", cycleMinutes: 60 },
  { type: "어비스", tier: 1, name: "마라카, 드라모스, 듀칼",     area: "에레슈란타 중층(강철,중앙,파편)", cycleType: "specific", cycleMinutes: 60 },
  { type: "어비스", tier: 1, name: "정령왕 아그로",   area: "씨엘의 날개 군도(우측)",          cycleType: "specific", cycleMinutes: 60 },
  { type: "어비스", tier: 1, name: "수호신장 나흐마", area: "에레슈란타의 뿌리(토,일)",        cycleType: "specific", cycleMinutes: 60 },
  { type: "천족",   tier: 5, name: "서쪽의 케르논",   area: "칸타스 계곡",     cycleType: "cooldown", cycleMinutes: 30 },
  { type: "천족",   tier: 5, name: "동쪽의 네이켈",   area: "칸타스 계곡",     cycleType: "cooldown", cycleMinutes: 30 },
  { type: "천족",   tier: 5, name: "썩은 쿠타르",     area: "엘룬강 늪지",     cycleType: "cooldown", cycleMinutes: 30 },
  { type: "천족",   tier: 5, name: "만개한 코린",     area: "엘룬강 중류",     cycleType: "cooldown", cycleMinutes: 60 },
  { type: "천족",   tier: 5, name: "호위병 티간트",   area: "요새 폐허",       cycleType: "cooldown", cycleMinutes: 90 },
  { type: "천족",   tier: 4, name: "광투사 쿠산",     area: "요새 폐허",       cycleType: "cooldown", cycleMinutes: 120 },
  { type: "천족",   tier: 4, name: "제사장 가르심",   area: "요새 폐허",       cycleType: "cooldown", cycleMinutes: 120 },
  { type: "천족",   tier: 4, name: "피송곳니 프닌",   area: "톨바스 숲",       cycleType: "cooldown", cycleMinutes: 180 },
  { type: "천족",   tier: 4, name: "본노한 사루스",   area: "톨바스 숲",       cycleType: "cooldown", cycleMinutes: 180 },
  { type: "천족",   tier: 4, name: "학자 라울라",     area: "아울라우 부락",   cycleType: "cooldown", cycleMinutes: 120 },
  { type: "천족",   tier: 4, name: "추격자 타울로",   area: "아울라우 부락",   cycleType: "cooldown", cycleMinutes: 120 },
  { type: "천족",   tier: 2, name: "숲전사 우라무",   area: "아울라우 부락",   cycleType: "cooldown", cycleMinutes: 240 },
  { type: "천족",   tier: 4, name: "배교자 레일라",   area: "아르타미아 고원", cycleType: "cooldown", cycleMinutes: 180 },
  { type: "천족",   tier: 2, name: "검은 촉수 라와",  area: "아르타미아 고원", cycleType: "cooldown", cycleMinutes: 240 },
  { type: "천족",   tier: 2, name: "백부장 데미로스", area: "아르타미아 고원", cycleType: "cooldown", cycleMinutes: 240 },
  { type: "천족",   tier: 2, name: "신성한 안사스",   area: "아르타미아 고원", cycleType: "cooldown", cycleMinutes: 360 },
  { type: "천족",   tier: 4, name: "수확관리자 모샤브", area: "드라나 재배지", cycleType: "cooldown", cycleMinutes: 180 },
  { type: "천족",   tier: 2, name: "감시병기 크나쉬", area: "드라나 재배지",   cycleType: "cooldown", cycleMinutes: 240 },
  { type: "천족",   tier: 2, name: "연구관 세트람",   area: "니하드 군단 요새", cycleType: "cooldown", cycleMinutes: 360 },
  { type: "천족",   tier: 2, name: "환몽의 카시아",   area: "환영신의 정원",   cycleType: "cooldown", cycleMinutes: 360 },
  { type: "천족",   tier: 3, name: "침묵의 타르탄",   area: "아르타미아 고원 남부", cycleType: "cooldown", cycleMinutes: 360 },
  { type: "천족",   tier: 3, name: "영혼 지배자 카샤파", area: "아르타미아 고원 동부", cycleType: "cooldown", cycleMinutes: 360 },
  { type: "천족",   tier: 3, name: "군단장 라그타",   area: "붉은 숲",         cycleType: "cooldown", cycleMinutes: 720 },
  { type: "천족",   tier: 1, name: "영원의 가르투아", area: "영원의 섬",       cycleType: "cooldown", cycleMinutes: 720 },
];

let _seedCounter = 0;
export function buildSeedItems(): NotifierItem[] {
  return NOTIFIER_SEED.map(s => ({
    id: `n_seed_${++_seedCounter}_${Math.random().toString(36).slice(2, 8)}`,
    type: s.type,
    tier: s.tier,
    name: s.name,
    area: s.area,
    cycleType: s.cycleType,
    cycleMinutes: s.cycleMinutes,
    specificTimes: s.specificTimes ?? [],
    lastSpawnTs: null,
    notifyEnabled: false,
    notifyBeforeMin: 5,
  }));
}
