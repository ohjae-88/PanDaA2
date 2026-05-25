"use client";

import { useEffect } from "react";
import { useNotifierStore } from "@/lib/notifier/store";
import { nextSpawnMs } from "@/lib/notifier/time";
import { serverNow, startTimeSync } from "@/lib/notifier/time-sync";
import { useNotifierAlert } from "@/components/notifier/alert-modal";
import { useCombinedAlert } from "@/components/notifier/combined-alert-modal";
import { useActiveAlarms, playAlarmBeep } from "@/lib/notifier/alarm";

/**
 * 1초 간격 tick — 자동 진행 + 알림 트리거.
 *
 * 발사 우선순위 (한 멤버는 동일 사이클에 한 번만):
 *  1) 그룹 합산 알림 (그룹의 anchor 멤버 next-spawn ≤ group.beforeMin*60s)
 *     → perItemEnabled[memberId]===false 인 멤버는 개별 알림 봉인 (notified key 선마킹)
 *  2) 기본 합산 알림 (combineEnabled & ≤ combineThresholdMin*60s 항목 2개 이상)
 *     → 합산에 포함된 항목은 개별 알림 봉인
 *  3) 개별 분 전 알림 (item.notifyBeforeMin)
 *  4) 직전 알림 (settings.notifyAtZero, N초 전)
 */
/** 같은 webview에서 useNotifierTick이 여러 컴포넌트에 마운트되어도
 *  setInterval은 1개만 동작하도록 보호하는 모듈 가드. */
let tickRunning = false;

/** 합산/그룹 합산 알림 사운드 디바운스 — 짧은 시간 연속 알람 방지.
 *  사운드 한 번 울리면 임계 시간 동안 추가 사운드 억제. 모달/하이라이트는 영향 없음. */
let lastCombineSoundAt = 0;
const lastGroupSoundAt: Record<string, number> = {};

