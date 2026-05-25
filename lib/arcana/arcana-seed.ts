/** V4.0.9 buildDefaultArcana() 포팅 — 42장(7세트 × 6슬롯, 유일 등급) 시드 */

import { CLASSES } from "@/lib/barrack/constants";
import {
  ARCANA_BASE_STAT_KEYS,
  BASE_STAT_VALUE,
  CARD_MAX_LV,
  DEFAULT_GRADE,
  SETS,
  SLOTS,
  SET_EFFECT_DATA,
  SET_LEVELUP_POLICY,
  arcanaIconUrl,
} from "./constants";
import type { ArcanaCard, ArcanaSetMaster } from "./types";
import { ARCANA_SKILLS_SEED } from "./arcana-skills-seed";

/** 42장 카드 시드 빌드 */
export function buildDefaultArcana(): ArcanaCard[] {
  const out: ArcanaCard[] = [];
  for (const set of SETS) {
    for (const slot of SLOTS) {
      const id = `arc_${slot.code}_${DEFAULT_GRADE}_${set.code}`;
      const baseStatKeys = ARCANA_BASE_STAT_KEYS[set.code]?.[slot.code] || [];
      const stats: Record<string, number> = {};
      for (const k of baseStatKeys) stats[k] = BASE_STAT_VALUE;
      const policy = SET_LEVELUP_POLICY[set.code] || { skillPoint: 1, statPoint: 0 };

      // 카드별 적용 스킬 시드 lookup
      const seedSkills = (ARCANA_SKILLS_SEED as Record<string, Record<string, string[]>>)[id] || null;
      const skillsByJob = Object.fromEntries(
        CLASSES.map((c) => {
          const arr = seedSkills?.[c.id];
          return [c.id, Array.isArray(arr) ? [...arr] : []];
        })
      );

      out.push({
        id,
        slot: slot.code,
        setKey: set.code,
        grade: DEFAULT_GRADE,
        season: set.season,
        name: `${set.name} ${slot.name}`,
        icon: arcanaIconUrl(slot.code, DEFAULT_GRADE, set.code),
        stats,
        skillsByJob,
        levelUp: { ...policy },
        maxLv: CARD_MAX_LV,
      });
    }
  }
  return out;
}

/** 7세트 효과 시드 빌드 */
export function buildDefaultSets(): ArcanaSetMaster[] {
  return SETS.map((s) => ({
    id: `set_${s.code}`,
    name: s.name,
    season: s.season,
    match: { setKey: s.code },
    tiers: [
      { n: 2, effects: SET_EFFECT_DATA[s.code]?.[2] || [] },
      { n: 4, effects: SET_EFFECT_DATA[s.code]?.[4] || [] },
    ],
  }));
}

export const DEFAULT_ARCANA = buildDefaultArcana();
export const DEFAULT_SETS = buildDefaultSets();
