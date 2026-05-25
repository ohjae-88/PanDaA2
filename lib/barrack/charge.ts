import { kstNow } from "./time";

/** 다음 KST 충전 시각의 UTC ms */
export function getNextChargeTs(kstHours: number[]): number {
  const now = Date.now();
  const kst = new Date(now + 9 * 3600 * 1000);
  for (let day = 0; day < 3; day++) {
    const d = new Date(kst);
    d.setUTCDate(kst.getUTCDate() + day);
    const sorted = [...kstHours].sort((a, b) => a - b);
    for (const h of sorted) {
      const c = new Date(d);
      c.setUTCHours(h, 0, 0, 0);
      const cUTC = c.getTime() - 9 * 3600 * 1000;
      if (cUTC > now) return cUTC;
    }
  }
  return now + 3600 * 1000;
}

/** 다음 주간 초기화(수요일 KST 5시) UTC ms */
export function getNextWeeklyResetTs(): number {
  const kst = kstNow();
  const day = kst.getUTCDay();
  const hour = kst.getUTCHours();
  let daysAhead = (3 - day + 7) % 7;
  if (daysAhead === 0 && hour >= 5) daysAhead = 7;
  const wed = new Date(kst);
  wed.setUTCDate(kst.getUTCDate() + daysAhead);
  wed.setUTCHours(5, 0, 0, 0);
  return wed.getTime() - 9 * 3600 * 1000;
}

/** 다음 일일 초기화 (KST 5시) UTC ms */
export function getNextDailyResetTs(): number {
  const kst = kstNow();
  const target = new Date(kst);
  target.setUTCHours(5, 0, 0, 0);
  if (kst.getTime() >= target.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - 9 * 3600 * 1000;
}

export function fmtCountdown(ms: number): string {
  if (ms <= 0) return "충전 중...";
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  if (h > 0) return `${h}시간 ${pad(m)}분 ${pad(sec)}초`;
  return `${m}분 ${pad(sec)}초`;
}

export function fmtCountdownLong(ms: number): string {
  if (ms <= 0) return "초기화 중...";
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d > 0) return `${d}일 ${h}시간 ${pad(m)}분`;
  if (h > 0) return `${h}시간 ${pad(m)}분`;
  return `${m}분 ${pad(s % 60)}초`;
}
