"use client";

/**
 * 글로벌 1초 tick — 표시용 (시계/카운트다운 갱신).
 *
 * 설계 원칙:
 *  - 모듈 단일 setInterval 운영, 모든 구독자에 fan-out (메인스레드 부하 분산)
 *  - visibility-aware: document.hidden 시 일시 정지, visible 복귀 시 즉시 catch-up 1회
 *  - 콜백 try/catch 격리 — listener 1개 에러가 다른 listener 영향 안 줌
 *
 * 알람 발화 tick (useNotifierTick)는 이 모듈 사용 안 함 — visibility 무시하고
 * 항상 동작해야 알람 누락 방지. 표시 컴포넌트만 사용.
 */

const listeners = new Set<() => void>();
let intervalId: number | null = null;

function fire() {
  for (const cb of listeners) {
    try {
      cb();
    } catch (e) {
      console.error("[global-tick] listener error", e);
    }
  }
}

function startInterval() {
  if (intervalId != null) return;
  intervalId = window.setInterval(fire, 1000);
}

function stopInterval() {
  if (intervalId != null) {
    clearInterval(intervalId);
    intervalId = null;
  }
}

function onVisibilityChange() {
  if (typeof document === "undefined") return;
  if (document.visibilityState === "visible") {
    fire(); // catch-up — hidden 동안 누락된 갱신 즉시 처리
    if (listeners.size > 0) startInterval();
  } else {
    stopInterval();
  }
}

if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", onVisibilityChange);
}

/** 1초 tick 구독 — cleanup 함수 반환.
 *  visible 상태일 때만 동작, hidden 시 자동 정지. */
export function subscribeSecondTick(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof document === "undefined" || document.visibilityState === "visible") {
    startInterval();
  }
  return () => {
    listeners.delete(cb);
    if (listeners.size === 0) stopInterval();
  };
}
