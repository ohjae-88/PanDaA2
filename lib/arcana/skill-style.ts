import type { SkillCategory } from "./types";

/** V4.0.9 동등 — 스킬 레벨 임계치별 강조 클래스.
 *  Active: 16+ good / 18+ warn / 20+ danger
 *  Passive: 20+ danger 만 */
export function skillLevelStyle(cat: SkillCategory, total: number): {
  containerCls: string;
  lvBg: string;
} {
  if (cat === "Active") {
    if (total >= 20) return {
      containerCls: "border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20",
      lvBg: "bg-rose-500",
    };
    if (total >= 18) return {
      containerCls: "border-orange-500/60 bg-orange-500/10 hover:bg-orange-500/20",
      lvBg: "bg-orange-500",
    };
    if (total >= 16) return {
      containerCls: "border-emerald-500/60 bg-emerald-500/10 hover:bg-emerald-500/20",
      lvBg: "bg-emerald-500",
    };
  } else if (cat === "Passive") {
    if (total >= 20) return {
      containerCls: "border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20",
      lvBg: "bg-rose-500",
    };
  }
  return { containerCls: "", lvBg: "" };
}
