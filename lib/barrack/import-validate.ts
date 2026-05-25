"use client";

import type { Account, Character } from "./types";
import { log } from "@/lib/util/logger";

/**
 * Import 데이터 스키마 검증 — 외부 의존성 없는 수동 validator.
 *
 * 손상된/악의적 JSON이 store에 주입되어 앱이 망가지는 것을 방지.
 * - 필수 필드 누락 시 reject
 * - 타입 불일치 (예: number 자리에 string) 시 reject
 * - 불필요 필드는 무시 (forward-compat)
 *
 * 반환: 검증 통과 시 정규화된 객체, 실패 시 Error throw.
 */

function isStr(v: unknown): v is string { return typeof v === "string"; }
function isNum(v: unknown): v is number { return typeof v === "number" && Number.isFinite(v); }
function isBool(v: unknown): v is boolean { return typeof v === "boolean"; }
function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function reqStr(o: Record<string, unknown>, key: string, ctx: string): string {
  const v = o[key];
  if (!isStr(v)) throw new Error(`${ctx}: '${key}' 필드는 문자열이어야 합니다 (받음: ${typeof v})`);
  return v;
}

function optStr(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return isStr(v) ? v : undefined;
}

function optNum(o: Record<string, unknown>, key: string, def = 0): number {
  const v = o[key];
  return isNum(v) ? v : def;
}

function reqNum(o: Record<string, unknown>, key: string, ctx: string): number {
  const v = o[key];
  if (!isNum(v)) throw new Error(`${ctx}: '${key}' 필드는 숫자여야 합니다 (받음: ${typeof v})`);
  return v;
}

function optBool(o: Record<string, unknown>, key: string, def = false): boolean {
  const v = o[key];
  return isBool(v) ? v : def;
}

function optStrArr(o: Record<string, unknown>, key: string): string[] {
  const v = o[key];
  if (!Array.isArray(v)) return [];
  return v.filter(isStr);
}

/** RaidState 구조 정규화 — 누락 필드는 0으로 채움. */
function normalizeRaidState(v: unknown) {
  const o = isObj(v) ? v : {};
  return {
    rewardBase: optNum(o, "rewardBase", 0),
    reward: optNum(o, "reward", 0),
    rewardExtra: optNum(o, "rewardExtra", 0),
    bossBase: optNum(o, "bossBase", 0),
    boss: optNum(o, "boss", 0),
    bossExtra: optNum(o, "bossExtra", 0),
    odConsumed: optNum(o, "odConsumed", 0),
  };
}

function normalizeServerData(v: unknown) {
  const o = isObj(v) ? v : {};
  const dungeon = isObj(o.dungeon) ? o.dungeon : {};
  return {
    dungeon: { base: optNum(dungeon, "base", 0), extra: optNum(dungeon, "extra", 0) },
    shugoTickets: optNum(o, "shugoTickets", 0),
    invasionTickets: optNum(o, "invasionTickets", 0),
    shugoLastChargeTs: isNum(o.shugoLastChargeTs) ? o.shugoLastChargeTs : null,
    weeklyResetDate: optStr(o, "weeklyResetDate"),
    dungeonDailyDate: optStr(o, "dungeonDailyDate"),
    expRewardTotal: optNum(o, "expRewardTotal", 0),
    traRewardTotal: optNum(o, "traRewardTotal", 0),
    shopOdBuy: optNum(o, "shopOdBuy", 0),
    shopOdConvert: optNum(o, "shopOdConvert", 0),
    shopBox: optNum(o, "shopBox", 0),
    missionDone: optNum(o, "missionDone", 0),
    kina: optNum(o, "kina", 0),
    kinaExcluded: optBool(o, "kinaExcluded", false),
  };
}

export function validateAccount(v: unknown, idx: number): Account {
  if (!isObj(v)) throw new Error(`account[${idx}]: 객체가 아닙니다`);
  const ctx = `account[${idx}]`;
  const id = reqStr(v, "id", ctx);
  const name = reqStr(v, "name", ctx);
  const serversRaw = isObj(v.servers) ? v.servers : {};
  const servers: Record<string, ReturnType<typeof normalizeServerData>> = {};
  for (const [k, val] of Object.entries(serversRaw)) {
    servers[k] = normalizeServerData(val);
  }
  return {
    id,
    name,
    subscribed: optBool(v, "subscribed", false),
    servers: servers as Account["servers"],
  };
}