export function useNotifierTick() {
  const showSingle = useNotifierAlert((s) => s.show);
  const showCombined = useCombinedAlert((s) => s.show);

  useEffect(() => {
    if (tickRunning) return;
    tickRunning = true;
    const tick = () => {
      const s = useNotifierStore.getState();
      s.autoAdvanceCooldowns();
      // 만료된 알람 정리
      useActiveAlarms.getState().prune();
      const now = serverNow();
      const items = s.items;
      const groups = s.groupDefs ?? [];
      const settings = s.settings;

      // 알람 발화 헬퍼 — 사운드 + 카드 강조
      const soundEnabled = settings?.soundEnabled !== false;  // 기본 true
      const volume = Number(settings?.soundVolume ?? 0.6);
      const soundId = settings?.alarmSoundId ?? "beep";
      const highlightSec = Number(settings?.alarmHighlightSec ?? 15);
      const highlightMs = Math.max(0, highlightSec) * 1000;
      function fireHighlight(ids: string[]) {
        if (highlightMs > 0) {
          ids.forEach((id) => useActiveAlarms.getState().trigger(id, highlightMs));
        }
      }
      function fireSound() {
        if (soundEnabled) playAlarmBeep(volume, soundId);
      }
      /** 개별/직전 알림 — 항상 사운드 발화 (기존 동작 유지) */
      function fire(ids: string[]) {
        fireHighlight(ids);
        fireSound();
      }

      // 멤버별 알림 봉인 표시 — 합산/그룹에서 처리된 멤버 (이번 tick 내 set)
      const sealedByCombined = new Set<string>();

      // ── 1) 그룹 합산 알림 ────────────────────────────────
      for (const g of groups) {
        if (!g.enabled) continue;
        const members = items.filter((it) => it.groups?.includes(g.id));
        if (!members.length) continue;
        // anchor = 가장 빠른 멤버
        let anchorTime = Infinity;
        const memberTimes: { item: typeof members[0]; t: number | null }[] = [];
        members.forEach((it) => {
          const t = nextSpawnMs(it);
          memberTimes.push({ item: it, t });
          if (t != null && t < anchorTime) anchorTime = t;
        });
        if (!Number.isFinite(anchorTime)) continue;
        const rem = anchorTime - now;
        const threshold = (g.beforeMin || 0) * 60_000;
        if (rem > 0 && rem <= threshold) {
          const key = `group_${g.id}_${anchorTime}`;
          if (!s.notified[key]) {
            s.markNotified(key);
            // 발사 시점의 멤버 잔여시간 순 정렬
            const sorted = memberTimes
              .slice()
              .sort((a, b) => (a.t ?? Infinity) - (b.t ?? Infinity))
              .map((m) => m.item);
            showCombined("group", g.name, sorted);
            fireHighlight(sorted.map((m) => m.id));
            // 짧은 시간 연속 알람 방지 — 그룹별 사운드 디바운스(그룹 beforeMin 기준 윈도우)
            const groupCooldownMs = Math.max(60_000, (g.beforeMin || 0) * 60_000);
            if (Date.now() - (lastGroupSoundAt[g.id] || 0) >= groupCooldownMs) {
              fireSound();
              lastGroupSoundAt[g.id] = Date.now();
            }
            // 그룹 멤버의 개별 알림 봉인 처리 (perItemEnabled===false 인 항목)
            members.forEach((m) => {
              const indivOn = g.perItemEnabled?.[m.id] ?? true;
              if (!indivOn) {
                const t = nextSpawnMs(m);
                if (t != null) {
                  s.markNotified(`${m.id}_${t}`);
                }
              }
            });
          }
        }
      }

      // ── 2) 기본 합산 알림 ────────────────────────────────
      if (settings?.combineEnabled) {
        const threshold = (settings.combineThresholdMin || 0) * 60_000;
        const enabled = items.filter((it) => it.notifyEnabled);
        const imminent: { item: typeof enabled[0]; t: number }[] = [];
        enabled.forEach((it) => {
          const t = nextSpawnMs(it);
          if (t == null) return;
          const rem = t - now;
          if (rem > 0 && rem <= threshold) imminent.push({ item: it, t });
        });
        if (imminent.length >= 2) {
          imminent.sort((a, b) => a.t - b.t);
          // 키 = 합산 멤버의 id+time 정렬 해시 (한 번만 발사)
          const sig = imminent.map((m) => `${m.item.id}@${m.t}`).join("|");
          const key = `combine_${sig}`;
          if (!s.notified[key]) {
            s.markNotified(key);
            showCombined("combine", `${imminent.length}개 항목 임박 (${settings.combineThresholdMin}분 이내)`, imminent.map((m) => m.item));
            fireHighlight(imminent.map((m) => m.item.id));
            // 짧은 시간 연속 알람 방지 — 합산 임계 윈도우 동안 사운드 1회만
            const combineCooldownMs = Math.max(60_000, (settings.combineThresholdMin || 0) * 60_000);
            if (Date.now() - lastCombineSoundAt >= combineCooldownMs) {
              fireSound();
              lastCombineSoundAt = Date.now();
            }
            // 합산 표시된 항목들은 같은 사이클의 개별 알림 봉인
            imminent.forEach((m) => {
              s.markNotified(`${m.item.id}_${m.t}`);
              sealedByCombined.add(m.item.id);
            });
          }
        }
      }

      // ── 3) 개별 분 전 알림 ────────────────────────────────
      // ── 4) 직전 알림 (N초 전) ────────────────────────────
      items.forEach((it) => {
        if (!it.notifyEnabled) return;
        const next = nextSpawnMs(it);
        if (next == null) return;
        const rem = next - now;

        // 3) 분 전
        // [C 정책] visibility-aware tick 리스크 완화 — 임계 통과 후 spawn 전이면
        // catch-up 발화 (트레이 hide 동안 알람 시각 통과한 경우). 단 spawn 시각
        // 너무 지난 알람(rem < -threshold)은 의미 없으므로 skip.
        const threshold = (it.notifyBeforeMin || 5) * 60_000;
        if (rem <= threshold && rem > -threshold) {
          const key = `${it.id}_${next}`;
          if (!s.notified[key]) {
            s.markNotified(key);
            // 합산 봉인 항목은 건너뜀
            if (!sealedByCombined.has(it.id)) {
              showSingle(it, rem);
              fire([it.id]);
            }
          }
        }

        // 4) 직전 알림 (글로벌 N초 전)
        if (settings?.notifyAtZero) {
          const sec = Number(settings.notifyAtZeroSec) || 0;
          const trigger = next - sec * 1000;
          if (now >= trigger && now < trigger + 2000) {
            const key0 = `${it.id}_${next}_zero`;
            if (!s.notified[key0]) {
              s.markNotified(key0);
              showSingle(it, rem);
              fire([it.id]);
            }
          }
        }
      });
    };
    // 서버 시간 동기화 시작 (5분마다 재동기화)
    const stopSync = startTimeSync(5);
    tick();
    // 알람 tick — visibility 무시, 항상 1초 동작 (브라우저 throttle은 어쩔 수 없음)
    const id = setInterval(tick, 1000);
    // [B 정책] 가시 복귀 시 즉시 catch-up 1회 — webview hidden / system sleep 후 복귀 시 누락 발화 보전
    const onVis = () => {
      if (typeof document !== "undefined" && document.visibilityState === "visible") {
        tick();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", onVis);
    }
    return () => {
      clearInterval(id);
      stopSync();
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", onVis);
      }
      tickRunning = false;
    };
  }, [showSingle, showCombined]);
}
