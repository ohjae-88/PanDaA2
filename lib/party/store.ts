"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type {
  Player, PartyCharacter, PartyState, PartyGroup, PartyServer,
  Participant, DistributeRule, GeneratedSet, GeneratedParty, GeneratedSlot, ComposeMode, UnassignedItem,
} from "./types";
import { DEFAULT_PARTY_SERVERS } from "./constants";

export const SLOTS_PER_PARTY = 4;

function uidShort(prefix = "x") { return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`; }

function mkSlot(): GeneratedSlot { return { playerId: null, charId: null, isOpen: true }; }
function mkParty(i: number): GeneratedParty {
  return { name: `파티 ${i + 1}`, slots: Array.from({ length: SLOTS_PER_PARTY }, mkSlot) };
}
function mkSet(i: number, partyCount: number): GeneratedSet {
  return { id: uidShort("s"), name: `세트 ${i + 1}`, parties: Array.from({ length: partyCount }, (_, j) => mkParty(j)) };
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function uid(prefix = "p"): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export function mkGroup(name: string): PartyGroup {
  return {
    id: uid("g"),
    name,
    participants: [],
    distributeRules: [],
    setCount: 2,
    partyCount: 2,
    composeMode: "balanced",
    generatedSets: [],
    composed: false,
    allowDup: false,
  };
}

type PoolItem = { player: Player; char: PartyCharacter; charId: string; isMain: boolean };

function buildAllSets(g: PartyGroup, players: Player[]): GeneratedSet[] {
  const { participants, setCount, partyCount, composeMode, distributeRules, allowDup } = g;

  // 규칙 분류 — 사용자 정의 순서(distributeRules 순) 유지
  const setRules = distributeRules.filter((r) => r.type === "set");
  const classRules = distributeRules.filter((r) => r.type === "class");
  const mainRules = distributeRules.filter((r) => r.type === "main");
  const setExcludeRules = setRules.filter((r) => r.mode === "exclude");
  const setIncludeRules = setRules.filter((r) => r.mode === "include");
  const mainSetRules = mainRules.filter((r) => r.scope === "set");
  const mainPartyRules = mainRules.filter((r) => r.scope === "party");
  const classSetRules = classRules.filter((r) => !r.partyIndices || r.partyIndices.length === 0);
  const classPartyRules = classRules.filter((r) => r.partyIndices && r.partyIndices.length > 0);

  // 참가자별 본/부 캐릭터 풀 — 소비 가능한 chars (allowDup=true면 보존)
  type PPool = { mains: string[]; subs: string[]; };
  const ppOrig = new Map<string, PPool>();
  participants.forEach((pc) => {
    const player = players.find((x) => x.id === pc.playerId);
    if (!player) { ppOrig.set(pc.playerId, { mains: [], subs: [] }); return; }
    const mains: string[] = [];
    const subs: string[] = [];
    pc.selectedCharIds.forEach((cid) => {
      const c = player.characters.find((x) => x.id === cid);
      if (!c) return;
      // 본케 우선 안에서 cp 내림차순
      (c.type === "main" ? mains : subs).push(cid);
    });
    // cp 내림차순으로 정렬 (좋은 캐릭터 우선)
    const cpOf = (cid: string): number => player.characters.find((c) => c.id === cid)?.cp ?? 0;
    mains.sort((a, b) => cpOf(b) - cpOf(a));
    subs.sort((a, b) => cpOf(b) - cpOf(a));
    ppOrig.set(pc.playerId, { mains, subs });
  });
  // 작업용 가변 풀
  const pp = new Map<string, PPool>();
  ppOrig.forEach((v, k) => pp.set(k, { mains: v.mains.slice(), subs: v.subs.slice() }));

  function takeFrom(pid: string, kind: "main" | "sub" | "any", preferJob?: string): string | null {
    const pool = pp.get(pid);
    if (!pool) return null;
    const player = players.find((x) => x.id === pid);
    if (!player) return null;
    function tryList(list: string[]): string | null {
      // 우선 직업 매치
      if (preferJob) {
        for (let i = 0; i < list.length; i++) {
          const c = player!.characters.find((x) => x.id === list[i]);
          if (c?.job === preferJob) {
            const [taken] = list.splice(i, 1);
            return taken;
          }
        }
      }
      return list.length ? list.shift()! : null;
    }
    if (kind === "main") return tryList(pool.mains);
    if (kind === "sub") return tryList(pool.subs);
    // any: prefer main first, then sub
    return tryList(pool.mains) ?? tryList(pool.subs);
  }

  // composeMode=random일 때 참가자 순서 셔플
  function getParticipantOrder(): Participant[] {
    if (composeMode === "random") return shuffle(participants);
    return participants;
  }

  // 한 세트의 mainSetRule 적용 가능한 최소/최대값 계산
  function mainTargetsFor(si: number): { min: number; max: number } {
    let min = 0;
    let max = Number.MAX_SAFE_INTEGER;
    for (const r of mainSetRules) {
      const targets = r.targetIndices && r.targetIndices.length ? r.targetIndices : Array.from({ length: setCount }, (_, i) => i);
      if (!targets.includes(si)) continue;
      if (r.minCount !== undefined && r.minCount !== null) min = Math.max(min, r.minCount);
      if (r.maxCount !== undefined && r.maxCount !== null) max = Math.min(max, r.maxCount);
    }
    return { min, max: max === Number.MAX_SAFE_INTEGER ? participants.length : max };
  }

  return Array.from({ length: setCount }, (_, si) => {
    const setPool: PoolItem[] = [];
    const addedPlayers = new Set<string>();
    const { min: minM, max: maxM } = mainTargetsFor(si);
    let mainCount = 0;

    function addToPool(pid: string, charId: string): boolean {
      const player = players.find((x) => x.id === pid);
      if (!player) return false;
      const char = player.characters.find((c) => c.id === charId);
      if (!char) return false;
      const isMain = char.type === "main";
      setPool.push({ player, char, charId, isMain });
      addedPlayers.add(pid);
      if (isMain) mainCount++;
      return true;
    }

    // (1) setInclude 규칙 우선
    for (const r of setIncludeRules) {
      if (!(r.setIndices ?? []).includes(si)) continue;
      for (const forcedPid of r.playerIds ?? []) {
        if (addedPlayers.has(forcedPid)) continue;
        // 본/부 부족 여부 따라 선택
        const wantMain = mainCount < minM;
        const cid = takeFrom(forcedPid, wantMain ? "main" : "any");
        if (cid) addToPool(forcedPid, cid);
      }
    }

    // (2) classSetRules 충족: 특정 직업 최소 인원
    for (const r of classSetRules) {
      const setIdxList = r.setIndices && r.setIndices.length ? r.setIndices : Array.from({ length: setCount }, (_, i) => i);
      if (!setIdxList.includes(si)) continue;
      const jobs = r.jobs ?? [];
      const minN = r.minCount ?? 0;
      if (minN <= 0 || jobs.length === 0) continue;
      let placedThis = setPool.filter((x) => jobs.includes(x.char.job)).length;
      for (const pc of getParticipantOrder()) {
        if (placedThis >= minN) break;
        if (addedPlayers.has(pc.playerId)) continue;
        if (setExcludeRules.some((rr) => (rr.setIndices ?? []).includes(si) && (rr.playerIds ?? []).includes(pc.playerId))) continue;
        for (const job of jobs) {
          const cid = takeFrom(pc.playerId, "any", job);
          if (cid) {
            const char = players.find((x) => x.id === pc.playerId)?.characters.find((c) => c.id === cid);
            if (char && jobs.includes(char.job)) {
              addToPool(pc.playerId, cid);
              placedThis++;
              break;
            } else if (cid) {
              // not matching job — put back? takeFrom shifted; can't easily restore.
              // 직업 매칭 못 한 경우 그냥 풀에 넣음 (다른 룰 처리에서 활용)
              addToPool(pc.playerId, cid);
            }
          }
        }
      }
    }

    // (3) 일반 참가자 — setExclude 제외, 본/부 비율 목표 충족 우선
    for (const pc of getParticipantOrder()) {
      if (addedPlayers.has(pc.playerId)) continue;
      if (setExcludeRules.some((r) => (r.setIndices ?? []).includes(si) && (r.playerIds ?? []).includes(pc.playerId))) continue;
      const pool = pp.get(pc.playerId);
      if (!pool || (!pool.mains.length && !pool.subs.length)) continue;

      let kind: "main" | "sub" | "any";
      if (mainCount < minM && pool.mains.length > 0) kind = "main";
      else if (mainCount >= maxM && pool.subs.length > 0) kind = "sub";
      else {
        // 범위 내 — 본/부 균형 위해 본케가 부족하면 본케, 아니면 부케 시도
        const remain = participants.length - addedPlayers.size;  // 남은 참가자 슬롯
        const needMore = Math.max(0, minM - mainCount);
        kind = (needMore > 0 && pool.mains.length > 0)
          ? "main"
          : (mainCount < maxM && remain > (maxM - mainCount) && pool.subs.length > 0)
            ? "sub"
            : "any";
        void remain; void needMore;
      }
      const cid = takeFrom(pc.playerId, kind);
      if (cid) addToPool(pc.playerId, cid);
    }

    // (4) allowDup=true면 풀 복원 (다음 세트도 같은 charId 사용 가능)
    if (allowDup) {
      ppOrig.forEach((v, k) => pp.set(k, { mains: v.mains.slice(), subs: v.subs.slice() }));
    }

    void mainCount;

    // 풀 → 파티 분배
    const { parties } = buildParties(setPool, partyCount, composeMode, classPartyRules, mainPartyRules);

    return { id: uidShort("s"), name: `세트 ${si + 1}`, parties };
  });
}

function buildParties(
  pool: PoolItem[],
  partyCount: number,
  mode: ComposeMode,
  classRules: DistributeRule[],
  partyMainRules: DistributeRule[] = []
): { parties: GeneratedParty[] } {
  const parties: GeneratedParty[] = Array.from({ length: partyCount }, (_, i) => mkParty(i));
  // 풀 아이템 → 추적용 키 (charId)
  const placedByParty = new Map<number, PoolItem[]>();
  for (let i = 0; i < partyCount; i++) placedByParty.set(i, []);
  let remaining = mode === "random" ? shuffle(pool) : pool.slice();

  // 직업 규칙 maxCount 캡 사전 구성 — (partyIdx, job) → max
  const jobCapsByParty = new Map<number, Map<string, number>>();
  classRules.forEach((r) => {
    const maxN = r.maxCount;
    if (maxN === undefined || maxN === null) return;
    const partyIdxList = r.partyIndices ?? [];
    const jobs = r.jobs ?? [];
    partyIdxList.forEach((pi) => {
      if (pi < 0 || pi >= partyCount) return;
      const m = jobCapsByParty.get(pi) ?? new Map<string, number>();
      jobs.forEach((j) => {
        const prev = m.get(j);
        m.set(j, prev === undefined ? maxN : Math.min(prev, maxN));
      });
      jobCapsByParty.set(pi, m);
    });
  });

  function countJobInParty(partyIdx: number, job: string): number {
    return (placedByParty.get(partyIdx) ?? []).filter((x) => x.char.job === job).length;
  }
  function isCapped(partyIdx: number, item: PoolItem): boolean {
    const caps = jobCapsByParty.get(partyIdx);
    if (!caps) return false;
    const cap = caps.get(item.char.job);
    if (cap === undefined) return false;
    return countJobInParty(partyIdx, item.char.job) >= cap;
  }
  function assign(partyIdx: number, item: PoolItem, force = false): boolean {
    if (!force && isCapped(partyIdx, item)) return false;
    const slots = parties[partyIdx].slots;
    const si = slots.findIndex((s) => s.isOpen && !s.playerId);
    if (si < 0) return false;
    slots[si] = { playerId: item.player.id, charId: item.charId, isOpen: false };
    placedByParty.get(partyIdx)!.push(item);
    return true;
  }

  // 1) 직업 규칙 — 최소 인원 강제 배치 (min은 cap 무시; max와 충돌 시 min 우선)
  for (const r of classRules) {
    const partyIdxList = r.partyIndices ?? [];
    const jobs = r.jobs ?? [];
    const minN = r.minCount ?? 0;
    if (minN <= 0) continue;
    for (const pi of partyIdxList) {
      if (pi < 0 || pi >= partyCount) continue;
      let placed = countJobInParty(pi, "");  // 시작 시 0
      placed = (placedByParty.get(pi) ?? []).filter((x) => jobs.includes(x.char.job)).length;
      for (let i = 0; i < remaining.length && placed < minN; i++) {
        const it = remaining[i];
        if (!jobs.includes(it.char.job)) continue;
        if (assign(pi, it, true)) {  // force=true: 최소는 cap 무시
          remaining.splice(i, 1);
          i--; placed++;
        }
      }
    }
  }

  // 2) balanced: 각 파티에 본케 1명 우선
  if (mode === "balanced") {
    for (let pi = 0; pi < partyCount; pi++) {
      const hasM = placedByParty.get(pi)!.some((x) => x.isMain);
      if (hasM) continue;
      const mi = remaining.findIndex((x) => x.isMain);
      if (mi >= 0) {
        if (assign(pi, remaining[mi])) remaining.splice(mi, 1);
      }
    }
  }

  // 3) 잔여 풀 배치
  const carryOver: PoolItem[] = [];
  for (const it of remaining) {
    let placed = false;
    for (let pi = 0; pi < partyCount; pi++) {
      if (assign(pi, it)) { placed = true; break; }
    }
    if (!placed) carryOver.push(it);
  }

  // 4) party main 규칙 적용 — 본/부 비율 맞추기 (파티 간 스왑)
  for (const r of partyMainRules) {
    const targets = r.targetIndices && r.targetIndices.length ? r.targetIndices : Array.from({ length: partyCount }, (_, i) => i);
    const minM = r.minCount ?? 0;
    const maxM = r.maxCount ?? 4;
    for (const pi of targets) {
      if (pi < 0 || pi >= partyCount) continue;
      let mainNow = placedByParty.get(pi)!.filter((x) => x.isMain).length;
      // min 부족 → 다른 파티의 본케와 스왑
      while (mainNow < minM) {
        const swapped = swapMainBetweenParties(pi, true, parties, placedByParty, partyCount);
        if (!swapped) break;
        mainNow++;
      }
      // max 초과 → 본케를 다른 파티 부케와 스왑
      while (mainNow > maxM) {
        const swapped = swapMainBetweenParties(pi, false, parties, placedByParty, partyCount);
        if (!swapped) break;
        mainNow--;
      }
    }
  }

  // carryOver는 저장하지 않음 — UA는 렌더 시 computePerSetUa로 계산됨 (V4.0.9 동일)
  void carryOver;
  return { parties };
}

/** V4.0.9 renderUA 규칙 (lines 6472–6504) — 렌더 시 세트별 UA 계산.
 *  - 이 세트의 슬롯에 배치된 playerId는 UA에 등장 안 함 (한 세트당 한 플레이어 1회 원칙)
 *  - 모든 세트의 슬롯에 배치된 charId는 어디에도 UA에 등장 안 함 (전역 dedup)
 *  - 즉 "현 세트 슬롯에 미배치된 플레이어"의 "전역에서 미사용 캐릭터"만 노출 */
export function computePerSetUa(
  setIdx: number,
  generatedSets: GeneratedSet[],
  participants: Participant[]
): UnassignedItem[] {
  const set = generatedSets[setIdx];
  if (!set) return [];
  const usedPidsInThisSet = new Set<string>();
  set.parties.forEach((p) => p.slots.forEach((sl) => { if (sl.playerId) usedPidsInThisSet.add(sl.playerId); }));
  const globallyUsedCids = new Set<string>();
  generatedSets.forEach((gs) => gs.parties.forEach((pt) => pt.slots.forEach((sl) => { if (sl.charId) globallyUsedCids.add(sl.charId); })));
  const out: UnassignedItem[] = [];
  participants.forEach((pc) => {
    if (usedPidsInThisSet.has(pc.playerId)) return;  // 이 세트에 이미 슬롯 차지 — UA 노출 안 함
    pc.selectedCharIds.forEach((cid) => {
      if (globallyUsedCids.has(cid)) return;  // 전역 어디든 슬롯에 있음 — 노출 안 함
      out.push({ playerId: pc.playerId, charId: cid });
    });
  });
  return out;
}

/** dir=true: pi 파티에 본케 추가 (다른 파티의 본케 ↔ pi 파티의 부케). dir=false: 역방향. */
function swapMainBetweenParties(
  pi: number,
  dir: boolean,
  parties: GeneratedParty[],
  placedByParty: Map<number, PoolItem[]>,
  partyCount: number
): boolean {
  const here = placedByParty.get(pi)!;
  const target = here.findIndex((x) => x.isMain === !dir);  // pi에서 빼낼 후보
  if (target < 0) return false;
  for (let qi = 0; qi < partyCount; qi++) {
    if (qi === pi) continue;
    const there = placedByParty.get(qi)!;
    const swapIdx = there.findIndex((x) => x.isMain === dir);
    if (swapIdx < 0) continue;
    // 슬롯 위치 찾아 교환
    const a = here[target];
    const b = there[swapIdx];
    const slotA = parties[pi].slots.findIndex((s) => s.charId === a.charId);
    const slotB = parties[qi].slots.findIndex((s) => s.charId === b.charId);
    if (slotA < 0 || slotB < 0) continue;
    parties[pi].slots[slotA] = { playerId: b.player.id, charId: b.charId, isOpen: false };
    parties[qi].slots[slotB] = { playerId: a.player.id, charId: a.charId, isOpen: false };
    here[target] = b;
    there[swapIdx] = a;
    return true;
  }
  return false;
}

type Store = PartyState & {
  // 플레이어
  addPlayer: (name: string) => string;
  removePlayer: (pid: string) => void;
  renamePlayer: (pid: string, name: string) => void;
  reorderPlayers: (srcId: string, tgtId: string) => void;

  // 캐릭터
  upsertCharacter: (pid: string, c: PartyCharacter) => void;
  removeCharacter: (pid: string, cid: string) => void;
  patchCharacter: (pid: string, cid: string, patch: Partial<PartyCharacter>) => void;

  // 서버
  setServers: (list: PartyServer[]) => void;
  setDefaultServerId: (id: number | null) => void;

  // 그룹
  upsertGroup: (g: PartyGroup) => void;
  removeGroup: (gid: string) => void;
  setActiveGroupId: (gid: string) => void;
  addGroup: (name?: string) => string;
  renameGroup: (gid: string, name: string) => void;

  // 그룹 설정
  patchGroup: (gid: string, patch: Partial<PartyGroup>) => void;

  // 참가자
  addParticipants: (gid: string, playerIds: string[]) => void;
  removeParticipant: (gid: string, playerId: string) => void;
  toggleParticipantChar: (gid: string, playerId: string, charId: string) => void;
  setParticipantChars: (gid: string, playerId: string, charIds: string[]) => void;

  // 분배 규칙
  upsertRule: (gid: string, rule: DistributeRule) => void;
  removeRule: (gid: string, ruleId: string) => void;
  /** 규칙 순서 변경 — 드래그앤드롭으로 사용. srcId 항목을 tgtId 항목 위치로 이동 */
  reorderRule: (gid: string, srcId: string, tgtId: string) => void;

  // 결과 보드
  autoCompose: (gid: string) => string | null;  // 오류 시 메시지 반환
  clearComposed: (gid: string) => void;
  renameSet: (gid: string, setId: string, name: string) => void;
  renameParty: (gid: string, setId: string, partyIdx: number, name: string) => void;
  setSlot: (gid: string, setId: string, partyIdx: number, slotIdx: number, slot: GeneratedSlot) => void;
  swapSlots: (gid: string, a: { setId: string; partyIdx: number; slotIdx: number }, b: { setId: string; partyIdx: number; slotIdx: number }) => void;
  clearSlot: (gid: string, setId: string, partyIdx: number, slotIdx: number) => void;
  toggleSlotOpen: (gid: string, setId: string, partyIdx: number, slotIdx: number) => void;
  /** 미배치 항목(playerId+charId)을 슬롯에 배치. allowDup=false면 다른 슬롯의 동일 charId는 공석화 */
  placeUnassigned: (gid: string, setId: string, partyIdx: number, slotIdx: number, playerId: string, charId: string) => void;
  /** 슬롯의 캐릭터를 미배치 풀로 회수 (= 슬롯 공석화) — UA는 자동 계산되므로 단순 clear */
  returnSlotToUnassigned: (gid: string, setId: string, partyIdx: number, slotIdx: number) => void;
  /** 세트 초기화 — 모든 슬롯의 캐릭터를 미배치 풀로 회수 */
  resetSet: (gid: string, setId: string) => void;
  /** 파티 초기화 — 해당 파티의 캐릭터만 미배치 풀로 회수 */
  resetParty: (gid: string, setId: string, partyIdx: number) => void;
  /** 세트 복제 */
  duplicateSet: (gid: string, setId: string) => void;
  /** 참가자/캐릭터 변경을 모든 세트의 배치/미배치에 동기화 */
  applyParticipants: (gid: string) => void;
  /** 세트 수/파티 수 변경 — 적용 시 generatedSets 모양 조정, 잘려나가는 캐릭터는 첫 세트 미배치로 회수 */
  applySetPartyConfig: (gid: string, setCount: number, partyCount: number) => void;
  /** 캐릭터를 특정 슬롯에 직접 배치 (참가자에 없으면 자동 등록) */
  placeCharToSlot: (gid: string, setId: string, partyIdx: number, slotIdx: number, playerId: string, charId: string) => void;

  // 일괄
  importAllFromFile: (data: Partial<PartyState>) => void;
  importDBOnly: (players: Player[]) => void;
};

const defaultState: PartyState = {
  players: [],
  groups: [],
  activeGroupId: null,
  servers: DEFAULT_PARTY_SERVERS,
  defaultServerId: null,
};

export const usePartyStore = create<Store>()(
  persist(
    (set, get) => ({
      ...defaultState,

      addPlayer: (name) => {
        const id = uid("pl");
        set((s) => ({ players: [...s.players, { id, name: name.trim() || "플레이어", characters: [] }] }));
        return id;
      },
      removePlayer: (pid) =>
        set((s) => ({ players: s.players.filter((p) => p.id !== pid) })),
      renamePlayer: (pid, name) =>
        set((s) => ({
          players: s.players.map((p) => (p.id === pid ? { ...p, name: name.trim() || p.name } : p)),
        })),
      reorderPlayers: (srcId, tgtId) =>
        set((s) => {
          const arr = s.players.slice();
          const si = arr.findIndex((p) => p.id === srcId);
          const ti = arr.findIndex((p) => p.id === tgtId);
          if (si < 0 || ti < 0) return {};
          const [r] = arr.splice(si, 1);
          arr.splice(ti, 0, r);
          return { players: arr };
        }),

      upsertCharacter: (pid, c) =>
        set((s) => {
          const players = s.players.map((p) => {
            if (p.id !== pid) return p;
            const idx = p.characters.findIndex((x) => x.id === c.id);
            const arr = p.characters.slice();
            if (idx < 0) arr.push(c);
            else arr[idx] = c;
            return { ...p, characters: arr };
          });
          return { players };
        }),
      removeCharacter: (pid, cid) =>
        set((s) => ({
          players: s.players.map((p) =>
            p.id === pid ? { ...p, characters: p.characters.filter((c) => c.id !== cid) } : p
          ),
        })),
      patchCharacter: (pid, cid, patch) =>
        set((s) => ({
          players: s.players.map((p) =>
            p.id === pid
              ? { ...p, characters: p.characters.map((c) => (c.id === cid ? { ...c, ...patch } : c)) }
              : p
          ),
        })),

      setServers: (list) => set({ servers: list }),
      setDefaultServerId: (id) => set({ defaultServerId: id }),

      upsertGroup: (g) =>
        set((s) => {
          const idx = s.groups.findIndex((x) => x.id === g.id);
          const next = s.groups.slice();
          if (idx < 0) next.push(g);
          else next[idx] = g;
          return { groups: next, activeGroupId: s.activeGroupId ?? g.id };
        }),
      removeGroup: (gid) =>
        set((s) => {
          const next = s.groups.filter((g) => g.id !== gid);
          const active = s.activeGroupId === gid ? (next[0]?.id ?? null) : s.activeGroupId;
          return { groups: next, activeGroupId: active };
        }),
      setActiveGroupId: (gid) => set({ activeGroupId: gid }),
      addGroup: (name) => {
        const g = mkGroup(name?.trim() || `그룹 ${get().groups.length + 1}`);
        set((s) => ({ groups: [...s.groups, g], activeGroupId: s.activeGroupId ?? g.id }));
        return g.id;
      },
      renameGroup: (gid, name) =>
        set((s) => ({ groups: s.groups.map((g) => (g.id === gid ? { ...g, name: name.trim() || g.name } : g)) })),

      patchGroup: (gid, patch) =>
        set((s) => ({ groups: s.groups.map((g) => (g.id === gid ? { ...g, ...patch } : g)) })),

      addParticipants: (gid, playerIds) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            const existing = new Set(g.participants.map((p) => p.playerId));
            const toAdd: Participant[] = playerIds
              .filter((pid) => !existing.has(pid))
              .map((pid) => {
                const player = s.players.find((p) => p.id === pid);
                // 기본 선택: 본케 전체
                const mains = player?.characters.filter((c) => c.type === "main").map((c) => c.id) ?? [];
                return { playerId: pid, selectedCharIds: mains };
              });
            return { ...g, participants: [...g.participants, ...toAdd] };
          }),
        })),
      removeParticipant: (gid, playerId) =>
        set((s) => ({
          groups: s.groups.map((g) => (g.id === gid ? { ...g, participants: g.participants.filter((p) => p.playerId !== playerId) } : g)),
        })),
      toggleParticipantChar: (gid, playerId, charId) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            return {
              ...g,
              participants: g.participants.map((p) => {
                if (p.playerId !== playerId) return p;
                const has = p.selectedCharIds.includes(charId);
                return { ...p, selectedCharIds: has ? p.selectedCharIds.filter((x) => x !== charId) : [...p.selectedCharIds, charId] };
              }),
            };
          }),
        })),
      setParticipantChars: (gid, playerId, charIds) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === gid
              ? { ...g, participants: g.participants.map((p) => (p.playerId === playerId ? { ...p, selectedCharIds: charIds } : p)) }
              : g
          ),
        })),

      upsertRule: (gid, rule) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            const idx = g.distributeRules.findIndex((r) => r.id === rule.id);
            const arr = g.distributeRules.slice();
            if (idx < 0) arr.push(rule); else arr[idx] = rule;
            return { ...g, distributeRules: arr };
          }),
        })),
      removeRule: (gid, ruleId) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === gid ? { ...g, distributeRules: g.distributeRules.filter((r) => r.id !== ruleId) } : g
          ),
        })),
      reorderRule: (gid, srcId, tgtId) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            const arr = g.distributeRules.slice();
            const si = arr.findIndex((r) => r.id === srcId);
            const ti = arr.findIndex((r) => r.id === tgtId);
            if (si < 0 || ti < 0 || si === ti) return g;
            const [moved] = arr.splice(si, 1);
            arr.splice(ti, 0, moved);
            return { ...g, distributeRules: arr };
          }),
        })),

      autoCompose: (gid) => {
        const state = get();
        const g = state.groups.find((x) => x.id === gid);
        if (!g) return "그룹을 찾을 수 없습니다.";
        if (!g.participants.length) return "참가자를 추가하세요.";
        const noChar = g.participants
          .filter((pc) => !pc.selectedCharIds.length)
          .map((pc) => state.players.find((p) => p.id === pc.playerId)?.name ?? "?");
        if (noChar.length) return `캐릭터 미선택: ${noChar.join(", ")}`;
        const sets = buildAllSets(g, state.players);
        set((s) => ({
          groups: s.groups.map((x) => (x.id === gid ? { ...x, generatedSets: sets, composed: true } : x)),
        }));
        return null;
      },
      clearComposed: (gid) =>
        set((s) => ({
          groups: s.groups.map((g) => (g.id === gid ? { ...g, generatedSets: [], composed: false } : g)),
        })),
      renameSet: (gid, setId, name) =>
        set((s) => ({
          groups: s.groups.map((g) =>
            g.id === gid
              ? { ...g, generatedSets: g.generatedSets.map((st) => (st.id === setId ? { ...st, name: name.trim() || st.name } : st)) }
              : g
          ),
        })),
      renameParty: (gid, setId, partyIdx, name) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            return {
              ...g,
              generatedSets: g.generatedSets.map((st) =>
                st.id === setId
                  ? {
                      ...st,
                      parties: st.parties.map((p, i) => (i === partyIdx ? { ...p, name: name.trim() || p.name } : p)),
                    }
                  : st
              ),
            };
          }),
        })),
      setSlot: (gid, setId, partyIdx, slotIdx, slot) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            return {
              ...g,
              generatedSets: g.generatedSets.map((st) => {
                if (st.id !== setId) return st;
                return {
                  ...st,
                  parties: st.parties.map((p, i) => {
                    if (i !== partyIdx) return p;
                    const slots = p.slots.slice();
                    slots[slotIdx] = slot;
                    return { ...p, slots };
                  }),
                };
              }),
            };
          }),
        })),
      clearSlot: (gid, setId, partyIdx, slotIdx) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            return {
              ...g,
              generatedSets: g.generatedSets.map((st) => {
                if (st.id !== setId) return st;
                return {
                  ...st,
                  parties: st.parties.map((p, i) => {
                    if (i !== partyIdx) return p;
                    const slots = p.slots.slice();
                    slots[slotIdx] = mkSlot();
                    return { ...p, slots };
                  }),
                };
              }),
            };
          }),
        })),
      toggleSlotOpen: (gid, setId, partyIdx, slotIdx) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            return {
              ...g,
              generatedSets: g.generatedSets.map((st) => {
                if (st.id !== setId) return st;
                return {
                  ...st,
                  parties: st.parties.map((p, i) => {
                    if (i !== partyIdx) return p;
                    const slots = p.slots.slice();
                    const cur = slots[slotIdx];
                    if (cur.playerId) {
                      slots[slotIdx] = mkSlot();  // 채워진 슬롯은 비우기
                    } else {
                      slots[slotIdx] = { ...cur, isOpen: !cur.isOpen };
                    }
                    return { ...p, slots };
                  }),
                };
              }),
            };
          }),
        })),
      /** UA → 슬롯 배치. V4.0.9: 같은 파티에 동일 플레이어 중복 방지, allowDup=false면 다른 곳의 같은 charId 공석화 */
      placeUnassigned: (gid, setId, partyIdx, slotIdx, playerId, charId) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            const allowDup = g.allowDup;
            return {
              ...g,
              generatedSets: g.generatedSets.map((st) => {
                if (st.id !== setId) return st;
                // 같은 파티에 동일 플레이어가 이미 있으면 (다른 슬롯에) 배치 거부
                const samePartyDup = st.parties[partyIdx].slots.some((sl, i) => i !== slotIdx && sl.playerId === playerId);
                if (samePartyDup) return st;
                const parties = st.parties.map((p, pi) => {
                  const slots = p.slots.map((sl, si) => {
                    if (pi === partyIdx && si === slotIdx) {
                      return { playerId, charId, isOpen: false } as GeneratedSlot;
                    }
                    // allowDup=false: 같은 세트 내 다른 슬롯의 동일 charId 제거 (이동 효과)
                    if (!allowDup && sl.charId === charId) {
                      return { playerId: null, charId: null, isOpen: true } as GeneratedSlot;
                    }
                    return sl;
                  });
                  return { ...p, slots };
                });
                return { ...st, parties };
              }),
            };
          }),
        })),
      /** 슬롯 공석화. UA는 자동 계산되므로 별도 저장 안 함 */
      returnSlotToUnassigned: (gid, setId, partyIdx, slotIdx) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            return {
              ...g,
              generatedSets: g.generatedSets.map((st) => {
                if (st.id !== setId) return st;
                return {
                  ...st,
                  parties: st.parties.map((p, i) => {
                    if (i !== partyIdx) return p;
                    const slots = p.slots.slice();
                    slots[slotIdx] = { playerId: null, charId: null, isOpen: true };
                    return { ...p, slots };
                  }),
                };
              }),
            };
          }),
        })),
      /** V4.0.9 applyCSKeep — 참가자/캐릭터 변경 후 슬롯 정리.
       *  selectedCharIds에 더 이상 없는 (playerId, charId) 조합은 슬롯 공석화.
       *  UA는 저장하지 않으므로 별도 처리 불필요 (computePerSetUa가 selectedCharIds 기반으로 자동 반영). */
      applyParticipants: (gid) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            if (!g.composed || !g.generatedSets.length) return g;
            const valid = new Set<string>();
            g.participants.forEach((pc) => pc.selectedCharIds.forEach((cid) => valid.add(pc.playerId + ":" + cid)));

            const sets = g.generatedSets.map((st) => {
              const parties = st.parties.map((p) => {
                const slots = p.slots.map((sl) => {
                  if (sl.playerId && sl.charId) {
                    const key = sl.playerId + ":" + sl.charId;
                    if (!valid.has(key)) {
                      return { playerId: null, charId: null, isOpen: true } as GeneratedSlot;
                    }
                  }
                  return sl;
                });
                return { ...p, slots };
              });
              return { ...st, parties };
            });

            return { ...g, generatedSets: sets };
          }),
        })),

      applySetPartyConfig: (gid, setCount, partyCount) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            const nextSetCount = Math.max(1, Math.min(10, setCount));
            const nextPartyCount = Math.max(1, Math.min(4, partyCount));

            if (!g.composed || !g.generatedSets.length) {
              // 단순 설정 갱신만
              return { ...g, setCount: nextSetCount, partyCount: nextPartyCount };
            }

            // 세트 수 조정 — 잘린 세트의 슬롯은 단순히 사라짐 (UA는 자동 재계산되므로 회수 불필요)
            let sets = g.generatedSets.slice();
            if (sets.length > nextSetCount) {
              sets = sets.slice(0, nextSetCount);
            } else if (sets.length < nextSetCount) {
              while (sets.length < nextSetCount) {
                sets.push(mkSet(sets.length, nextPartyCount));
              }
            }
            // 파티 수 조정
            sets = sets.map((st) => {
              let parties = st.parties.slice();
              if (parties.length > nextPartyCount) {
                parties = parties.slice(0, nextPartyCount);
              } else if (parties.length < nextPartyCount) {
                while (parties.length < nextPartyCount) {
                  parties.push({ name: `파티 ${parties.length + 1}`, slots: Array.from({ length: SLOTS_PER_PARTY }, mkSlot) });
                }
              }
              return { ...st, parties };
            });

            return { ...g, setCount: nextSetCount, partyCount: nextPartyCount, generatedSets: sets };
          }),
        })),

      placeCharToSlot: (gid, setId, partyIdx, slotIdx, playerId, charId) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            // 참가자에 없으면 자동 등록
            let participants = g.participants;
            const idx = participants.findIndex((pc) => pc.playerId === playerId);
            if (idx < 0) {
              participants = [...participants, { playerId, selectedCharIds: [charId] }];
            } else if (!participants[idx].selectedCharIds.includes(charId)) {
              participants = participants.map((pc) =>
                pc.playerId === playerId
                  ? { ...pc, selectedCharIds: [...pc.selectedCharIds, charId] }
                  : pc
              );
            }
            const sets = g.generatedSets.map((st) => {
              if (st.id !== setId) return st;
              // 다른 슬롯에 이미 배치되어 있으면 그 슬롯도 공석화 (이동 효과)
              const parties = st.parties.map((p, pi) => {
                const slots = p.slots.map((sl, si) => {
                  if (pi === partyIdx && si === slotIdx) {
                    return { playerId, charId, isOpen: false } as GeneratedSlot;
                  }
                  if (sl.charId === charId) {
                    return { playerId: null, charId: null, isOpen: true } as GeneratedSlot;
                  }
                  return sl;
                });
                return { ...p, slots };
              });
              return { ...st, parties };
            });
            return { ...g, participants, generatedSets: sets, composed: true };
          }),
        })),

      resetSet: (gid, setId) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            return {
              ...g,
              generatedSets: g.generatedSets.map((st) => {
                if (st.id !== setId) return st;
                const parties = st.parties.map((p) => ({
                  ...p,
                  slots: p.slots.map(() => ({ playerId: null, charId: null, isOpen: true } as GeneratedSlot)),
                }));
                return { ...st, parties };
              }),
            };
          }),
        })),
      resetParty: (gid, setId, partyIdx) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            return {
              ...g,
              generatedSets: g.generatedSets.map((st) => {
                if (st.id !== setId) return st;
                const parties = st.parties.map((p, i) => {
                  if (i !== partyIdx) return p;
                  return { ...p, slots: p.slots.map(() => ({ playerId: null, charId: null, isOpen: true } as GeneratedSlot)) };
                });
                return { ...st, parties };
              }),
            };
          }),
        })),
      duplicateSet: (gid, setId) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            const orig = g.generatedSets.find((st) => st.id === setId);
            if (!orig) return g;
            const copy: GeneratedSet = {
              id: uidShort("s"),
              name: orig.name + " 복사",
              parties: orig.parties.map((p) => ({ ...p, slots: p.slots.map((sl) => ({ ...sl })) })),
            };
            const idx = g.generatedSets.findIndex((st) => st.id === setId);
            const arr = g.generatedSets.slice();
            arr.splice(idx + 1, 0, copy);
            // setCount 증가 — 다음 자동 구성/적용 시 새 세트도 유지되도록
            return { ...g, generatedSets: arr, setCount: arr.length };
          }),
        })),

      swapSlots: (gid, a, b) =>
        set((s) => ({
          groups: s.groups.map((g) => {
            if (g.id !== gid) return g;
            const sets = g.generatedSets.map((st) => ({
              ...st,
              parties: st.parties.map((p) => ({ ...p, slots: p.slots.slice() })),
            }));
            const A = sets.find((st) => st.id === a.setId);
            const B = sets.find((st) => st.id === b.setId);
            if (!A || !B) return g;
            const sA = A.parties[a.partyIdx].slots[a.slotIdx];
            const sB = B.parties[b.partyIdx].slots[b.slotIdx];
            A.parties[a.partyIdx].slots[a.slotIdx] = sB;
            B.parties[b.partyIdx].slots[b.slotIdx] = sA;
            return { ...g, generatedSets: sets };
          }),
        })),

      importAllFromFile: (data) =>
        set((s) => ({
          players: Array.isArray(data.players) ? data.players : s.players,
          groups: Array.isArray(data.groups) ? data.groups : s.groups,
          activeGroupId: data.activeGroupId ?? s.activeGroupId,
          servers: Array.isArray(data.servers) && data.servers.length ? data.servers : s.servers,
          defaultServerId: data.defaultServerId ?? s.defaultServerId,
        })),
      importDBOnly: (players) => set({ players }),
    }),
    {
      name: "a2-party",
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 마이그레이션 — 기본값 보강
        if (!state.servers?.length) state.servers = DEFAULT_PARTY_SERVERS;
        if (!Array.isArray(state.groups)) state.groups = [];
        if (state.groups.length === 0) {
          state.groups = [mkGroup("그룹 1")];
          state.activeGroupId = state.groups[0].id;
        } else if (!state.activeGroupId || !state.groups.find((g) => g.id === state.activeGroupId)) {
          state.activeGroupId = state.groups[0].id;
        }
        // 각 그룹 기본 필드
        state.groups.forEach((g) => {
          if (!g.participants) g.participants = [];
          if (!g.distributeRules) g.distributeRules = [];
          // 옛 규칙(type 없음)은 폐기
          g.distributeRules = g.distributeRules.filter((r) => r && (r as DistributeRule).type);
          if (!g.setCount) g.setCount = 2;
          if (!g.partyCount) g.partyCount = 2;
          if (!g.composeMode) g.composeMode = "balanced";
          if (!Array.isArray(g.generatedSets)) g.generatedSets = [];
          // 옛 GeneratedSet({setIdx, parties: string[][]}) → 새 구조 마이그레이션
          g.generatedSets = g.generatedSets.map((st, i) => {
            const stUnknown = st as unknown as { id?: string; name?: string; parties?: unknown };
            if (stUnknown.id && Array.isArray(stUnknown.parties) && stUnknown.parties.every((p) => typeof p === "object" && p && "slots" in (p as object))) {
              return st as GeneratedSet;
            }
            return mkSet(i, g.partyCount);
          });
          if (typeof g.composed === "undefined") g.composed = false;
          if (typeof g.allowDup === "undefined") g.allowDup = false;
        });
      },
    }
  )
);

/** V4.0.9 charDisplayName — 서버 약자 접미사 */
export function charDisplayName(c: PartyCharacter, servers: PartyServer[], defaultServerId: number | null): string {
  if (!c) return "";
  if (!c.serverId) return c.name;
  if (defaultServerId && c.serverId === defaultServerId) return c.name;
  const sv = servers.find((s) => s.serverId === c.serverId);
  if (!sv) return c.name;
  return c.name + "[" + sv.name.slice(0, 2) + "]";
}

export function newCharId(): string { return uid("c"); }