export function validateCharacter(v: unknown, idx: number): Character {
  if (!isObj(v)) throw new Error(`character[${idx}]: 객체가 아닙니다`);
  const ctx = `character[${idx}]`;
  const id = reqStr(v, "id", ctx);
  const accountId = reqStr(v, "accountId", ctx);
  const name = reqStr(v, "name", ctx);
  const server = reqStr(v, "server", ctx);

  const awakening = isObj(v.awakening) ? v.awakening : {};
  const nightmare = isObj(v.nightmare) ? v.nightmare : {};
  const mission = isObj(v.mission) ? v.mission : {};
  const shop = isObj(v.shop) ? v.shop : {};
  const corridor = isObj(v.corridor) ? v.corridor : {};
  const hiddenContentsRaw = isObj(v.hiddenContents) ? v.hiddenContents : {};
  const hiddenContents: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(hiddenContentsRaw)) {
    if (isBool(val)) hiddenContents[k] = val;
  }

  // contentChangeLog 검증 + cap 50
  const logRaw = Array.isArray(v.contentChangeLog) ? v.contentChangeLog : [];
  const contentChangeLog = logRaw
    .filter(isObj)
    .filter((l) => isStr(l.raidKey) && isStr(l.target) && isNum(l.delta) && isNum(l.ts))
    .slice(0, 50) as Character["contentChangeLog"];

  return {
    id,
    accountId,
    name,
    level: optNum(v, "level", 1),
    race: reqStr(v, "race", ctx),
    classId: reqStr(v, "classId", ctx),
    className: optStr(v, "className"),
    classIcon: optStr(v, "classIcon"),
    server,
    cp: optNum(v, "cp", 0),
    itemLevel: optNum(v, "itemLevel", 0),
    od: optNum(v, "od", 0),
    odMax: optNum(v, "odMax", 0),
    odExtra: optNum(v, "odExtra", 0),
    passes: optStrArr(v, "passes"),
    memo: optStr(v, "memo"),
    expedition: normalizeRaidState(v.expedition),
    transcend: normalizeRaidState(v.transcend),
    sanctuary_ludra: normalizeRaidState(v.sanctuary_ludra),
    sanctuary_bagot: normalizeRaidState(v.sanctuary_bagot),
    awakening: {
      tickets: optNum(awakening, "tickets", 0),
      ticketsExtra: optNum(awakening, "ticketsExtra", 0),
    },
    nightmare: {
      tickets: optNum(nightmare, "tickets", 0),
      ticketsExtra: optNum(nightmare, "ticketsExtra", 0),
    },
    mission: { done: optNum(mission, "done", 0) },
    shop: { convert: optNum(shop, "convert", 0), buy: optNum(shop, "buy", 0) },
    corridor: {
      lower: optNum(corridor, "lower", 0),
      lowerMax: optNum(corridor, "lowerMax", 0),
      middle: optNum(corridor, "middle", 0),
      middleMax: optNum(corridor, "middleMax", 0),
    },
    hidden: optBool(v, "hidden", false),
    hiddenContents,
    contentChangeLog,
    weeklyResetDate: optStr(v, "weeklyResetDate"),
    dailyResetDate: optStr(v, "dailyResetDate"),
    createdAt: isNum(v.createdAt) ? v.createdAt : undefined,
    odLastChargeTs: isNum(v.odLastChargeTs) ? v.odLastChargeTs : null,
    expRewardLastChargeTs: isNum(v.expRewardLastChargeTs) ? v.expRewardLastChargeTs : null,
    traRewardLastChargeTs: isNum(v.traRewardLastChargeTs) ? v.traRewardLastChargeTs : null,
    nightmareLastChargeTs: isNum(v.nightmareLastChargeTs) ? v.nightmareLastChargeTs : null,
  };
}

export type ValidatedBarrack = {
  accounts: Account[];
  characters: Character[];
  dbSettings?: unknown;
};

/** 배럭 import payload 전체 검증. 손상 데이터는 skip + 카운트 반환. */
export function validateBarrackImport(raw: unknown): {
  data: ValidatedBarrack;
  skipped: { accounts: number; characters: number };
} {
  if (!isObj(raw)) throw new Error("최상위 JSON이 객체가 아닙니다");
  const accRaw = Array.isArray(raw.accounts) ? raw.accounts : [];
  const charRaw = Array.isArray(raw.characters) ? raw.characters : [];
  const accounts: Account[] = [];
  const characters: Character[] = [];
  let accSkip = 0;
  let charSkip = 0;

  accRaw.forEach((a, i) => {
    try { accounts.push(validateAccount(a, i)); }
    catch (e) { log.warn("[import] account skip:", (e as Error).message); accSkip++; }
  });
  charRaw.forEach((c, i) => {
    try { characters.push(validateCharacter(c, i)); }
    catch (e) { log.warn("[import] character skip:", (e as Error).message); charSkip++; }
  });

  if (accounts.length === 0 && characters.length === 0) {
    throw new Error("유효한 계정·캐릭터가 0개 — 파일 형식 확인 필요");
  }

  return {
    data: { accounts, characters, dbSettings: raw.dbSettings },
    skipped: { accounts: accSkip, characters: charSkip },
  };
}
