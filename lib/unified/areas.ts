"use client";

import { useNotifierStore } from "@/lib/notifier/store";
import type { NotifierItem } from "@/lib/notifier/types";
import { useBarrackStore } from "@/lib/barrack/store";
import type { Account, Character, DbSettings } from "@/lib/barrack/types";
import { usePartyStore } from "@/lib/party/store";
import type { Player, PartyGroup, PartyServer } from "@/lib/party/types";
import { useOverlayStore } from "@/lib/overlay/store";
import { useArcanaCharStore } from "@/lib/arcana/character-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import { useSetStore } from "@/lib/arcana/set-store";
import type {
  ArcanaBuild,
  ArcanaCard,
  ArcanaCharacter,
  ArcanaSetMaster,
  OwnedCard,
  Skill,
} from "@/lib/arcana/types";
import type { UnifiedArea } from "./types";

/** 오버레이 저장 대상 키 — 런타임 토글(activeTab/headerHidden/collapsed) 제외, 사용자 설정만 */
const OVERLAY_PERSIST_KEYS = [
  "passthroughHotkey",
  "headerHiddenHotkey",
  "customHotkeys",
  "overallOpacity",
  "scale",
  "textScale",
  "expandedSize",
  "collapsedSize",
  "collapsedPartySize",
  "expandedPos",
  "collapsedPos",
  "collapsedPartyPos",
  "collapsedMode",
  "iframeUrls",
  "visual",
  "notifier",
  "barrack",
  "partyOverlay",
] as const;

/** 통합 저장/불러오기 영역 — 카테고리(user/db/overlay) + 순서:
 *  user: 배럭관리, 파티구성, 아르카나, 알리미
 *  db:   배럭관리DB, 파티구성DB, 아르카나DB, 알리미DB
 *  overlay: 오버레이 설정 */
