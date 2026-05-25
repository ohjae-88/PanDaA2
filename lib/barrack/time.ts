/** KST(UTC+9) 현재 시각 (Date 객체) */
export function kstNow(): Date {
  return new Date(Date.now() + 9 * 3600 * 1000);
}

/** KST 기준 오늘 날짜 (YYYY-MM-DD) */
export function todayStr(): string {
  return kstNow().toISOString().slice(0, 10);
}

/**
 * KST 기준 이번 주 수요일 5AM 기준 날짜 문자열.
 * 수요일 오전 5시 이전이면 지난 주 수요일 기준.
 */
export function weekStr(): string {
  const kst = kstNow();
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();
  let daysBack = (day - 3 + 7) % 7;
  if (daysBack === 0 && hour < 5) daysBack = 7;
  const wed = new Date(kst);
  wed.setUTCDate(kst.getUTCDate() - daysBack);
  return wed.toISOString().slice(0, 10);
}

const DOW_KR = ["일", "월", "화", "수", "목", "금", "토"];

export function formatToday(): string {
  const d = kstNow();
  return `${d.getUTCFullYear()}년 ${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${DOW_KR[d.getUTCDay()]}) · 주간초기화: 매주 수요일 오전 5시`;
}

export function fmtN(n: number | undefined | null): string {
  return Number(n || 0).toLocaleString("ko-KR");
}

/** 다음 KST 충전 시각까지의 ms */
export function nextChargeMs(kstHours: number[]): number {
  const kst = kstNow();
  const today = new Date(kst);
  today.setUTCHours(0, 0, 0, 0);
  const sorted = [...kstHours].sort((a, b) => a - b);
  for (const h of sorted) {
    const c = new Date(today);
    c.setUTCHours(h, 0, 0, 0);
    if (c.getTime() > kst.getTime()) return c.getTime() - kst.getTime();
  }
  // 오늘 마지막 충전 시각도 지남 → 내일 첫 충전
  const tomorrow = new Date(today);
  tomorrow.setUTCDate(today.getUTCDate() + 1);
  tomorrow.setUTCHours(sorted[0], 0, 0, 0);
  return tomorrow.getTime() - kst.getTime();
}

/** ms를 "Hh Mm Ss" 형태 */
export function formatHMS(ms: number): string {
  if (ms < 0) ms = 0;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}시간 ${m}분 ${sec}초`;
  if (m > 0) return `${m}분 ${sec}초`;
  return `${sec}초`;
}

/** 다음 주간 초기화(수요일 5AM)까지 남은 ms */
export function nextWeeklyResetMs(): number {
  const kst = kstNow();
  const target = new Date(kst);
  target.setUTCHours(5, 0, 0, 0);
  const day = target.getUTCDay();
  let delta = (3 - day + 7) % 7;
  if (delta === 0 && kst.getTime() >= target.getTime()) delta = 7;
  target.setUTCDate(target.getUTCDate() + delta);
  return target.getTime() - kst.getTime();
}

/**
 * fromTs ~ toTs 사이 (둘 다 UTC ms)에 KST 특정 시각이 몇 번 지나갔는지.
 */
export function countChargesBetween(
  kstHours: number[],
  fromTs: number | null | undefined,
  toTs: number
): number {
  if (!fromTs || fromTs >= toTs) return 0;
  let count = 0;
  const fromKST = new Date(fromTs + 9 * 3600 * 1000);
  const toKST = new Date(toTs + 9 * 3600 * 1000);
  const startDay = new Date(fromKST);
  startDay.setUTCHours(0, 0, 0, 0);
  for (let d = new Date(startDay); d.getTime() <= toKST.getTime() + 86_400_000; d.setUTCDate(d.getUTCDate() + 1)) {
    for (const h of kstHours) {
      const c = new Date(d);
      c.setUTCHours(h, 0, 0, 0);
      const cUTC = c.getTime() - 9 * 3600 * 1000;
      if (cUTC > fromTs && cUTC <= toTs) count++;
    }
  }
  return count;
}

/** toTs(UTC ms) 이전(포함)의 가장 최근 KST 충전 시각 (UTC ms) */
export function getLastChargeTs(kstHours: number[], toTs: number): number {
  const kst = new Date(toTs + 9 * 3600 * 1000);
  for (let day = 0; day < 10; day++) {
    const d = new Date(kst);
    d.setUTCDate(kst.getUTCDate() - day);
    const sorted = [...kstHours].sort((a, b) => b - a);
    for (const h of sorted) {
      const c = new Date(d);
      c.setUTCHours(h, 0, 0, 0);
      const cUTC = c.getTime() - 9 * 3600 * 1000;
      if (cUTC <= toTs) return cUTC;
    }
  }
  return toTs;
}

export function uid(prefix = "id"): string {
  return prefix + Date.now() + Math.random().toString(36).slice(2, 6);
}
