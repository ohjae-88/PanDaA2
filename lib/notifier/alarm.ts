"use client";

import { create } from "zustand";

/**
 * 활성 알람 상태 — 알람 트리거된 항목별 만료 시각(epoch ms) 저장.
 * 오버레이/메인 모두 동일 store 구독 — 카드 강조 애니메이션 + 사운드 트리거.
 * persist 하지 않음 (런타임 일회성 상태).
 */
type ActiveAlarmsState = {
  /** itemId → expiresAt (ms). 만료된 항목은 selector에서 필터링 */
  alarms: Record<string, number>;
  /** 항목별 알람 트리거 — durationMs 동안 강조 유지 */
  trigger: (itemId: string, durationMs?: number) => void;
  /** 특정 항목 해제 (사용자가 카드 클릭하여 잡았을 때 등) */
  clear: (itemId: string) => void;
  /** 만료된 항목 정리 — 1초마다 호출 */
  prune: () => void;
};

export const useActiveAlarms = create<ActiveAlarmsState>((set, get) => ({
  alarms: {},
  trigger: (itemId, durationMs = 15_000) => {
    const expires = Date.now() + durationMs;
    set((s) => ({ alarms: { ...s.alarms, [itemId]: expires } }));
  },
  clear: (itemId) =>
    set((s) => {
      if (!(itemId in s.alarms)) return s;
      const next = { ...s.alarms };
      delete next[itemId];
      return { alarms: next };
    }),
  prune: () => {
    const now = Date.now();
    const cur = get().alarms;
    let changed = false;
    const next: Record<string, number> = {};
    for (const [k, v] of Object.entries(cur)) {
      if (v > now) next[k] = v;
      else changed = true;
    }
    if (changed) set({ alarms: next });
  },
}));

/** 사용 가능한 알람음 목록. 'beep'는 WebAudio 합성, 그 외는 파일 재생.
 *  추가 파일은 public/sounds/ 에 두고 이 배열에 등록. */
export type AlarmSound = {
  id: string;
  label: string;
  kind: "synth" | "file";
  /** kind="file" 일 때 public 기준 경로 (예: /sounds/foo.wav) */
  url?: string;
};

export const ALARM_SOUNDS: AlarmSound[] = [
  { id: "beep", label: "기본 비프 (합성)", kind: "synth" },
  { id: "난니가킹받았음좋겠어", label: "난니가킹받았음좋겠어", kind: "file", url: "/sounds/난니가킹받았음좋겠어.wav" },
  { id: "중전마마납시오", label: "중전마마납시오", kind: "file", url: "/sounds/중전마마납시오.wav" },
  { id: "Hawaii-Five-O_드럼", label: "Hawaii-Five-O_드럼", kind: "file", url: "/sounds/Hawaii-Five-O_드럼.wav" },
  { id: "호박고구마", label: "호박고구마", kind: "file", url: "/sounds/호박고구마.wav" },
  { id: "goodmorning-lg-cyon", label: "굿모닝 (LG Cyon)", kind: "file", url: "/sounds/goodmorning-lg-cyon.wav" },
];

/** WebAudio 비프 — 외부 mp3/wav 의존 없음. */
let cachedCtx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (cachedCtx) return cachedCtx;
  try {
    const W = window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext };
    const Ctor = W.AudioContext || W.webkitAudioContext;
    if (!Ctor) return null;
    cachedCtx = new Ctor();
    return cachedCtx;
  } catch {
    return null;
  }
}

function playSynthBeep(volume: number) {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") void ctx.resume();
  } catch { /* ignore */ }
  const v = Math.max(0, Math.min(1, volume));
  const startAt = ctx.currentTime;
  function beep(freq: number, t0: number, dur: number) {
    const osc = ctx!.createOscillator();
    const gain = ctx!.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(v, t0 + 0.02);
    gain.gain.linearRampToValueAtTime(v, t0 + dur - 0.02);
    gain.gain.linearRampToValueAtTime(0, t0 + dur);
    osc.connect(gain);
    gain.connect(ctx!.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.02);
  }
  beep(880, startAt, 0.15);
  beep(1320, startAt + 0.18, 0.18);
}

/** 파일 기반 재생 — Audio 엘리먼트 캐싱. 새 호출 시 이전 재생 중단 후 처음부터. */
const audioCache = new Map<string, HTMLAudioElement>();
function playFile(url: string, volume: number) {
  if (typeof window === "undefined") return;
  let el = audioCache.get(url);
  if (!el) {
    el = new Audio(url);
    el.preload = "auto";
    audioCache.set(url, el);
  }
  el.volume = Math.max(0, Math.min(1, volume));
  try {
    el.currentTime = 0;
    void el.play().catch(() => {});
  } catch { /* ignore */ }
}

/** 통합 알람 재생 — soundId 따라 합성/파일 분기 */
export function playAlarm(volume: number = 0.6, soundId: string = "beep") {
  const sound = ALARM_SOUNDS.find((x) => x.id === soundId) ?? ALARM_SOUNDS[0];
  if (sound.kind === "file" && sound.url) playFile(sound.url, volume);
  else playSynthBeep(volume);
}

/** 하위호환 — 기존 코드의 playAlarmBeep 호출 유지. soundId 미지정 시 기본 비프 */
export function playAlarmBeep(volume: number = 0.6, soundId?: string) {
  playAlarm(volume, soundId ?? "beep");
}
