/** 카드 빌드 합산 로직 — V4.0.9 동등 재작성.
 *  resolveSlotCard / getEffectiveCardStats / computeStats / computeSetEffects /
 *  getSkillTotalAndClass / getCardInvestmentTotal / summarizeCardSkillPools */

import { ARCANA_ORDER } from "./constants";
import type {
  ArcanaBuild,
  ArcanaCard,
  ArcanaSetMaster,
  OwnedCard,
  SetEffect,
  Skill,
  SlotEntry,
} from "./types";

/** 빌드의 슬롯 entry → 사용 중인 카드 마스터 + 분배 값 해석 (V4 동등).
 *  owned 카드 모드면 owned.gains/level/enabledSkills 사용,
 *  master 임의 모드면 entry의 값 사용. */
export function resolveSlotCard(
  entry: SlotEntry | undefined,
  arcana: ArcanaCard[],
  owned: OwnedCard[]
): {
  master: ArcanaCard | null;
  level: number;
  gains: { stats: Record<string, number>; skills: Record<string, number> };
  enabledSkills: string[];
  source: "owned" | "master" | null;
} {
  const EMPTY = {
    master: null,
    level: 0,
    gains: { stats: {}, skills: {} },
    enabledSkills: [] as string[],
    source: null,
  };
  if (!entry) return EMPTY;
  // owned 우선
  if (entry.ownedCardId) {
    const o = owned.find((x) => x.id === entry.ownedCardId);
    if (o) {
      const m = arcana.find((a) => a.id === o.masterId) || null;
      // V4 동등: owned.enabledSkills 정의되어 있으면 우선 (빈 배열도 유효 상태).
      // 정의 안 됨(legacy data)일 때만 entry.enabledSkills 폴백.
      const enabledSkills = Array.isArray(o.enabledSkills)
        ? o.enabledSkills
        : (Array.isArray(entry.enabledSkills) ? entry.enabledSkills : []);
      return {
        master: m,
        level: o.level || 0,
        gains: { stats: o.gains.stats || {}, skills: o.gains.skills || {} },
        enabledSkills,
        source: "owned",
      };
    }
  }
  if (entry.masterId) {
    const m = arcana.find((a) => a.id === entry.masterId) || null;
    return {
      master: m,
      level: entry.level || 0,
      gains: {
        stats: entry.gains?.stats || {},
        skills: entry.gains?.skills || {},
      },
      enabledSkills: Array.isArray(entry.enabledSkills) ? entry.enabledSkills : [],
      source: "master",
    };
  }
  return EMPTY;
}

/** V4 동등: master.stats 각 키마다 `levelUp.statPoint × level` 가산.
 *  카드 레벨이 오르면 stats가 자동 증가. */
export function getEffectiveCardStats(
  master: ArcanaCard | null,
  level: number
): Record<string, number> {
  const out: Record<string, number> = {};
  const base = master?.stats || {};
  const per = master?.levelUp?.statPoint || 0;
  const lv = Math.max(0, level | 0);
  for (const [k, v] of Object.entries(base)) {
    out[k] = (v || 0) + per * lv;
  }
  return out;
}

/** 빌드의 6슬롯 → 합산 stats (V4 동등).
 *  카드 effective stats + 사용자 분배 gains.stats. */
export function computeStats(
  build: ArcanaBuild | null,
  arcana: ArcanaCard[],
  owned: OwnedCard[],
  equipSkillStats?: Record<string, number>
): Record<string, number> {
  const totals: Record<string, number> = {};
  if (!build) return totals;
  for (const slot of ARCANA_ORDER) {
    const entry = build.slots[slot];
    const r = resolveSlotCard(entry, arcana, owned);
    if (!r.master) continue;
    // 카드 effective stats (master.stats + levelUp 누적)
    const eff = getEffectiveCardStats(r.master, r.level);
    for (const [k, v] of Object.entries(eff)) totals[k] = (totals[k] || 0) + v;
    // 사용자 추가 분배
    for (const [k, v] of Object.entries(r.gains.stats || {})) totals[k] = (totals[k] || 0) + v;
  }
  if (equipSkillStats) {
    for (const [k, v] of Object.entries(equipSkillStats)) totals[k] = (totals[k] || 0) + v;
  }
  return totals;
}

/** 빌드의 활성 세트 효과 — 같은 setKey 카드 개수 기준 tier 활성화 */
export function computeSetEffects(
  build: ArcanaBuild | null,
  arcana: ArcanaCard[],
  owned: OwnedCard[],
  setMasters: ArcanaSetMaster[]
): {
  bySet: Record<string, number>;
  activeTiers: Array<{ setMaster: ArcanaSetMaster; tier: number; effects: SetEffect[] }>;
} {
  const bySet: Record<string, number> = {};
  if (!build) return { bySet, activeTiers: [] };
  for (const slot of ARCANA_ORDER) {
    const entry = build.slots[slot];
    const { master } = resolveSlotCard(entry, arcana, owned);
    if (!master?.setKey) continue;
    bySet[master.setKey] = (bySet[master.setKey] || 0) + 1;
  }
  const activeTiers: Array<{ setMaster: ArcanaSetMaster; tier: number; effects: SetEffect[] }> = [];
  for (const sm of setMasters) {
    const key = sm.match.setKey;
    const cnt = bySet[key] || 0;
    if (cnt <= 0) continue;
    for (const t of sm.tiers) {
      if (cnt >= t.n && t.effects.length > 0) {
        activeTiers.push({ setMaster: sm, tier: t.n, effects: t.effects });
      }
    }
  }
  return { bySet, activeTiers };
}