export const UNIFIED_AREAS: UnifiedArea[] = [
  // ── 사용자 데이터 ──
  {
    key: "barrack",
    label: "🏰 배럭관리",
    desc: "계정 · 캐릭터 목록 · 정렬 · 키나 카드 표시",
    category: "user",
    available: () => true,
    getSection: () => {
      const s = useBarrackStore.getState();
      return {
        accounts: JSON.parse(JSON.stringify(s.accounts || [])),
        characters: JSON.parse(JSON.stringify(s.characters || [])),
        characterOrder: [...(s.characterOrder || [])],
        kinaHidden: JSON.parse(JSON.stringify(s.kinaHidden || { dash: false, simple: false })),
      };
    },
    applySection: (d) => {
      const s = useBarrackStore.getState();
      s.setBarrackData({
        accounts: Array.isArray(d.accounts) ? (d.accounts as Account[]) : undefined,
        characters: Array.isArray(d.characters) ? (d.characters as Character[]) : undefined,
      });
      if (Array.isArray(d.characterOrder)) s.setCharacterOrder(d.characterOrder as string[]);
      if (d.kinaHidden && typeof d.kinaHidden === "object") {
        const k = d.kinaHidden as { dash?: unknown; simple?: unknown };
        if (typeof k.dash === "boolean") s.setKinaHidden("dash", k.dash);
        if (typeof k.simple === "boolean") s.setKinaHidden("simple", k.simple);
      }
    },
  },
  {
    key: "party",
    label: "⚔ 파티구성",
    desc: "그룹 · 세트 · 슬롯 배치",
    category: "user",
    available: () => true,
    getSection: () => {
      const s = usePartyStore.getState();
      return {
        groups: JSON.parse(JSON.stringify(s.groups || [])),
        activeGroupId: s.activeGroupId ?? null,
      };
    },
    applySection: (d) => {
      const s = usePartyStore.getState();
      const payload: Partial<{ groups: PartyGroup[]; activeGroupId: string | null }> = {};
      if (Array.isArray(d.groups)) payload.groups = d.groups as PartyGroup[];
      if (typeof d.activeGroupId === "string" || d.activeGroupId === null) {
        payload.activeGroupId = d.activeGroupId as string | null;
      }
      s.importAllFromFile(payload);
    },
  },
  {
    key: "arcana",
    label: "🎴 아르카나",
    desc: "캐릭터 · 빌드 · 보유카드",
    category: "user",
    available: () => true,
    getSection: () => {
      const ch = useArcanaCharStore.getState();
      const bd = useArcanaBuildStore.getState();
      const ow = useOwnedStore.getState();
      return {
        characters: JSON.parse(JSON.stringify(ch.characters || [])),
        builds: JSON.parse(JSON.stringify(bd.builds || [])),
        currentBuildId: bd.currentBuildId ?? null,
        ownedCards: JSON.parse(JSON.stringify(ow.ownedCards || [])),
      };
    },
    applySection: (d) => {
      if (Array.isArray(d.characters)) {
        useArcanaCharStore.getState().setAll(d.characters as ArcanaCharacter[]);
      }
      if (Array.isArray(d.builds)) {
        useArcanaBuildStore.getState().setAll(
          d.builds as ArcanaBuild[],
          (typeof d.currentBuildId === "string" || d.currentBuildId === null)
            ? (d.currentBuildId as string | null)
            : undefined
        );
      } else if (typeof d.currentBuildId === "string" || d.currentBuildId === null) {
        useArcanaBuildStore.getState().setCurrentBuildId(d.currentBuildId as string | null);
      }
      if (Array.isArray(d.ownedCards)) {
        useOwnedStore.getState().setAll(d.ownedCards as OwnedCard[]);
      }
    },
  },
  {
    key: "notifier",
    label: "⏰ 알리미",
    desc: "알림 설정 · 정렬 순서",
    category: "user",
    available: () => true,
    getSection: () => {
      const s = useNotifierStore.getState();
      return {
        settings: JSON.parse(JSON.stringify(s.settings || {})),
        itemOrder: [...(s.itemOrder || [])],
        groupOrder: [...(s.groupOrder || [])],
        notified: JSON.parse(JSON.stringify(s.notified || {})),
      };
    },
    applySection: (d) => {
      const s = useNotifierStore.getState();
      if (d.settings && typeof d.settings === "object") {
        s.updateSettings(d.settings as Partial<typeof s.settings>);
      }
      if (Array.isArray(d.itemOrder)) s.setItemOrder(d.itemOrder as string[]);
      if (Array.isArray(d.groupOrder)) s.setGroupOrder(d.groupOrder as string[]);
      if (d.notified && typeof d.notified === "object") {
        useNotifierStore.setState({ notified: d.notified as Record<string, true> });
      }
    },
  },
  // ── DB 데이터 ──
  {
    key: "barrackDB",
    label: "🗄 배럭관리DB",
    desc: "서버 · 설정 DB",
    category: "db",
    available: () => true,
    getSection: () => {
      const s = useBarrackStore.getState();
      return { dbSettings: JSON.parse(JSON.stringify(s.dbSettings)) };
    },
    applySection: (d) => {
      if (d.dbSettings && typeof d.dbSettings === "object") {
        useBarrackStore.getState().setDb(d.dbSettings as DbSettings);
      }
    },
  },
  {
    key: "partyDB",
    label: "🗂 파티구성DB",
    desc: "플레이어 · 캐릭터 · 서버",
    category: "db",
    available: () => true,
    getSection: () => {
      const s = usePartyStore.getState();
      return {
        players: JSON.parse(JSON.stringify(s.players || [])),
        servers: JSON.parse(JSON.stringify(s.servers || [])),
        defaultServerId: s.defaultServerId ?? null,
      };
    },
    applySection: (d) => {
      const s = usePartyStore.getState();
      const payload: Partial<{
        players: Player[];
        servers: PartyServer[];
        defaultServerId: number | null;
      }> = {};
      if (Array.isArray(d.players)) payload.players = d.players as Player[];
      if (Array.isArray(d.servers)) payload.servers = d.servers as PartyServer[];
      if (typeof d.defaultServerId === "number" || d.defaultServerId === null) {
        payload.defaultServerId = d.defaultServerId as number | null;
      }
      s.importAllFromFile(payload);
    },
  },
  {
    key: "arcanaDB",
    label: "📚 아르카나DB",
    desc: "아르카나DB · 스킬DB · 세트DB",
    category: "db",
    available: () => true,
    getSection: () => {
      const a = useArcanaStore.getState();
      const sk = useSkillStore.getState();
      const st = useSetStore.getState();
      return {
        cards: JSON.parse(JSON.stringify(a.cards || [])),
        skills: JSON.parse(JSON.stringify(sk.skills || [])),
        sets: JSON.parse(JSON.stringify(st.sets || [])),
      };
    },
    applySection: (d) => {
      if (Array.isArray(d.cards)) {
        useArcanaStore.getState().setCards(d.cards as ArcanaCard[]);
      }
      if (Array.isArray(d.skills)) {
        useSkillStore.getState().setSkills(d.skills as Skill[]);
      }
      if (Array.isArray(d.sets)) {
        useSetStore.getState().setAll(d.sets as ArcanaSetMaster[]);
      }
    },
  },
  {
    key: "notifierDB",
    label: "🗂 알리미DB",
    desc: "컨텐츠 항목 목록 · 그룹 정의",
    category: "db",
    available: () => true,
    getSection: () => {
      const s = useNotifierStore.getState();
      return {
        items: JSON.parse(JSON.stringify(s.items || [])),
        groupDefs: JSON.parse(JSON.stringify(s.groupDefs || [])),
      };
    },
    applySection: (d) => {
      const s = useNotifierStore.getState();
      if (Array.isArray(d.items)) s.setItems(d.items as NotifierItem[]);
      if (Array.isArray(d.groupDefs)) {
        useNotifierStore.setState({ groupDefs: d.groupDefs as typeof s.groupDefs });
      }
    },
  },
  // ── 오버레이 설정 ──
  {
    key: "overlay",
    label: "🪟 오버레이 설정",
    desc: "단축키 · 배율 · 비주얼 · 카테고리 옵션 · 위치/크기",
    category: "overlay",
    available: () => true,
    getSection: () => {
      const s = useOverlayStore.getState() as unknown as Record<string, unknown>;
      const out: Record<string, unknown> = {};
      for (const k of OVERLAY_PERSIST_KEYS) {
        if (s[k] !== undefined) out[k] = JSON.parse(JSON.stringify(s[k]));
      }
      return out;
    },
    applySection: (d) => {
      const patch: Record<string, unknown> = {};
      for (const k of OVERLAY_PERSIST_KEYS) {
        if (d[k] !== undefined) patch[k] = d[k];
      }
      if (Object.keys(patch).length > 0) {
        useOverlayStore.setState(patch as Partial<ReturnType<typeof useOverlayStore.getState>>);
      }
    },
  },
];
