import type { NotifierItem, SpecificTime } from "./types";
import { serverNow } from "./time-sync";

/** 특정 시각 패턴(요일/매일/매시간 + HH:MM)의 다음 발생 ms.
 *  nowMs 인자 미지정 시 동기화된 서버 시간 사용. */
export function nextSpecific(t: SpecificTime, nowMs?: number): number {
  const now = new Date(nowMs ?? serverNow());
  // 매시간: day === -2
  if (t.day === -2) {
    const d = new Date(now);
    d.setSeconds(0, 0);
    d.setMinutes(t.minute | 0);
    if (d.getTime() <= now.getTime()) d.setHours(d.getHours() + 1);
    return d.getTime();
  }
  const d = new Date(now);
  d.setSeconds(0, 0);
  d.setHours(t.hour | 0, t.minute | 0, 0, 0);
  // 매일
  if (t.day === -1 || t.day == null) {
    if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1);
    return d.getTime();
  }
  // 특정 요일
  const cur = d.getDay();
  let delta = (t.day - cur + 7) % 7;
  if (delta === 0 && d.getTime() <= now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d.getTime();
}

export function nextSpawnMs(item: NotifierItem, nowMs?: number): number | null {
  if (item.cycleType === "cooldown") {
    if (!item.lastSpawnTs) return null;
    return item.lastSpawnTs + (item.cycleMinutes || 0) * 60_000;
  }
  if (!item.specificTimes?.length) return null;
  const tNow = nowMs ?? serverNow();
  let best = Number.POSITIVE_INFINITY;
  for (const st of item.specificTimes) {
    const v = nextSpecific(st, tNow);
    if (v < best) best = v;
  }
  return best === Number.POSITIVE_INFINITY ? null : best;
}

/** 다가오는 수요일 오전 5시 (주간 리셋) */
export function nextWedReset(nowMs?: number): number {
  const now = new Date(nowMs ?? serverNow());
  const d = new Date(now);
  d.setHours(5, 0, 0, 0);
  const cur = d.getDay();
  let delta = (3 - cur + 7) % 7; // 3 = 수요일
  if (delta === 0 && d.getTime() <= now.getTime()) delta = 7;
  d.setDate(d.getDate() + delta);
  return d.getTime();
}

/** 다음 N회 완료 시각 목록 (잡음→쿨 반복 가정), 주간 리셋 이전까지 */
export function nextSpawnList(item: NotifierItem, count = 5): number[] {
  const cutoff = nextWedReset();
  const out: number[] = [];
  if (item.cycleType === "cooldown") {
    let t = nextSpawnMs(item);
    if (t == null) return [];
    const cycleMs = (item.cycleMinutes || 0) * 60_000;
    if (cycleMs <= 0) return [];
    while (out.length < count && t < cutoff) {
      out.push(t);
      t += cycleMs;
    }
    return out;
  }
  const cand: number[] = [];
  for (const st of item.specificTimes || []) {
    let t = nextSpecific(st);
    const advance =
      st.day === -2 ? 3_600_000 :
      st.day === -1 ? 86_400_000 :
                      7 * 86_400_000;
    while (t < cutoff && cand.length < 100) {
      cand.push(t);
      t += advance;
    }
  }
  cand.sort((a, b) => a - b);
  return cand.slice(0, count);
}

export function formatRemaining(ms: number | null): string {
  if (ms == null) return "미설정";
  const neg = ms < 0;
  const abs = Math.abs(ms);
  const s = Math.floor(abs / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const sign = neg ? "- " : "";
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${sign}${h}시간 ${pad(m)}분 ${pad(sec)}초`;
  return `${sign}${pad(m)}분 ${pad(sec)}초`;
}

export function formatAbsTime(ts: number | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const day0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetDay = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((targetDay - day0) / 86_400_000);
  let label: string;
  if (diffDays === 0) label = "오늘";
  else if (diffDays === 1) label = "내일";
  else label = ["일", "월", "화", "수", "목", "금", "토"][d.getDay()];
  const pad = (n: number) => String(n).padStart(2, "0");
  return `(${label}) ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function typeKey(type: string): "event" | "abyss" | "cheon" | "mok" | "etc" {
  const map: Record<string, "event" | "abyss" | "cheon" | "mok"> = {
    이벤트: "event",
    어비스: "abyss",
    천족: "cheon",
    마족: "mok",
  };
  return map[type] ?? "etc";
}

export type RemainingPhase = "na" | "due" | "near" | "soon" | "normal";

export function remainingPhase(item: NotifierItem, ms: number | null): RemainingPhase {
  if (ms == null) return "na";
  if (ms <= 0) return "due";
  if (ms < 10 * 60_000) return "near";
  if (ms <= (item.notifyBeforeMin || 5) * 60_000) return "soon";
  return "normal";
}
