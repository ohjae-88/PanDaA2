"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { ArcanaBuild, EquipSlotInstance, SlotEntry } from "./types";
import { ARCANA_ORDER, DEFAULT_EQUIP_SLOTS, LS_BUILDS } from "./constants";
import { useOwnedStore } from "./owned-store";

function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function emptySlotEntry(): SlotEntry {
  return {
    ownedCardId: null,
    masterId: null,
    level: 0,
    gains: { stats: {}, skills: {} },
    enabledSkills: [], // string[] — V4 동등
    activeCondEffects: [],
  };
}

/** 빌드 형태 보장 — 6슬롯/equipSlots/refSelected 등 누락 필드 보정 */
export function ensureBuildShape(b: ArcanaBuild): ArcanaBuild {
  const slots: Record<string, SlotEntry> = { ...(b.slots || {}) };
  for (const s of ARCANA_ORDER) {
    if (!slots[s]) slots[s] = emptySlotEntry();
    else {
      const e = slots[s];
      // enabledSkills 마이그레이션 — boolean[] (legacy) → string[] (V4 동등).
      // legacy boolean[]는 정보 손실 발생하므로 빈 배열로 초기화.
      const raw = e.enabledSkills;
      let enabledSkills: string[] = [];
      if (Array.isArray(raw)) {
        if (raw.every((x) => typeof x === "string")) {
          enabledSkills = raw as string[];
        } else if (raw.some((x) => typeof x === "boolean")) {
          // legacy boolean[] — 정보 부정확하므로 리셋 (사용자가 재선택)
          enabledSkills = [];
        }
      }
      slots[s] = {
        ownedCardId: e.ownedCardId ?? null,
        masterId: e.masterId ?? null,
        level: e.level ?? 0,
        gains: {
          stats: e.gains?.stats ?? {},
          skills: e.gains?.skills ?? {},
        },
        enabledSkills,
        activeCondEffects: Array.isArray(e.activeCondEffects) ? e.activeCondEffects : [],
      };
    }
  }
  let equipSlots: EquipSlotInstance[] = Array.isArray(b.equipSlots) ? b.equipSlots : [];
  if (equipSlots.length === 0) {
    equipSlots = DEFAULT_EQUIP_SLOTS.map((es) => ({
      id: uid("es"),
      kind: es.kind,
      index: es.index,
      skills: {},
    }));
  }
  return {
    ...b,
    slots,
    equipSlots,
    arcanaRefOpen: !!b.arcanaRefOpen,
    arcanaRefSelected: b.arcanaRefSelected ?? {},
    activeSetCondEffects: Array.isArray(b.activeSetCondEffects) ? b.activeSetCondEffects : [],
    createdAt: b.createdAt ?? Date.now(),
  };
}

type Store = {
  builds: ArcanaBuild[];
  currentBuildId: string | null;

  setAll: (builds: ArcanaBuild[], currentBuildId?: string | null) => void;
  setCurrentBuildId: (id: string | null) => void;

  createBuild: (charId: string, name?: string) => ArcanaBuild;
  duplicateBuild: (id: string) => ArcanaBuild | null;
  renameBuild: (id: string, name: string) => void;
  removeBuild: (id: string) => void;

  /** 슬롯 카드 배치 — owned 또는 master */
  setSlotOwned: (buildId: string, slotKey: string, ownedCardId: string | null) => void;
  setSlotMaster: (buildId: string, slotKey: string, masterId: string | null, level?: number) => void;
  clearSlot: (buildId: string, slotKey: string) => void;
  patchSlot: (buildId: string, slotKey: string, patch: Partial<SlotEntry>) => void;

  /** 슬롯 분배 — 임의 분배 모드의 stats/skills */
  setSlotGainStats: (buildId: string, slotKey: string, stats: Record<string, number>) => void;
  setSlotGainSkills: (buildId: string, slotKey: string, skills: Record<string, number>) => void;
  setSlotLevel: (buildId: string, slotKey: string, level: number) => void;
  /** V4 동등: skillId 기반 토글 (포함 검사 — 인덱스 매핑 오염 차단) */
  toggleSlotSkillEnabled: (buildId: string, slotKey: string, skillId: string, on: boolean) => void;

  /** 장비 슬롯 */
  addEquipSlot: (buildId: string, kind: string, index?: number) => void;
  removeEquipSlot: (buildId: string, equipSlotId: string) => void;
  setEquipSlotSkill: (buildId: string, equipSlotId: string, skillId: string, point: number) => void;
  clearEquipSlotSkill: (buildId: string, equipSlotId: string, skillId: string) => void;

  /** 헤더 ref 표 */
  setArcanaRefOpen: (buildId: string, open: boolean) => void;
  toggleArcanaRefSelected: (buildId: string, key: string) => void;

  /** 세트 cond 효과 토글 */
  toggleSetCondEffect: (buildId: string, key: string) => void;
};

