import type { UnifiedPayload } from "./types";

/** Ver.4.0.9 v2/v4 + a2-card-export 포맷 모두 → v4 unified로 정규화 */
export function normalizeUnified(raw: any): UnifiedPayload {
  if (raw && raw._kind === "a2-unified") {
    // 부분 schema 마이그레이션 — V4 카드 export → unified 변환 시 사용된 legacy 키 보정.
    const p = raw as UnifiedPayload & Record<string, any>;
    if (p.arcana && typeof p.arcana === "object") {
      const ar = p.arcana as Record<string, any>;
      // buildList → builds
      if (Array.isArray(ar.buildList) && !Array.isArray(ar.builds)) {
        ar.builds = ar.buildList;
      }
      // 각 build.slots[*].masterCardId → masterId
      if (Array.isArray(ar.builds)) {
        for (const b of ar.builds) {
          if (b && typeof b === "object" && b.slots && typeof b.slots === "object") {
            for (const k of Object.keys(b.slots)) {
              const slot = b.slots[k];
              if (slot && typeof slot === "object" && slot.masterCardId !== undefined && slot.masterId === undefined) {
                slot.masterId = slot.masterCardId;
                delete slot.masterCardId;
              }
            }
          }
        }
      }
    }
    return p as UnifiedPayload;
  }
  const n: UnifiedPayload = {
    _kind: "a2-unified",
    _version: 4,
    exportedAt: new Date().toISOString(),
  };

  // a2-card-export — V4.0.9 카드 도메인 단독 export (arcana/skills/sets + characters/builds/owned)
  if (raw && raw._kind === "a2-card-export") {
    // 아르카나DB — 카드/스킬/세트 마스터
    const db: Record<string, unknown> = {};
    if (Array.isArray(raw.arcana)) db.cards = raw.arcana;
    if (Array.isArray(raw.skills)) db.skills = raw.skills;
    if (Array.isArray(raw.sets)) db.sets = raw.sets;
    if (Object.keys(db).length > 0) n.arcanaDB = db;
    // 아르카나 사용자 데이터 — 캐릭터/빌드/보유카드
    const user: Record<string, unknown> = {};
    if (Array.isArray(raw.characters)) user.characters = raw.characters;
    if (Array.isArray(raw.buildList)) {
      // V4 buildList → ArcanaBuild[] — slots[*].masterCardId → masterId 마이그레이션
      const builds = JSON.parse(JSON.stringify(raw.buildList));
      for (const b of builds) {
        if (b && typeof b === "object" && b.slots && typeof b.slots === "object") {
          for (const k of Object.keys(b.slots)) {
            const slot = b.slots[k];
            if (slot && typeof slot === "object" && slot.masterCardId !== undefined && slot.masterId === undefined) {
              slot.masterId = slot.masterCardId;
              delete slot.masterCardId;
            }
          }
        }
      }
      user.builds = builds;
    }
    if (typeof raw.currentBuildId === "string" || raw.currentBuildId === null) {
      user.currentBuildId = raw.currentBuildId ?? null;
    }
    if (Array.isArray(raw.ownedCards)) user.ownedCards = raw.ownedCards;
    if (Object.keys(user).length > 0) n.arcana = user;
    return n;
  }

  if (raw.accounts || raw.characters) {
    const b: any = {};
    if (raw.accounts) b.accounts = raw.accounts;
    if (raw.characters) b.characters = raw.characters;
    n.barrack = b;
  }
  if (raw.dbSettings) n.barrackDB = { dbSettings: raw.dbSettings };
  if (raw.partyData) {
    const pc = JSON.parse(JSON.stringify(raw.partyData));
    const pl = pc.players;
    const servers = pc.servers;
    const defaultServerId = pc.defaultServerId;
    delete pc.players;
    delete pc.servers;
    delete pc.defaultServerId;
    // pc 에는 groups, activeGroupId 만 남음 → party
    n.party = pc;
    // players/servers/defaultServerId → partyDB
    if (pl || servers !== undefined || defaultServerId !== undefined) {
      const db: Record<string, unknown> = {};
      if (pl) db.players = pl;
      if (servers !== undefined) db.servers = servers;
      if (defaultServerId !== undefined) db.defaultServerId = defaultServerId;
      n.partyDB = db;
    }
  }
  // 알리미 — Ver.4.0.9의 `a2-notifier` localStorage 단독 export 형식 지원
  if (raw.items && raw.settings === undefined && raw.notified !== undefined) {
    n.notifierDB = { items: raw.items };
  }
  return n;
}
