"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Account, Character, DbSettings, ServerData } from "./types";
import { DB_DEFAULTS, RAID_TYPES, CLASSES } from "./constants";
import { BUILD_SNAPSHOT, hasSnapshot } from "@/lib/defaults/snapshot";
import { migrateAccount, migrateCharacter, migrateDB } from "./migrate";
import { makeInitialAccount } from "./seed";
import { weekStr, todayStr } from "./time";
import { uid } from "./time";

type BarrackState = {
  accounts: Account[];
  characters: Character[];
  dbSettings: DbSettings;
  selectedAccId: string;
  showHiddenChars: boolean;
  kinaHidden: { dash: boolean; simple: boolean };
  /** 캐릭터 표시 순서 — id 배열, 비어있으면 createdAt 기준 */
  characterOrder: string[];
};

type BarrackActions = {
  // 계정
  upsertAccount: (acc: Account) => void;
  removeAccount: (id: string) => void;

  // 캐릭터
  upsertCharacter: (c: Character) => void;
  removeCharacter: (id: string) => void;
  patchCharacter: (id: string, patch: Partial<Character>) => void;
  toggleCharHidden: (id: string) => void;

  // 서버 데이터
  getServerData: (accId: string, server: string) => ServerData | undefined;
  patchServerData: (accId: string, server: string, patch: Partial<ServerData>) => void;
  /** 원정/초월 누적 (expRewardTotal / traRewardTotal) 직접 설정 */
  setRewardTotal: (accId: string, server: string, type: "expedition" | "transcend", value: number) => void;

  /** 회랑 일괄 적용 (대상 캐릭터 corridor max를 동시에 설정) */
  applyCorridorBulk: (charIds: string[], lower: number, middle: number) => void;

  // DB
  updateDb: (db: Partial<DbSettings>) => void;
  resetDb: () => void;

  // 일/주 초기화
  dailyReset: () => void;
  weeklyReset: () => void;

  // 콘텐츠 카운터 (좌클릭 -1, 우클릭 +1)
  doRaid: (charId: string, raidKey: "expedition" | "transcend" | "sanctuary_ludra" | "sanctuary_bagot", target: "reward" | "boss" | "both", delta: -1 | 1) => void;
  doMission: (charId: string, delta: -1 | 1) => void;
  doAwakening: (charId: string, delta: -1 | 1) => void;
  doNightmare: (charId: string, delta: -1 | 1) => void;
  doCorridor: (charId: string, tier: "lower" | "middle", delta: -1 | 1) => void;
  doShop: (charId: string, kind: "convert" | "buy", delta: -1 | 1) => void;

  // 서버 단위 카운터
  adjustServerMission: (accId: string, server: string, delta: -1 | 1) => void;
  adjustDungeon: (accId: string, server: string, delta: -1 | 1) => void;
  adjustTicket: (accId: string, server: string, kind: "shugo" | "invasion", delta: -1 | 1) => void;

  // 자동 충전/리셋
  autoCheckResets: () => boolean;

  // UI
  setSelectedAccId: (id: string) => void;
  setShowHiddenChars: (b: boolean) => void;
  setKinaHidden: (page: "dash" | "simple", hidden: boolean) => void;
  setCharacterOrder: (ids: string[]) => void;

  // 통합 저장/불러오기 — 직접 데이터 교체
  setBarrackData: (d: { accounts?: Account[]; characters?: Character[] }) => void;
  setDb: (db: DbSettings) => void;

  // 초기 셋업 (시드 비어있을 때)
  hydrate: () => void;
};

type Store = BarrackState & BarrackActions;

// 빌드 스냅샷 우선, 없으면 코드 기본값
const initialDbSettings: DbSettings = hasSnapshot("barrackDb")
  ? structuredClone(BUILD_SNAPSHOT.barrackDb!) as DbSettings
  : structuredClone(DB_DEFAULTS);

const defaultState: BarrackState = {
  accounts: [],
  characters: [],
  dbSettings: initialDbSettings,
  selectedAccId: "",
  showHiddenChars: false,
  kinaHidden: { dash: false, simple: false },
  characterOrder: [],
};

/** 캐릭터의 효과적 오드 한도 — 계정 구독 여부 + DB 설정. 캐릭터 odMax는 override 용도(>0이면 우선). */
export function computeOdMax(char: Character, accounts: Account[], db: DbSettings): number {
  const acc = accounts.find((a) => a.id === char.accountId);
  const sub = !!acc?.subscribed;
  const fromDb = sub ? (db.odMaxSub ?? 840) : (db.odMaxUnsub ?? 420);
  // 캐릭터별 override(>0) 우선. 0/누락이면 DB값(구독/미구독) 사용.
  if (char.odMax && char.odMax > 0) return char.odMax;
  return fromDb;
}