function patchBuildInList(
  builds: ArcanaBuild[],
  id: string,
  fn: (b: ArcanaBuild) => ArcanaBuild
): ArcanaBuild[] {
  return builds.map((b) => (b.id === id ? ensureBuildShape(fn(b)) : b));
}

export const useArcanaBuildStore = create<Store>()(
  persist(
    (set, get) => ({
      builds: [],
      currentBuildId: null,

      setAll: (builds, currentBuildId) =>
        set({
          builds: builds.map(ensureBuildShape),
          currentBuildId: currentBuildId ?? null,
        }),
      setCurrentBuildId: (id) => set({ currentBuildId: id }),

      createBuild: (charId, name) => {
        const b = ensureBuildShape({
          id: uid("bd"),
          charId,
          name: (name || "새 빌드").trim() || "새 빌드",
          slots: {},
          equipSlots: [],
          createdAt: Date.now(),
        });
        set((s) => ({ builds: [...s.builds, b], currentBuildId: b.id }));
        return b;
      },
      duplicateBuild: (id) => {
        const cur = get().builds.find((b) => b.id === id);
        if (!cur) return null;
        const copy = ensureBuildShape({
          ...JSON.parse(JSON.stringify(cur)),
          id: uid("bd"),
          name: `${cur.name} 사본`,
          createdAt: Date.now(),
        });
        set((s) => ({ builds: [...s.builds, copy], currentBuildId: copy.id }));
        return copy;
      },
      renameBuild: (id, name) =>
        set((s) => ({
          builds: s.builds.map((b) => (b.id === id ? { ...b, name: name.trim() || b.name } : b)),
        })),
      removeBuild: (id) =>
        set((s) => {
          const nextBuilds = s.builds.filter((b) => b.id !== id);
          let nextCur = s.currentBuildId;
          if (nextCur === id) nextCur = nextBuilds[0]?.id ?? null;
          return { builds: nextBuilds, currentBuildId: nextCur };
        }),

      setSlotOwned: (buildId, slotKey, ownedCardId) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            slots: {
              ...b.slots,
              // 카드 변경 시 enabledSkills + gains 초기화 (이전 카드의 스킬 인덱스 매핑 오염 방지)
              [slotKey]: {
                ...emptySlotEntry(),
                ownedCardId,
                masterId: null,
              },
            },
          })),
        })),
      setSlotMaster: (buildId, slotKey, masterId, level = 0) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            slots: {
              ...b.slots,
              // 카드 변경 시 enabledSkills + gains 초기화
              [slotKey]: {
                ...emptySlotEntry(),
                masterId,
                ownedCardId: null,
                level,
              },
            },
          })),
        })),
      clearSlot: (buildId, slotKey) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            slots: { ...b.slots, [slotKey]: emptySlotEntry() },
          })),
        })),
      patchSlot: (buildId, slotKey, patch) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            slots: {
              ...b.slots,
              [slotKey]: { ...(b.slots[slotKey] || emptySlotEntry()), ...patch },
            },
          })),
        })),

      setSlotGainStats: (buildId, slotKey, stats) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            slots: {
              ...b.slots,
              [slotKey]: {
                ...(b.slots[slotKey] || emptySlotEntry()),
                gains: { ...(b.slots[slotKey]?.gains || {}), stats },
              },
            },
          })),
        })),
      setSlotGainSkills: (buildId, slotKey, skills) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            slots: {
              ...b.slots,
              [slotKey]: {
                ...(b.slots[slotKey] || emptySlotEntry()),
                gains: { ...(b.slots[slotKey]?.gains || {}), skills },
              },
            },
          })),
        })),
      setSlotLevel: (buildId, slotKey, level) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            slots: {
              ...b.slots,
              [slotKey]: { ...(b.slots[slotKey] || emptySlotEntry()), level },
            },
          })),
        })),
      toggleSlotSkillEnabled: (buildId, slotKey, skillId, on) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => {
            const entry = b.slots[slotKey] || emptySlotEntry();
            // owned 모드: owned.enabledSkills에 영속 기록 (resolveSlotCard 우선 사용).
            if (entry.ownedCardId) {
              const ownedStore = useOwnedStore.getState();
              const o = ownedStore.ownedCards.find((x) => x.id === entry.ownedCardId);
              if (o) {
                const cur = Array.isArray(o.enabledSkills) ? o.enabledSkills : [];
                const has = cur.includes(skillId);
                let next: string[];
                if (on && !has) next = [...cur, skillId];
                else if (!on && has) next = cur.filter((x) => x !== skillId);
                else next = cur;
                ownedStore.patchOwned(o.id, { enabledSkills: next });
              }
              return b;
            }
            const cur = Array.isArray(entry.enabledSkills) ? entry.enabledSkills : [];
            const has = cur.includes(skillId);
            let next: string[];
            if (on && !has) next = [...cur, skillId];
            else if (!on && has) next = cur.filter((x) => x !== skillId);
            else next = cur;
            return {
              ...b,
              slots: { ...b.slots, [slotKey]: { ...entry, enabledSkills: next } },
            };
          }),
        })),

      addEquipSlot: (buildId, kind, index) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            equipSlots: [
              ...b.equipSlots,
              { id: uid("es"), kind, index, skills: {} },
            ],
          })),
        })),
      removeEquipSlot: (buildId, equipSlotId) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            equipSlots: b.equipSlots.filter((e) => e.id !== equipSlotId),
          })),
        })),
      setEquipSlotSkill: (buildId, equipSlotId, skillId, point) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            equipSlots: b.equipSlots.map((e) =>
              e.id === equipSlotId
                ? { ...e, skills: { ...(e.skills || {}), [skillId]: point } }
                : e
            ),
          })),
        })),
      clearEquipSlotSkill: (buildId, equipSlotId, skillId) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({
            ...b,
            equipSlots: b.equipSlots.map((e) => {
              if (e.id !== equipSlotId) return e;
              const next = { ...(e.skills || {}) };
              delete next[skillId];
              return { ...e, skills: next };
            }),
          })),
        })),

      setArcanaRefOpen: (buildId, open) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => ({ ...b, arcanaRefOpen: open })),
        })),
      toggleArcanaRefSelected: (buildId, key) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => {
            const cur = b.arcanaRefSelected ?? {};
            const next = { ...cur };
            if (next[key]) delete next[key];
            else next[key] = true;
            return { ...b, arcanaRefSelected: next };
          }),
        })),
      toggleSetCondEffect: (buildId, key) =>
        set((s) => ({
          builds: patchBuildInList(s.builds, buildId, (b) => {
            const cur = b.activeSetCondEffects || [];
            const next = cur.includes(key) ? cur.filter((k) => k !== key) : [...cur, key];
            return { ...b, activeSetCondEffects: next };
          }),
        })),
    }),
    {
      name: LS_BUILDS,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        if (Array.isArray(state.builds)) state.builds = state.builds.map(ensureBuildShape);
      },
    }
  )
);