/** 활성 세트 효과의 stats 합산 — cond/cooldown 효과는 사용자 토글 시 포함 */
export function computeSetStats(
  active: Array<{ setMaster: ArcanaSetMaster; tier: number; effects: SetEffect[] }>,
  activeCondKeys: string[] = []
): Record<string, number> {
  const totals: Record<string, number> = {};
  for (const a of active) {
    for (let i = 0; i < a.effects.length; i++) {
      const eff = a.effects[i];
      const key = `${a.setMaster.id}_${a.tier}_${i}`;
      if (eff.stats) {
        const autoApply = !eff.cond && !eff.cooldownSec;
        if (autoApply || activeCondKeys.includes(key)) {
          for (const [k, v] of Object.entries(eff.stats)) totals[k] = (totals[k] || 0) + v;
        }
      }
    }
  }
  return totals;
}

/** 모든 슬롯에서 특정 skillId의 카드 투자 점수 합산.
 *  옵션 활성된 슬롯만 합산 — 활성 시 기본 +1 + 추가 분배(gains.skills).
 *  비활성 스킬은 분배 잔존값이 있어도 무시 (사용자 의도). */
export function getCardInvestmentTotal(
  skillId: string,
  build: ArcanaBuild | null,
  arcana: ArcanaCard[],
  owned: OwnedCard[]
): number {
  if (!build) return 0;
  let total = 0;
  for (const slot of ARCANA_ORDER) {
    const entry = build.slots[slot];
    const r = resolveSlotCard(entry, arcana, owned);
    if (!r.master) continue;
    // 옵션 활성된 스킬만 카운트
    if (!r.enabledSkills.includes(skillId)) continue;
    total += 1; // 옵션 활성 기본 +1
    const v = r.gains.skills?.[skillId];
    if (typeof v === "number") total += v;
  }
  return total;
}

/** V4 동등: 단일 스킬의 총 레벨 + 출처 분해.
 *  - base + daevanion(무조건 합산) + 카드 투자 + 장비 합산 */
export function getSkillTotalAndClass(
  skill: Skill,
  build: ArcanaBuild | null,
  arcana: ArcanaCard[],
  owned: OwnedCard[]
): {
  total: number;
  base: number;
  cardSum: number;
  equipSum: number;
  sources: Array<{ from: string; value: number }>;
} {
  const baseN = skill.baseLv?.base || 0;
  // skill.daevanion 토글이 false면 데바니온 보너스 미반영 (사용자 편집 가능).
  // 토글 미지정 시 baseLv.daevanion > 0이면 활성으로 간주.
  const daeRaw = skill.baseLv?.daevanion || 0;
  const daeActive = skill.daevanion ?? (daeRaw > 0);
  const daeN = daeActive ? daeRaw : 0;
  const base = baseN + daeN;
  const sources: Array<{ from: string; value: number }> = [];
  if (baseN > 0) sources.push({ from: "기본", value: baseN });
  if (daeN > 0) sources.push({ from: "데바니온", value: daeN });

  let cardSum = 0;
  if (build) {
    for (const slot of ARCANA_ORDER) {
      const entry = build.slots[slot];
      const r = resolveSlotCard(entry, arcana, owned);
      if (!r.master) continue;
      // 옵션 활성된 스킬만 합산 — 비활성 스킬은 분배 잔존값 무시
      if (!r.enabledSkills.includes(skill.id)) continue;
      const extra = r.gains.skills?.[skill.id] || 0;
      const slotContribution = 1 + extra; // 옵션 +1 + 분배
      cardSum += slotContribution;
      sources.push({ from: `🃏 ${r.master.name}`, value: slotContribution });
    }
  }

  let equipSum = 0;
  if (build) {
    for (const es of build.equipSlots) {
      const pts = es.skills?.[skill.id] || 0;
      if (pts > 0) {
        equipSum += pts;
        sources.push({ from: `🎽 ${es.kind}${es.index ? ` ${es.index}` : ""}`, value: pts });
      }
    }
  }

  return { total: base + cardSum + equipSum, base, cardSum, equipSum, sources };
}

/** 카드 적용 가능 스킬 풀 요약 — 직업별 */
export function summarizeCardSkillPools(
  master: ArcanaCard | null,
  jobId: string,
  skills: Skill[]
): Skill[] {
  if (!master) return [];
  const ids = master.skillsByJob?.[jobId] || [];
  const out: Skill[] = [];
  for (const id of ids) {
    const sk = skills.find((s) => s.id === id);
    if (sk) out.push(sk);
  }
  return out;
}

/** 장비 스킬 합산 — skillId → 총 점수 */
export function computeEquipSkillTotals(
  build: ArcanaBuild | null
): Record<string, number> {
  const out: Record<string, number> = {};
  if (!build) return out;
  for (const es of build.equipSlots) {
    if (!es.skills) continue;
    for (const [sid, v] of Object.entries(es.skills)) {
      out[sid] = (out[sid] || 0) + v;
    }
  }
  return out;
}
