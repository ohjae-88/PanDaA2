import type { DbSettings } from "./types";
import { DB_DEFAULTS } from "./constants";

export type KinaRateInfo = {
  rate: number;
  remaining: number | null;
  nextRate: number | null;
  nextThreshold: number | null;
};

/** V4.0.9 getKinaRateInfo 동등 */
export function getKinaRateInfo(
  type: "expedition" | "transcend",
  total: number,
  db: DbSettings
): KinaRateInfo {
  const kd = db.kinaRates?.[type] ?? DB_DEFAULTS.kinaRates[type];
  const tiers = kd.tiers || [];
  const fallbackRate = kd.fallbackRate ?? 20;
  for (let i = 0; i < tiers.length; i++) {
    if (total <= tiers[i].threshold) {
      return {
        rate: tiers[i].rate,
        remaining: tiers[i].threshold - total,
        nextRate: tiers[i + 1]?.rate ?? fallbackRate,
        nextThreshold: tiers[i].threshold,
      };
    }
  }
  return { rate: fallbackRate, remaining: null, nextRate: null, nextThreshold: null };
}

export function kinaRateColorClass(rate: number): string {
  // 라이트 모드(기본): 진한 텍스트, 다크 모드(`dark:`): 밝은 텍스트
  if (rate >= 100) return "border-emerald-500/60 bg-emerald-500/15 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300";
  if (rate >= 80)  return "border-amber-500/60  bg-amber-500/15  text-amber-700  dark:bg-amber-500/10  dark:text-amber-300";
  if (rate >= 60)  return "border-rose-500/60   bg-rose-500/15   text-rose-700   dark:bg-rose-500/10   dark:text-rose-300";
  return "border-border bg-card text-foreground";
}
