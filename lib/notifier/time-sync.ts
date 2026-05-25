"use client";

import { isTauri } from "@/lib/tauri";

/**
 * 서버 시간 동기화 — Date.now()는 클라이언트 시계 의존.
 * 게임 서버(aion2.plaync.com) Date 헤더로 오프셋 계산 후 serverNow()로 사용.
 *
 *   serverNow() = Date.now() + serverOffsetMs
 *
 * RTT/2 보정으로 초 단위 정밀도 달성.
 */

type SyncStatus = {
  /** 마지막 동기화 시 측정한 server - client 오프셋 (ms) */
  offsetMs: number;
  /** 마지막 동기화 성공 시각 (Date.now ms) */
  lastSyncedAt: number;
  /** 마지막 RTT (ms) — 신뢰도 지표 */
  lastRttMs: number;
  /** 마지막 시도 시각 (성공/실패 무관) */
  lastAttemptAt: number;
  /** 마지막 에러 메시지 (성공 시 null) */
  lastError: string | null;
};

const state: SyncStatus = {
  offsetMs: 0,
  lastSyncedAt: 0,
  lastRttMs: 0,
  lastAttemptAt: 0,
  lastError: null,
};

const listeners = new Set<() => void>();
function emit() { listeners.forEach((l) => l()); }
export function subscribeTimeSync(cb: () => void) { listeners.add(cb); return () => listeners.delete(cb); }

/** 동기화된 서버 시간 (UTC ms). 동기화 전엔 Date.now()와 동일. */
export function serverNow(): number {
  return Date.now() + state.offsetMs;
}

export function getTimeSyncStatus(): Readonly<SyncStatus> {
  return state;
}

/** Date 헤더(예: "Wed, 21 Oct 2025 07:28:00 GMT") → UTC ms */
function parseHttpDate(s: string): number | null {
  const t = Date.parse(s.trim());
  return Number.isFinite(t) ? t : null;
}

async function fetchServerTimeRaw(): Promise<{ dateHeader: string; rtt: number; midClient: number }> {
  const t0 = Date.now();

  if (isTauri()) {
    const mod = await import("@tauri-apps/api/core");
    const dateHeader = await mod.invoke<string>("fetch_server_time");
    const t1 = Date.now();
    return { dateHeader, rtt: t1 - t0, midClient: t0 + (t1 - t0) / 2 };
  }

  // 브라우저 폴백 — fetch 후 Date 헤더 읽기
  const res = await fetch("https://aion2.plaync.com/", { method: "HEAD" });
  const t1 = Date.now();
  const dateHeader = res.headers.get("date") || "";
  if (!dateHeader) throw new Error("no Date header (CORS may strip headers)");
  return { dateHeader, rtt: t1 - t0, midClient: t0 + (t1 - t0) / 2 };
}

/** 서버 시간 동기화 1회 시도. 성공 시 offsetMs 갱신. */
export async function syncServerTime(): Promise<boolean> {
  state.lastAttemptAt = Date.now();
  try {
    const { dateHeader, rtt, midClient } = await fetchServerTimeRaw();
    const serverTs = parseHttpDate(dateHeader);
    if (serverTs == null) throw new Error(`parse fail: "${dateHeader}"`);
    // RTT의 절반이 서버 처리 시점 추정 → 그 시점의 클라이언트 시각이 midClient
    state.offsetMs = serverTs - midClient;
    state.lastSyncedAt = Date.now();
    state.lastRttMs = rtt;
    state.lastError = null;
    emit();
    return true;
  } catch (err) {
    state.lastError = (err as Error).message;
    emit();
    return false;
  }
}

/** 자동 동기화 — 마운트 시 + 매 N분마다. cleanup 함수 반환. */
export function startTimeSync(intervalMin = 5): () => void {
  void syncServerTime(); // 초기 1회
  const id = setInterval(() => { void syncServerTime(); }, intervalMin * 60_000);
  return () => clearInterval(id);
}
