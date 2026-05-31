"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Skill, SkillCategory, SpecialEffect } from "./types";
import { DEFAULT_SKILL_SEED } from "./skill-seed";
import { LS_SKILL_DB, SKILL_BASELV_SEED } from "./constants";

type Store = {
  skills: Skill[];
  /** Inven fetch 후 저장된 기본값 스냅샷 (null = 미저장) */
  defaultSnapshot: Skill[] | null;
  /** 전체 교체 — 불러오기 / 시드 리셋 */
  setSkills: (skills: Skill[]) => void;
  resetSeed: () => void;
  /** 현재 skills 를 기본값 스냅샷으로 저장 */
  saveAsDefault: () => void;
  /** 저장된 기본값 스냅샷을 skills 에 적용 */
  applyDefault: () => boolean;
  /** id로 단일 스킬 patch */
  patchSkill: (id: string, patch: Partial<Skill>) => void;
  /** 추가 (id 없으면 자동 생성) */
  addSkill: (skill: Partial<Skill> & { name: string; category: SkillCategory; jobId: string }) => void;
  /** 삭제 */
  removeSkill: (id: string) => void;
  /** Inven fetch 후 다수 갱신 — 기존 매칭 update, 신규 add */
  bulkUpsertSkills: (incoming: Skill[]) => { updated: number; added: number };
  /** 특화 효과 갱신 */
  setSpecialEffects: (id: string, effects: SpecialEffect[]) => void;
};

function ensureSkillShape(s: Partial<Skill>): Skill {
  const cat: SkillCategory = (s.category as SkillCategory) || "Active";
  const base = SKILL_BASELV_SEED[cat] ?? { base: 0, daevanion: 0 };
  return {
    id: s.id || `sk_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    skillId: s.skillId ?? 0,
    name: s.name || "",
    category: cat,
    icon: s.icon || "",
    jobId: s.jobId || "",
    job: s.job,
    baseLv: s.baseLv || { base: base.base, daevanion: base.daevanion },
    daevanion: s.daevanion ?? base.daevanion > 0,
    specialEffects: Array.isArray(s.specialEffects) ? s.specialEffects : [],
  };
}

export const useSkillStore = create<Store>()(
  persist(
    (set, get) => ({
      skills: [],
      defaultSnapshot: null,

      setSkills: (skills) => set({ skills: skills.map(ensureSkillShape) }),
      resetSeed: () => set({ skills: DEFAULT_SKILL_SEED.map(ensureSkillShape) }),

      saveAsDefault: () => set({ defaultSnapshot: get().skills.map(ensureSkillShape) }),
      applyDefault: () => {
        const snap = get().defaultSnapshot;
        if (!snap || snap.length === 0) return false;
        set({ skills: snap.map(ensureSkillShape) });
        return true;
      },

      patchSkill: (id, patch) =>
        set((s) => ({
          skills: s.skills.map((x) => (x.id === id ? ensureSkillShape({ ...x, ...patch }) : x)),
        })),

      addSkill: (partial) =>
        set((s) => ({ skills: [...s.skills, ensureSkillShape(partial)] })),

      removeSkill: (id) =>
        set((s) => ({ skills: s.skills.filter((x) => x.id !== id) })),

      bulkUpsertSkills: (incoming) => {
        const cur = get().skills.slice();
        let updated = 0;
        let added = 0;
        for (const inc of incoming) {
          const idx = cur.findIndex(
            (x) => x.id === inc.id || (x.skillId && x.skillId === inc.skillId)
          );
          if (idx >= 0) {
            // V4 동등: name/baseLv/daevanion은 사용자 편집 보존, specialEffects는 신규 fetch가 우선.
            // (특성 효과는 inven 갱신 목적 — 신규 값이 있으면 항상 덮어씀)
            const old = cur[idx];
            cur[idx] = ensureSkillShape({
              ...inc,
              name: old.name || inc.name,
              baseLv: old.baseLv ?? inc.baseLv,
              daevanion: old.daevanion ?? inc.daevanion,
              specialEffects: inc.specialEffects && inc.specialEffects.length > 0
                ? inc.specialEffects
                : old.specialEffects ?? [],
            });
            updated++;
          } else {
            cur.push(ensureSkillShape(inc));
            added++;
          }
        }
        set({ skills: cur });
        return { updated, added };
      },

      setSpecialEffects: (id, effects) =>
        set((s) => ({
          skills: s.skills.map((x) => (x.id === id ? { ...x, specialEffects: effects } : x)),
        })),
    }),
    {
      name: LS_SKILL_DB,
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        // 빈 상태면 시드 주입
        if (!Array.isArray(state.skills) || state.skills.length === 0) {
          state.skills = DEFAULT_SKILL_SEED.map(ensureSkillShape);
        } else {
          state.skills = state.skills.map(ensureSkillShape);
        }
        // defaultSnapshot 정규화
        if (Array.isArray(state.defaultSnapshot)) {
          state.defaultSnapshot = state.defaultSnapshot.map(ensureSkillShape);
        } else {
          state.defaultSnapshot = null;
        }
      },
    }
  )
);
