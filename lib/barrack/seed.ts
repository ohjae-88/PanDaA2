import type { Account, Character } from "./types";
import { weekStr, todayStr, getLastChargeTs } from "./time";
import { OD_CHARGE_HOURS, EXP_REWARD_HOURS, TRA_REWARD_HOURS } from "./constants";

/** 최초 실행 시 기본 계정 — 캐릭터/샘플 데이터 없이 "본계정" 1개만 생성.
 *  사용자가 계정 생성 과정 없이 바로 캐릭터 추가 가능. */
export function makeInitialAccount(): { accounts: Account[]; characters: Character[] } {
  return {
    accounts: [
      {
        id: "a1",
        name: "본계정",
        subscribed: false,
        servers: {},
      },
    ],
    characters: [],
  };
}

export function makeSampleData(): { accounts: Account[]; characters: Character[] } {
  const wk = weekStr();
  const td = todayStr();
  const now = Date.now();

  const accounts: Account[] = [
    {
      id: "a1", name: "본계정", subscribed: true,
      servers: { 카이로스: { dungeon: { base: 6, extra: 2 }, shugoTickets: 5, invasionTickets: 3, kina: 0 } },
    },
    {
      id: "a2", name: "부계정", subscribed: false,
      servers: { 에이온: { dungeon: { base: 14, extra: 0 }, shugoTickets: 2, invasionTickets: 1, kina: 0 } },
    },
  ];

  const sampleRaid = (rm: number, bm: number) => ({
    rewardBase: rm, reward: rm, rewardExtra: 0,
    bossBase: bm,  boss: bm,  bossExtra: 0,
    odConsumed: 0,
  });

  const characters: Character[] = [
    {
      id: "c1", accountId: "a1", name: "판다곰", level: 65, race: "천족",
      classId: "sword", className: "검성", classIcon: "🗡️", server: "카이로스",
      cp: 52000, itemLevel: 218, od: 256, odMax: 0, odExtra: 80,
      passes: ["연속강화패스", "성장지원패스"], memo: "주력 파밍 캐릭터.",
      expedition: { rewardBase: 5, reward: 2, rewardExtra: 1, bossBase: 5, boss: 2, bossExtra: 0, odConsumed: 240 },
      transcend: sampleRaid(5, 5),
      sanctuary_ludra: sampleRaid(5, 5),
      sanctuary_bagot: sampleRaid(5, 5),
      awakening: { tickets: 1, ticketsExtra: 2 },
      nightmare: { tickets: 4, ticketsExtra: 0 },
      mission: { done: 2 },
      shop: { convert: 0, buy: 0 },
      corridor: { lower: 2, lowerMax: 2, middle: 3, middleMax: 3 },
      weeklyResetDate: wk, dailyResetDate: td, createdAt: now - 86_400_000 * 30, hidden: false,
      odLastChargeTs: getLastChargeTs(OD_CHARGE_HOURS, now),
      expRewardLastChargeTs: getLastChargeTs(EXP_REWARD_HOURS, now),
      traRewardLastChargeTs: getLastChargeTs(TRA_REWARD_HOURS, now),
    },
    {
      id: "c2", accountId: "a1", name: "흑곰세라", level: 58, race: "마족",
      classId: "mage", className: "마도성", classIcon: "🔥", server: "카이로스",
      cp: 38000, itemLevel: 195, od: 80, odMax: 0, odExtra: 0,
      passes: ["성장지원패스"], memo: "빙결 특화.",
      expedition: sampleRaid(5, 5),
      transcend: sampleRaid(5, 5),
      sanctuary_ludra: sampleRaid(5, 5),
      sanctuary_bagot: sampleRaid(5, 5),
      awakening: { tickets: 3, ticketsExtra: 0 },
      nightmare: { tickets: 2, ticketsExtra: 0 },
      mission: { done: 5 },
      shop: { convert: 0, buy: 0 },
      corridor: { lower: 0, lowerMax: 3, middle: 0, middleMax: 3 },
      weeklyResetDate: wk, dailyResetDate: td, createdAt: now - 86_400_000 * 15, hidden: false,
    },
    {
      id: "c3", accountId: "a2", name: "에이온서머너", level: 45, race: "천족",
      classId: "spirit", className: "정령성", classIcon: "🏵️", server: "에이온",
      cp: 18000, itemLevel: 150, od: 100, odMax: 0, odExtra: 0,
      passes: [], memo: "",
      expedition: sampleRaid(5, 5),
      transcend: sampleRaid(5, 5),
      sanctuary_ludra: sampleRaid(5, 5),
      sanctuary_bagot: sampleRaid(5, 5),
      awakening: { tickets: 3, ticketsExtra: 0 },
      nightmare: { tickets: 0, ticketsExtra: 0 },
      mission: { done: 5 },
      shop: { convert: 0, buy: 0 },
      corridor: { lower: 0, lowerMax: 3, middle: 0, middleMax: 3 },
      weeklyResetDate: wk, dailyResetDate: td, createdAt: now - 86_400_000 * 5, hidden: false,
    },
  ];

  return { accounts, characters };
}
