"use client";

import { useEffect, useState } from "react";
import { Clock, RefreshCw } from "lucide-react";
import { serverNow, syncServerTime, getTimeSyncStatus } from "@/lib/notifier/time-sync";
import { cn } from "@/lib/utils";

/** 헤더용 라이브 서버 시계 배지 — KST HH:MM:SS + 동기화 버튼 */
export function ServerClockBadge() {
  const [, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    // 벽시계 초 경계 정렬 — 메인/오버레이 시계 동기화
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const schedule = () => {
      if (stopped) return;
      const ms = Date.now();
      const delay = 1000 - (ms % 1000);
      timer = setTimeout(() => {
        setTick((t) => t + 1);
        schedule();
      }, delay);
    };
    schedule();
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  // KST = UTC + 9
  const d = new Date(serverNow() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const h = pad(d.getUTCHours());
  const m = pad(d.getUTCMinutes());
  const s = pad(d.getUTCSeconds());

  const st = getTimeSyncStatus();
  const synced = st.lastSyncedAt > 0 && !st.lastError;

  async function handleSync() {
    setSyncing(true);
    try { await syncServerTime(); }
    finally { setSyncing(false); }
  }

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3 px-4 py-1.5 rounded-lg border-2 bg-card shadow-sm",
        synced ? "border-cat-notifier/40" : "border-amber-500/40"
      )}
      title={
        synced
          ? `서버 시간 (KST) · 오프셋 ${st.offsetMs >= 0 ? "+" : ""}${Math.round(st.offsetMs)}ms · RTT ${st.lastRttMs}ms`
          : "아직 서버 시간 미동기화"
      }
    >
      <Clock className={cn("h-6 w-6", synced ? "text-cat-notifier" : "text-amber-500")} />
      <span className="text-2xl font-extrabold tabular-nums tracking-wide">
        {h}:{m}:{s}
      </span>
      <button
        onClick={handleSync}
        disabled={syncing}
        className="inline-flex items-center justify-center w-8 h-8 rounded border bg-background hover:bg-accent/20 transition-colors disabled:opacity-50"
        title="서버 시간 다시 동기화"
      >
        <RefreshCw className={cn("h-4 w-4", syncing && "animate-spin")} />
      </button>
    </div>
  );
}
