"use client";

import { useEffect, useState } from "react";
import { Clock, RefreshCw, CheckCircle2, AlertCircle } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { getTimeSyncStatus, subscribeTimeSync, syncServerTime, serverNow } from "@/lib/notifier/time-sync";
import { subscribeSecondTick } from "@/lib/util/global-tick";
import { cn } from "@/lib/utils";

export function TimeSyncCard() {
  const [tick, setTick] = useState(0);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    const unsub = subscribeTimeSync(() => setTick((t) => t + 1));
    const unsubTick = subscribeSecondTick(() => setTick((t) => t + 1));
    return () => { unsub(); unsubTick(); };
  }, []);

  // tick은 리렌더 트리거 — 직접 사용 없음
  void tick;

  const st = getTimeSyncStatus();
  const synced = st.lastSyncedAt > 0 && !st.lastError;
  const ageMs = st.lastSyncedAt ? Date.now() - st.lastSyncedAt : null;
  const ageLabel = ageMs == null ? "미동기화"
    : ageMs < 60_000 ? `${Math.floor(ageMs / 1000)}초 전`
    : ageMs < 3_600_000 ? `${Math.floor(ageMs / 60_000)}분 전`
    : "1시간+";

  // KST 변환 — UTC+9
  const nowKst = new Date(serverNow() + 9 * 3600 * 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const kstStr = `${nowKst.getUTCFullYear()}-${pad(nowKst.getUTCMonth() + 1)}-${pad(nowKst.getUTCDate())} ${pad(nowKst.getUTCHours())}:${pad(nowKst.getUTCMinutes())}:${pad(nowKst.getUTCSeconds())}`;

  async function handleSync() {
    setSyncing(true);
    try { await syncServerTime(); }
    finally { setSyncing(false); }
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-4 w-4" /> 서버 시간 동기화
        </CardTitle>
        <Button size="xs" variant="ghost" onClick={handleSync} disabled={syncing}>
          <RefreshCw className={cn("h-3 w-3", syncing && "animate-spin")} /> 지금 동기화
        </Button>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p className="text-xs text-muted-foreground">
          알리미는 클라이언트 시계가 아닌 <b>aion2.plaync.com 서버 시간</b>으로 잔여 시간과 알림 트리거를 계산합니다.
          시작 시 1회 + 5분마다 자동 동기화.
        </p>
        <div className="rounded border bg-card/40 p-3">
          <div className="text-[11px] text-muted-foreground mb-1">현재 서버 시각 (KST)</div>
          <div className="text-xl font-extrabold tabular-nums">{kstStr}</div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-xs">
          <div className="rounded border bg-background/50 px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">상태</div>
            <div className={cn("font-bold flex items-center gap-1", synced ? "text-emerald-600 dark:text-emerald-300" : "text-rose-600 dark:text-rose-300")}>
              {synced ? <><CheckCircle2 className="h-3 w-3" /> 동기화</> : <><AlertCircle className="h-3 w-3" /> 미동기화</>}
            </div>
          </div>
          <div className="rounded border bg-background/50 px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">오프셋</div>
            <div className="font-bold tabular-nums">{st.offsetMs >= 0 ? "+" : ""}{Math.round(st.offsetMs)} ms</div>
          </div>
          <div className="rounded border bg-background/50 px-2 py-1.5">
            <div className="text-[10px] text-muted-foreground">RTT</div>
            <div className="font-bold tabular-nums">{st.lastRttMs || "-"} ms</div>
          </div>
        </div>
        <div className="text-[11px] text-muted-foreground">
          마지막 동기화: <b className="text-foreground">{ageLabel}</b>
          {st.lastError && (
            <div className="text-rose-500 mt-1">오류: {st.lastError}</div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