function ensureServerData(acc: Account, server: string, db: DbSettings): ServerData {
  if (!acc.servers) acc.servers = {};
  const key = server || "";
  const defDm = db.dungeon?.weeklyMax ?? 14;
  if (!acc.servers[key]) {
    acc.servers[key] = { dungeon: { base: defDm, extra: 0 }, shugoTickets: 0, invasionTickets: 0 };
  }
  const sd = acc.servers[key];
  if (!sd.dungeon) sd.dungeon = { base: defDm, extra: 0 };
  if (sd.shugoTickets === undefined) sd.shugoTickets = 0;
  if (sd.invasionTickets === undefined) sd.invasionTickets = 0;
  return sd;
}

export const useBarrackStore = create<Store>()(
  persist(
    (set, get) => ({
      ...defaultState,

      upsertAccount: (acc) =>
        set((s) => {
          const idx = s.accounts.findIndex((a) => a.id === acc.id);
          const next = s.accounts.slice();
          if (idx < 0) next.push(acc);
          else next[idx] = acc;
          return { accounts: next };
        }),

      removeAccount: (id) =>
        set((s) => ({
          accounts: s.accounts.filter((a) => a.id !== id),
          characters: s.characters.filter((c) => c.accountId !== id),
        })),

      upsertCharacter: (c) =>
        set((s) => {
          // 직업 메타 동기화
          const cls = CLASSES.find((x) => x.id === c.classId);
          if (cls) { c.className = cls.name; c.classIcon = cls.icon; }
          const idx = s.characters.findIndex((x) => x.id === c.id);
          const next = s.characters.slice();
          if (idx < 0) next.push(c);
          else next[idx] = c;
          // 계정의 서버 데이터 보장
          const accIdx = s.accounts.findIndex((a) => a.id === c.accountId);
          if (accIdx >= 0) {
            const acc = { ...s.accounts[accIdx] };
            ensureServerData(acc, c.server, s.dbSettings);
            const accs = s.accounts.slice();
            accs[accIdx] = acc;
            return { characters: next, accounts: accs };
          }
          return { characters: next };
        }),

      removeCharacter: (id) =>
        set((s) => ({ characters: s.characters.filter((c) => c.id !== id) })),

      patchCharacter: (id, patch) =>
        set((s) => ({
          characters: s.characters.map((c) => (c.id === id ? { ...c, ...patch } : c)),
        })),

      toggleCharHidden: (id) =>
        set((s) => ({
          characters: s.characters.map((c) => (c.id === id ? { ...c, hidden: !c.hidden } : c)),
        })),

      getServerData: (accId, server) => {
        const acc = get().accounts.find((a) => a.id === accId);
        if (!acc) return undefined;
        return acc.servers?.[server || ""];
      },

      patchServerData: (accId, server, patch) =>
        set((s) => {
          const accs = s.accounts.slice();
          const idx = accs.findIndex((a) => a.id === accId);
          if (idx < 0) return {};
          const acc = { ...accs[idx], servers: { ...(accs[idx].servers || {}) } };
          const cur = ensureServerData(acc, server, s.dbSettings);
          acc.servers[server || ""] = { ...cur, ...patch };
          accs[idx] = acc;
          return { accounts: accs };
        }),

      updateDb: (db) => set((s) => ({ dbSettings: { ...s.dbSettings, ...db } })),
      resetDb: () => set({ dbSettings: structuredClone(DB_DEFAULTS) }),

      dailyReset: () =>
        set((s) => {
          const td = todayStr();
          const characters = s.characters.map((c) => ({
            ...c,
            mission: { done: s.dbSettings.mission?.dailyMax ?? 5 },
            nightmare: { tickets: 0, ticketsExtra: c.nightmare?.ticketsExtra ?? 0 },
            dailyResetDate: td,
          }));
          return { characters };
        }),

      doRaid: (charId, raidKey, target, delta) =>
        set((s) => {
          let rewardChange = 0;
          let accId = "";
          let server = "";
          // 오드 비용 계산 — DB 설정 + 계정 구독 여부
          const accSubscribed = !!s.accounts.find((a) => {
            const ch = s.characters.find((x) => x.id === charId);
            return ch && a.id === ch.accountId;
          })?.subscribed;
          const raidCfg = s.dbSettings[raidKey] as { odSub?: number; odUnsub?: number } | undefined;
          const odCost = accSubscribed ? (raidCfg?.odSub ?? 0) : (raidCfg?.odUnsub ?? 0);
          const characters = s.characters.map((c) => {
            if (c.id !== charId) return c;
            const cur = c[raidKey];
            if (!cur) return c;
            const next = { ...cur };

            // reward base-first → extra: delta=-1 시 reward(잔여)>0이면 reward 감소, 아니면 rewardExtra 감소
            //   delta=+1 시 reward(잔여) < rewardBase이면 reward 증가, 아니면 rewardExtra 증가
            if (target === "reward" || target === "both") {
              const oldR = cur.reward;
              const oldRx = cur.rewardExtra ?? 0;
              if (delta < 0) {
                if (next.reward > 0) next.reward = Math.max(0, next.reward + delta);
                else next.rewardExtra = Math.max(0, oldRx + delta);
              } else {
                if (next.reward < (cur.rewardBase || 0)) next.reward = next.reward + delta;
                else next.rewardExtra = (next.rewardExtra ?? 0) + delta;
              }
              const usedDiff = (oldR + oldRx) - (next.reward + (next.rewardExtra ?? 0));
              rewardChange = usedDiff;
              accId = c.accountId;
              server = c.server || "";
            }
            // boss base-first → extra: 동일 로직
            if (target === "boss" || target === "both") {
              const oldBx = cur.bossExtra ?? 0;
              if (delta < 0) {
                if (next.boss > 0) next.boss = Math.max(0, next.boss + delta);
                else next.bossExtra = Math.max(0, oldBx + delta);
              } else {
                if (next.boss < (cur.bossBase || 0)) next.boss = next.boss + delta;
                else next.bossExtra = (next.bossExtra ?? 0) + delta;
              }
            }

            // 오드 차감/환급 — 보상 상자(reward) 사용 시만 적용. 보스/입장권은 OD 무관.
            // base 우선 차감, 모자라면 extra. 환급은 base에 우선 회수.
            let odNew: number | undefined;
            let odExNew: number | undefined;
            if (odCost > 0 && (target === "reward" || target === "both")) {
              const effMax = computeOdMax(c, s.accounts, s.dbSettings);
              if (delta < 0) {
                // 사용 — odCost 만큼 차감 (base 우선)
                const useBase = Math.min(c.od, odCost);
                const remaining = odCost - useBase;
                const useExtra = Math.min(c.odExtra ?? 0, remaining);
                odNew = c.od - useBase;
                odExNew = (c.odExtra ?? 0) - useExtra;
              } else {
                // 환급 — odCost 만큼 추가 (base 우선 회수, base 한도 초과분은 extra)
                const refundBase = Math.min(Math.max(0, effMax - c.od), odCost);
                const refundExtra = odCost - refundBase;
                odNew = c.od + refundBase;
                odExNew = (c.odExtra ?? 0) + Math.max(0, refundExtra);
              }
            }
            // 콘텐츠 변경 로그 push (newest first, 최대 50개 유지).
            // raid-edit-dialog 같은 일괄 편집은 별도 경로라 여기서는 doRaid 호출만 기록.
            const logEntry = { raidKey, target, delta, ts: Date.now() };
            const nextLog = [logEntry, ...(c.contentChangeLog ?? [])].slice(0, 50);
            return {
              ...c,
              ...(odNew !== undefined ? { od: odNew } : {}),
              ...(odExNew !== undefined ? { odExtra: odExNew } : {}),
              [raidKey]: next,
              contentChangeLog: nextLog,
            } as typeof c;
          });

          // 원정/초월의 경우 누적 카운터 자동 업데이트 (서버 단위)
          let accounts = s.accounts;
          if ((raidKey === "expedition" || raidKey === "transcend") && rewardChange !== 0 && accId) {
            const field = raidKey === "expedition" ? "expRewardTotal" : "traRewardTotal";
            accounts = accounts.map((a) => {
              if (a.id !== accId) return a;
              const servers = { ...(a.servers || {}) };
              const sd = ensureServerData({ ...a, servers }, server, s.dbSettings);
              const cur = sd[field] ?? 0;
              servers[server || ""] = { ...sd, [field]: Math.max(0, cur + rewardChange) };
              return { ...a, servers };
            });
          }
          return { characters, accounts };
        }),

      doMission: (charId, delta) =>
        set((s) => {
          const max = s.dbSettings.mission?.dailyMax ?? 5;
          const characters = s.characters.map((c) =>
            c.id === charId ? { ...c, mission: { done: Math.max(0, Math.min(max, (c.mission?.done ?? max) + delta)) } } : c
          );
          return { characters };
        }),

      doAwakening: (charId, delta) =>
        set((s) => {
          const characters = s.characters.map((c) => {
            if (c.id !== charId) return c;
            const max = (s.dbSettings.awakening.weeklyTickets ?? 0) + (c.awakening?.ticketsExtra ?? 0);
            return { ...c, awakening: { ...c.awakening, tickets: Math.max(0, Math.min(max, (c.awakening?.tickets ?? 0) + delta)) } };
          });
          return { characters };
        }),

      doNightmare: (charId, delta) =>
        set((s) => {
          const characters = s.characters.map((c) => {
            if (c.id !== charId) return c;
            const max = s.dbSettings.nightmare?.maxTickets ?? 14;
            return { ...c, nightmare: { ...c.nightmare, tickets: Math.max(0, Math.min(max, (c.nightmare?.tickets ?? 0) + delta)) } };
          });
          return { characters };
        }),

      doCorridor: (charId, tier, delta) =>
        set((s) => {
          const characters = s.characters.map((c) => {
            if (c.id !== charId) return c;
            const cur = c.corridor ?? { lower: 0, lowerMax: 3, middle: 0, middleMax: 3 };
            const max = tier === "lower" ? cur.lowerMax : cur.middleMax;
            const next = Math.max(0, Math.min(max, cur[tier] + delta));
            return { ...c, corridor: { ...cur, [tier]: next } };
          });
          return { characters };
        }),

      setRewardTotal: (accId, server, type, value) =>
        set((s) => {
          const field = type === "expedition" ? "expRewardTotal" : "traRewardTotal";
          const accounts = s.accounts.map((a) => {
            if (a.id !== accId) return a;
            const servers = { ...(a.servers || {}) };
            const sd = ensureServerData({ ...a, servers }, server, s.dbSettings);
            servers[server || ""] = { ...sd, [field]: Math.max(0, value | 0) };
            return { ...a, servers };
          });
          return { accounts };
        }),

      applyCorridorBulk: (charIds, lower, middle) =>
        set((s) => {
          const idSet = new Set(charIds);
          const L = Math.max(0, Math.min(3, lower | 0));
          const M = Math.max(0, Math.min(3, middle | 0));
          const characters = s.characters.map((c) =>
            idSet.has(c.id)
              ? { ...c, corridor: { lower: L, lowerMax: L, middle: M, middleMax: M } }
              : c
          );
          return { characters };
        }),

      adjustServerMission: (accId, server, delta) =>
        set((s) => {
          const max = s.dbSettings.mission?.dailyMax ?? 5;
          const accs = s.accounts.slice();
          const idx = accs.findIndex((a) => a.id === accId);
          if (idx < 0) return {};
          const acc = { ...accs[idx], servers: { ...(accs[idx].servers || {}) } };
          const sd = ensureServerData(acc, server, s.dbSettings);
          const cur = sd.missionDone ?? max;
          acc.servers[server || ""] = { ...sd, missionDone: Math.max(0, Math.min(max, cur + delta)) };
          accs[idx] = acc;
          return { accounts: accs };
        }),

      adjustDungeon: (accId, server, delta) =>
        set((s) => {
          const accs = s.accounts.slice();
          const idx = accs.findIndex((a) => a.id === accId);
          if (idx < 0) return {};
          const acc = { ...accs[idx], servers: { ...(accs[idx].servers || {}) } };
          const sd = ensureServerData(acc, server, s.dbSettings);
          const dm = s.dbSettings.dungeon?.weeklyMax ?? 14;
          const base = sd.dungeon?.base ?? dm;
          const extra = sd.dungeon?.extra ?? 0;
          // V4.0.9: extra 먼저 차감, 그다음 base
          let nextBase = base, nextExtra = extra;
          if (delta < 0) {
            if (extra > 0) nextExtra = Math.max(0, extra - 1);
            else nextBase = Math.max(0, base - 1);
          } else {
            // 복원: base 먼저 채움
            if (base < dm) nextBase = Math.min(dm, base + 1);
            else nextExtra = extra + 1;
          }
          acc.servers[server || ""] = { ...sd, dungeon: { base: nextBase, extra: nextExtra } };
          accs[idx] = acc;
          return { accounts: accs };
        }),

      adjustTicket: (accId, server, kind, delta) =>
        set((s) => {
          const accs = s.accounts.slice();
          const idx = accs.findIndex((a) => a.id === accId);
          if (idx < 0) return {};
          const acc = { ...accs[idx], servers: { ...(accs[idx].servers || {}) } };
          const sd = ensureServerData(acc, server, s.dbSettings);
          const field = kind === "shugo" ? "shugoTickets" : "invasionTickets";
          const cur = sd[field] ?? 0;
          acc.servers[server || ""] = { ...sd, [field]: Math.max(0, cur + delta) };
          accs[idx] = acc;
          return { accounts: accs };
        }),

      /**
       * 자동 충전·자동 리셋 (V4.0.9 checkResets 동등):
       * - 슈고 일일 적립 (KST 5시 +2)
       * - 일일/주간 자동 리셋 (마지막 리셋 날짜 비교)
       * 매 분 호출. dirty면 true 리턴.
       */
      autoCheckResets: () => {
        // 동적 임포트 — 시간 헬퍼 사용
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const { todayStr, weekStr, getLastChargeTs, countChargesBetween } = require("./time") as typeof import("./time");
        const { SHUGO_CHARGE_HOURS, SHUGO_CHARGE_AMOUNT } = require("./constants") as typeof import("./constants");
        const td = todayStr();
        const wk = weekStr();
        const now = Date.now();
        const state = get();
        const db = state.dbSettings;
        let dirty = false;

        const newAccounts = state.accounts.map((a) => {
          const srvList = [...new Set(state.characters.filter((c) => c.accountId === a.id).map((c) => c.server || ""))];
          if (srvList.length === 0) return a;
          const servers = { ...(a.servers || {}) };
          for (const srv of srvList) {
            let sd = servers[srv] ?? ensureServerData({ ...a, servers }, srv, db);
            sd = { ...sd };
            const dungeonCycle = db.dungeon?.cycle || "weekly";
            const missionCycle = db.mission?.cycle || "daily";

            // 주간 자동 리셋
            if (!sd.weeklyResetDate || sd.weeklyResetDate !== wk) {
              if (dungeonCycle === "weekly") {
                sd.dungeon = { base: db.dungeon?.weeklyMax ?? 14, extra: sd.dungeon?.extra ?? 0 };
              }
              sd.expRewardTotal = 0;
              sd.traRewardTotal = 0;
              if ((db.shopOd?.cycle ?? "weekly") !== "daily") sd.shopOdBuy = 0;
              if ((db.shopOdConvert?.cycle ?? "weekly") !== "daily") sd.shopOdConvert = 0;
              if ((db.shopBox?.cycle ?? "weekly") !== "daily") sd.shopBox = 0;
              if (missionCycle === "weekly") sd.missionDone = db.mission?.dailyMax ?? 5;
              sd.weeklyResetDate = wk;
              dirty = true;
            }
            // 던전 일일 리셋
            if (dungeonCycle === "daily" && sd.dungeonDailyDate !== td) {
              sd.dungeon = { base: db.dungeon?.weeklyMax ?? 14, extra: sd.dungeon?.extra ?? 0 };
              sd.dungeonDailyDate = td;
              dirty = true;
            }
            // 사명 일일 리셋
            if (missionCycle === "daily") {
              const date = (sd as any).missionDailyDate;
              if (date !== td) {
                sd.missionDone = db.mission?.dailyMax ?? 5;
                (sd as any).missionDailyDate = td;
                dirty = true;
              }
            }
            // 슈고 일일 적립 (KST 5시 +SHUGO_CHARGE_AMOUNT)
            if (!sd.shugoLastChargeTs) {
              sd.shugoLastChargeTs = getLastChargeTs(SHUGO_CHARGE_HOURS, now);
              dirty = true;
            }
            const charges = countChargesBetween(SHUGO_CHARGE_HOURS, sd.shugoLastChargeTs ?? null, now);
            if (charges > 0) {
              sd.shugoTickets = (sd.shugoTickets ?? 0) + charges * SHUGO_CHARGE_AMOUNT;
              sd.shugoLastChargeTs = getLastChargeTs(SHUGO_CHARGE_HOURS, now);
              dirty = true;
            }
            servers[srv] = sd;
          }
          return { ...a, servers };
        });

        // 캐릭터 주간 자동 리셋
        const newCharacters = state.characters.map((c) => {
          if (c.weeklyResetDate === wk) return c;
          const next = { ...c };
          (["expedition", "transcend", "sanctuary_ludra", "sanctuary_bagot"] as const).forEach((t) => {
            const cur = c[t];
            if (!cur) return;
            const isAuto = t === "expedition" || t === "transcend";
            const rb = cur.rewardBase || db[t]?.rewardMax || 5;
            const bb = cur.bossBase || db[t]?.bossMax || 5;
            next[t] = {
              rewardBase: rb,
              reward: isAuto ? (cur.reward ?? rb) : rb,
              rewardExtra: cur.rewardExtra || 0,
              bossBase: bb,
              boss: bb,
              bossExtra: cur.bossExtra || 0,
              odConsumed: 0,
            };
          });
          if ((db.awakening?.cycle || "weekly") === "weekly") {
            next.awakening = { tickets: db.awakening.weeklyTickets, ticketsExtra: c.awakening?.ticketsExtra ?? 0 };
          }
          next.corridor = {
            lower: 0,
            lowerMax: c.corridor?.lowerMax ?? 3,
            middle: 0,
            middleMax: c.corridor?.middleMax ?? 3,
          };
          next.shop = {
            convert: (db.charConvert?.cycle || "weekly") !== "daily" ? 0 : (c.shop?.convert ?? 0),
            buy: (db.charBuy?.cycle || "weekly") !== "daily" ? 0 : (c.shop?.buy ?? 0),
          };
          if ((db.mission?.cycle || "daily") === "weekly") {
            next.mission = { done: db.mission.dailyMax };
          }
          next.weeklyResetDate = wk;
          dirty = true;
          return next;
        });

        // 캐릭터 일일 자동 리셋 (사명 일일 cycle)
        const dailyResetCharacters = newCharacters.map((c) => {
          if (c.dailyResetDate === td) return c;
          const next = { ...c };
          if ((db.mission?.cycle || "daily") === "daily") {
            next.mission = { done: db.mission?.dailyMax ?? 5 };
          }
          // 악몽 일일 cycle은 아래 별도 충전 로직이 처리 — 여기서는 dailyResetDate 마킹만
          next.dailyResetDate = td;
          dirty = true;
          return next;
        });

        // ── 캐릭터별 시간 기반 자동 충전 ──
        // OD: db.od.chargeHours마다 +chargeAmount
        // 원정/초월 보상: db[raid].chargeHours마다 +rewardChargeAmount (rewardBase 한도)
        // 악몽: 매일 +dailyGain (maxTickets 한도) — chargeHours 미정의면 매일 5KST 사용
        const odHours = db.od?.chargeHours ?? [];
        const odAmount = db.od?.chargeAmount ?? 0;
        const expHours = db.expedition?.chargeHours ?? [];
        const expAmount = db.expedition?.rewardChargeAmount ?? 0;
        const traHours = db.transcend?.chargeHours ?? [];
        const traAmount = db.transcend?.rewardChargeAmount ?? 0;
        const NIGHTMARE_HOURS = [5];  // 매일 5KST 기준
        const nmGain = db.nightmare?.dailyGain ?? 0;
        const nmMax = db.nightmare?.maxTickets ?? 14;

        const finalCharacters = dailyResetCharacters.map((c) => {
          const next = { ...c };
          let changed = false;

          // 캐릭터 OD 자동 충전
          if (odHours.length > 0 && odAmount > 0) {
            if (!next.odLastChargeTs) {
              next.odLastChargeTs = getLastChargeTs(odHours, now);
              changed = true;
            }
            const ch = countChargesBetween(odHours, next.odLastChargeTs ?? null, now);
            if (ch > 0) {
              const effMax = computeOdMax(next, state.accounts, db);
              next.od = Math.min(effMax, (next.od ?? 0) + ch * odAmount);
              next.odLastChargeTs = getLastChargeTs(odHours, now);
              changed = true;
            }
          }

          // 원정 보상 자동 충전
          if (next.expedition && expHours.length > 0 && expAmount > 0) {
            if (!next.expRewardLastChargeTs) {
              next.expRewardLastChargeTs = getLastChargeTs(expHours, now);
              changed = true;
            }
            const ch = countChargesBetween(expHours, next.expRewardLastChargeTs ?? null, now);
            if (ch > 0) {
              const cap = next.expedition.rewardBase || db.expedition?.rewardMax || 0;
              next.expedition = {
                ...next.expedition,
                reward: Math.min(cap, (next.expedition.reward ?? 0) + ch * expAmount),
              };
              next.expRewardLastChargeTs = getLastChargeTs(expHours, now);
              changed = true;
            }
          }

          // 초월 보상 자동 충전
          if (next.transcend && traHours.length > 0 && traAmount > 0) {
            if (!next.traRewardLastChargeTs) {
              next.traRewardLastChargeTs = getLastChargeTs(traHours, now);
              changed = true;
            }
            const ch = countChargesBetween(traHours, next.traRewardLastChargeTs ?? null, now);
            if (ch > 0) {
              const cap = next.transcend.rewardBase || db.transcend?.rewardMax || 0;
              next.transcend = {
                ...next.transcend,
                reward: Math.min(cap, (next.transcend.reward ?? 0) + ch * traAmount),
              };
              next.traRewardLastChargeTs = getLastChargeTs(traHours, now);
              changed = true;
            }
          }

          // 악몽 티켓 자동 충전 (매일 5KST +dailyGain)
          if ((db.nightmare?.cycle || "daily") === "daily" && nmGain > 0) {
            if (!next.nightmareLastChargeTs) {
              next.nightmareLastChargeTs = getLastChargeTs(NIGHTMARE_HOURS, now);
              changed = true;
            }
            const ch = countChargesBetween(NIGHTMARE_HOURS, next.nightmareLastChargeTs ?? null, now);
            if (ch > 0) {
              const cur = next.nightmare?.tickets ?? 0;
              next.nightmare = {
                tickets: Math.min(nmMax, cur + ch * nmGain),
                ticketsExtra: next.nightmare?.ticketsExtra ?? 0,
              };
              next.nightmareLastChargeTs = getLastChargeTs(NIGHTMARE_HOURS, now);
              changed = true;
            }
          }

          if (changed) dirty = true;
          return next;
        });

        if (dirty) {
          set({ accounts: newAccounts, characters: finalCharacters });
        }
        return dirty;
      },

      doShop: (charId, kind, delta) =>
        set((s) => {
          const SHOP_OD_GAIN = 40; // V4.0.9: 변환·상점 1회당 +40 추가 오드
          const characters = s.characters.map((c) => {
            if (c.id !== charId) return c;
            const max = kind === "convert" ? (s.dbSettings.charConvert?.max ?? 4) : (s.dbSettings.charBuy?.max ?? 4);
            const cur = c.shop?.[kind] ?? 0;
            const next = cur + delta;
            // 경계 검사 (0 ~ max) — 경계 넘어가면 odExtra도 변경 안 함
            if (delta > 0 && cur >= max) return c;
            if (delta < 0 && cur <= 0) return c;
            return {
              ...c,
              shop: { ...c.shop, [kind]: Math.max(0, Math.min(max, next)) },
              odExtra: Math.max(0, (c.odExtra ?? 0) + delta * SHOP_OD_GAIN),
            };
          });
          return { characters };
        }),

      weeklyReset: () =>
        set((s) => {
          const wk = weekStr();
          const td = todayStr();
          const db = s.dbSettings;
          const characters = s.characters.map((c) => ({
            ...c,
            expedition: { rewardBase: db.expedition.rewardMax, reward: db.expedition.rewardMax, rewardExtra: c.expedition?.rewardExtra ?? 0, bossBase: db.expedition.bossMax, boss: db.expedition.bossMax, bossExtra: c.expedition?.bossExtra ?? 0, odConsumed: 0 },
            transcend:  { rewardBase: db.transcend.rewardMax,  reward: db.transcend.rewardMax,  rewardExtra: c.transcend?.rewardExtra ?? 0,  bossBase: db.transcend.bossMax,  boss: db.transcend.bossMax,  bossExtra: c.transcend?.bossExtra ?? 0,  odConsumed: 0 },
            sanctuary_ludra: { rewardBase: db.sanctuary_ludra.rewardMax, reward: db.sanctuary_ludra.rewardMax, rewardExtra: c.sanctuary_ludra?.rewardExtra ?? 0, bossBase: db.sanctuary_ludra.bossMax, boss: db.sanctuary_ludra.bossMax, bossExtra: c.sanctuary_ludra?.bossExtra ?? 0, odConsumed: 0 },
            sanctuary_bagot: { rewardBase: db.sanctuary_bagot.rewardMax, reward: db.sanctuary_bagot.rewardMax, rewardExtra: c.sanctuary_bagot?.rewardExtra ?? 0, bossBase: db.sanctuary_bagot.bossMax, boss: db.sanctuary_bagot.bossMax, bossExtra: c.sanctuary_bagot?.bossExtra ?? 0, odConsumed: 0 },
            awakening: { tickets: db.awakening.weeklyTickets, ticketsExtra: c.awakening?.ticketsExtra ?? 0 },
            shop: { convert: 0, buy: 0 },
            corridor: { lower: 0, lowerMax: c.corridor?.lowerMax ?? 3, middle: 0, middleMax: c.corridor?.middleMax ?? 3 },
            weeklyResetDate: wk,
            dailyResetDate: td,
            mission: { done: db.mission?.dailyMax ?? 5 },
          }));
          // 서버 데이터의 주간 필드도 초기화
          const accounts = s.accounts.map((a) => {
            const servers = { ...a.servers };
            Object.keys(servers).forEach((k) => {
              servers[k] = {
                ...servers[k],
                dungeon: { base: db.dungeon.weeklyMax, extra: servers[k].dungeon?.extra ?? 0 },
                shopOdBuy: 0, shopOdConvert: 0, shopBox: 0,
                expRewardTotal: 0, traRewardTotal: 0,
                weeklyResetDate: wk,
              };
            });
            return { ...a, servers };
          });
          return { characters, accounts };
        }),

      setSelectedAccId: (id) => set({ selectedAccId: id }),
      setShowHiddenChars: (b) => set({ showHiddenChars: b }),
      setKinaHidden: (page, hidden) =>
        set((s) => ({ kinaHidden: { ...s.kinaHidden, [page]: hidden } })),
      setCharacterOrder: (ids) => set({ characterOrder: ids }),

      setBarrackData: (d) =>
        set((s) => {
          let { accounts, characters } = s;
          if (Array.isArray(d.accounts)) accounts = d.accounts;
          if (Array.isArray(d.characters)) {
            characters = d.characters.map((c) => migrateCharacter(c, s.dbSettings));
          }
          accounts = accounts.map((a) => migrateAccount(a, characters, s.dbSettings));
          return { accounts, characters };
        }),

      setDb: (db) => set({ dbSettings: migrateDB(db, DB_DEFAULTS) }),

      hydrate: () =>
        set((s) => {
          if (s.accounts.length === 0 && s.characters.length === 0) {
            const init = makeInitialAccount();
            return { accounts: init.accounts, characters: init.characters };
          }
          return {};
        }),
    }),
    {
      name: "a2-barrack",
      // Ver.4.0.9 호환을 위해 분리된 키도 함께 읽기 가능하도록 단일 키 사용
      partialize: (s) => ({
        accounts: s.accounts,
        characters: s.characters,
        dbSettings: s.dbSettings,
        kinaHidden: s.kinaHidden,
        characterOrder: s.characterOrder,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 마이그레이션 적용
        state.dbSettings = migrateDB(state.dbSettings ?? {}, DB_DEFAULTS);
        state.characters = state.characters.map((c) => migrateCharacter(c, state.dbSettings));
        state.accounts = state.accounts.map((a) => migrateAccount(a, state.characters, state.dbSettings));
        if (state.accounts.length === 0 && state.characters.length === 0) {
          const init = makeInitialAccount();
          state.accounts = init.accounts;
          state.characters = init.characters;
        }
      },
    }
  )
);

/** 새 캐릭터 빈 객체 생성 */
export function newBlankCharacter(accountId: string, defaultServer: string, db: DbSettings): Character {
  return {
    id: uid("c"),
    accountId, name: "", level: 1, race: "천족",
    classId: "guardian", className: "수호성", classIcon: "🛡️",
    server: defaultServer || "",
    cp: 0, itemLevel: 0, od: 0, odMax: 0, odExtra: 0,
    passes: [], memo: "",
    expedition: { rewardBase: db.expedition.rewardMax, reward: db.expedition.rewardMax, rewardExtra: 0, bossBase: db.expedition.bossMax, boss: db.expedition.bossMax, bossExtra: 0, odConsumed: 0 },
    transcend:  { rewardBase: db.transcend.rewardMax,  reward: db.transcend.rewardMax,  rewardExtra: 0, bossBase: db.transcend.bossMax,  boss: db.transcend.bossMax,  bossExtra: 0, odConsumed: 0 },
    sanctuary_ludra: { rewardBase: db.sanctuary_ludra.rewardMax, reward: db.sanctuary_ludra.rewardMax, rewardExtra: 0, bossBase: db.sanctuary_ludra.bossMax, boss: db.sanctuary_ludra.bossMax, bossExtra: 0, odConsumed: 0 },
    sanctuary_bagot: { rewardBase: db.sanctuary_bagot.rewardMax, reward: db.sanctuary_bagot.rewardMax, rewardExtra: 0, bossBase: db.sanctuary_bagot.bossMax, boss: db.sanctuary_bagot.bossMax, bossExtra: 0, odConsumed: 0 },
    awakening: { tickets: db.awakening.weeklyTickets, ticketsExtra: 0 },
    nightmare: { tickets: 0, ticketsExtra: 0 },
    mission: { done: db.mission?.dailyMax ?? 5 },
    shop: { convert: 0, buy: 0 },
    corridor: { lower: 0, lowerMax: 3, middle: 0, middleMax: 3 },
    weeklyResetDate: weekStr(),
    dailyResetDate: todayStr(),
    createdAt: Date.now(),
    hidden: false,
    hiddenContents: {},
  };
}

/** 캐릭터를 저장된 순서로 정렬, 미등록 캐릭터는 뒤에 생성일 기준 */
export function sortCharacters(characters: Character[], order: string[]): Character[] {
  const idx = new Map(order.map((id, i) => [id, i]));
  return characters.slice().sort((a, b) => {
    const ai = idx.get(a.id);
    const bi = idx.get(b.id);
    if (ai != null && bi != null) return ai - bi;
    if (ai != null) return -1;
    if (bi != null) return 1;
    return (a.createdAt ?? 0) - (b.createdAt ?? 0);
  });
}

/** 주간 콘텐츠 진행률 (V4.0.9 weeklyScore — 사용한 횟수 / 가능한 횟수) */
export function weeklyScore(c: Character, db: DbSettings): { done: number; total: number; pct: number } {
  let done = 0;
  let total = 0;
  // 레이드 4종: reward + boss (잔여를 사용으로 환산: (max - cur))
  (["expedition", "transcend", "sanctuary_ludra", "sanctuary_bagot"] as const).forEach((k) => {
    const r = c[k];
    if (!r) return;
    const maxR = (r.rewardBase ?? 0) + (r.rewardExtra ?? 0);
    const maxB = (r.bossBase ?? 0) + (r.bossExtra ?? 0);
    total += maxR + maxB;
    done += Math.max(0, maxR - (r.reward ?? maxR)) + Math.max(0, maxB - (r.boss ?? maxB));
  });
  // 각성
  const aMax = db.awakening.weeklyTickets + (c.awakening?.ticketsExtra ?? 0);
  total += aMax;
  done += Math.max(0, aMax - (c.awakening?.tickets ?? aMax));
  // 회랑
  const lMax = c.corridor?.lowerMax ?? 3;
  const mMax = c.corridor?.middleMax ?? 3;
  total += lMax + mMax;
  done += (c.corridor?.lower ?? 0) + (c.corridor?.middle ?? 0);
  // 상점은 계정 단위라 캐릭터 weeklyScore에서 제외 (V4.0.9 동일)
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return { done, total, pct };
}

/** 전체 키나 합계 (excluded 제외) */
export function getTotalKina(accounts: Account[], characters: Character[]): number {
  let total = 0;
  for (const a of accounts) {
    const srvs = [...new Set(characters.filter((c) => c.accountId === a.id).map((c) => c.server || ""))];
    for (const s of srvs) {
      const sd = a.servers?.[s];
      if (!sd || sd.kinaExcluded) continue;
      total += sd.kina || 0;
    }
  }
  return total;
}
