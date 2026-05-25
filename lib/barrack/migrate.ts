import type { Account, Character, DbSettings, RaidState } from "./types";
import { RAID_TYPES } from "./constants";

export function initRaid(type: keyof DbSettings, db: DbSettings): RaidState {
  const cfg = db[type] as { rewardMax?: number; bossMax?: number } | undefined;
  const rm = cfg?.rewardMax ?? 5;
  const bm = cfg?.bossMax ?? 5;
  return {
    rewardBase: rm, reward: rm, rewardExtra: 0,
    bossBase: bm,  boss: bm,  bossExtra: 0,
    odConsumed: 0,
  };
}

export function migrateCharacter(c: Character, db: DbSettings): Character {
  if (c.odExtra === undefined) c.odExtra = 0;
  // 구버전 odMax 고정값(320/420/840) → 0 으로 리셋해 DB 기반 한도(구독/미구독) 사용.
  // 사용자가 명시적으로 다른 값을 설정한 경우만 override 로 보존.
  if (c.odMax === 320 || c.odMax === 420 || c.odMax === 840) c.odMax = 0;

  for (const t of RAID_TYPES) {
    const raid = (c as any)[t] as RaidState | undefined;
    if (!raid) {
      // 구버전 sanctuary → sanctuary_ludra
      if (t === "sanctuary_ludra" && (c as any).sanctuary) {
        const s = (c as any).sanctuary as RaidState;
        (c as any)[t] = {
          rewardBase: s.rewardBase || (db as any)[t]?.rewardMax || 5,
          reward: s.reward ?? s.rewardBase ?? 5,
          rewardExtra: s.rewardExtra || 0,
          bossBase: s.bossBase || (db as any)[t]?.bossMax || 5,
          boss: s.boss ?? s.bossBase ?? 5,
          bossExtra: s.bossExtra || 0,
          odConsumed: s.odConsumed || 0,
        };
      } else {
        (c as any)[t] = initRaid(t as any, db);
      }
    } else {
      if (raid.rewardBase === undefined) raid.rewardBase = (db as any)[t]?.rewardMax || 5;
      if (raid.bossBase === undefined) raid.bossBase = (db as any)[t]?.bossMax || 5;
      if (raid.rewardExtra === undefined) raid.rewardExtra = 0;
      if (raid.bossExtra === undefined) raid.bossExtra = 0;
    }
  }

  if (!c.awakening) c.awakening = { tickets: db.awakening.weeklyTickets, ticketsExtra: 0 };
  else if (c.awakening.ticketsExtra === undefined) c.awakening.ticketsExtra = 0;

  if (!c.nightmare) c.nightmare = { tickets: 0, ticketsExtra: 0 };
  else if (c.nightmare.ticketsExtra === undefined) c.nightmare.ticketsExtra = 0;

  if (!c.mission) c.mission = { done: db.mission?.dailyMax ?? 5 };
  if (!c.shop) c.shop = { convert: 0, buy: 0 };
  else {
    if (c.shop.convert === undefined) c.shop.convert = 0;
    if (c.shop.buy === undefined) c.shop.buy = 0;
  }
  if (!c.corridor) c.corridor = { lower: 0, lowerMax: 3, middle: 0, middleMax: 3 };
  else {
    if (c.corridor.lowerMax === undefined) c.corridor.lowerMax = 3;
    if (c.corridor.middleMax === undefined) c.corridor.middleMax = 3;
  }
  if (c.hidden === undefined) c.hidden = false;
  if (!c.hiddenContents) c.hiddenContents = {};
  if (!Array.isArray(c.contentChangeLog)) c.contentChangeLog = [];
  if (c.odLastChargeTs === undefined) c.odLastChargeTs = null;
  if (c.expRewardLastChargeTs === undefined) c.expRewardLastChargeTs = null;
  if (c.traRewardLastChargeTs === undefined) c.traRewardLastChargeTs = null;
  if (c.nightmareLastChargeTs === undefined) c.nightmareLastChargeTs = null;
  delete (c as any).dungeon;
  return c;
}

export function migrateAccount(a: Account, characters: Character[], db: DbSettings): Account {
  if (!a.servers) {
    a.servers = {};
    const accChars = characters.filter((c) => c.accountId === a.id);
    const srvList = [...new Set(accChars.map((c) => c.server || ""))];
    if (srvList.length === 0) srvList.push("");
    const defDm = db.dungeon?.weeklyMax ?? 14;
    srvList.forEach((s) => {
      a.servers[s] = { dungeon: { base: defDm, extra: 0 }, shugoTickets: 0, invasionTickets: 0 };
    });
  }
  return a;
}

export function migrateDB(db: Partial<DbSettings>, defaults: DbSettings): DbSettings {
  // 구버전 sanctuary → sanctuary_ludra
  if ((db as any).sanctuary && !db.sanctuary_ludra) {
    db.sanctuary_ludra = { ...(db as any).sanctuary };
    db.sanctuary_bagot = { rewardMax: 2, bossMax: 4, odSub: 80, odUnsub: 40 };
    delete (db as any).sanctuary;
  }
  // 누락된 키는 default로 채움
  return { ...defaults, ...db } as DbSettings;
}
