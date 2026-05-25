"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Monitor, MonitorOff, Settings } from "lucide-react";
import { isTauri } from "@/lib/tauri";
import { toggleOverlay, isOverlayOpen, onOverlayStateChanged } from "@/lib/overlay/tauri";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/util/toast";

type Props = {
  /** 오른쪽 설정 톱니바퀴 아이콘이 가리킬 경로 */
  settingsHref?: string;
  /** 현재 경로가 설정 페이지인지 여부 */
  settingsActive?: boolean;
};

export function OverlayToggleButton({ settingsHref, settingsActive }: Props) {
  const [running, setRunning] = useState(false);
  const [busy, setBusy] = useState(false);
  // SSR과 첫 클라이언트 렌더 일치를 위해 mount 후에만 Tauri 감지 — 하이드레이션 mismatch 방지
  const [inTauri, setInTauri] = useState(false);

  async function refresh() {
    if (!isTauri()) return;
    try { setRunning(await isOverlayOpen()); } catch { setRunning(false); }
  }
  useEffect(() => {
    setInTauri(isTauri());
    void refresh();
    // 폴링 제거 — Rust 측 'overlay-state-changed' 이벤트로 즉시 갱신
    let unlisten: (() => void) | null = null;
    let disposed = false;
    onOverlayStateChanged((open) => setRunning(open)).then((un) => {
      if (disposed) un();
      else unlisten = un;
    });
    return () => {
      disposed = true;
      unlisten?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleClick() {
    if (!inTauri) {
      toast.warning("오버레이는 데스크톱 앱(Tauri) 환경에서만 사용 가능합니다.");
      return;
    }
    setBusy(true);
    try {
      const next = await toggleOverlay();
      setRunning(next);
    } catch (e) {
      toast.error("오버레이 토글 실패: " + (e as Error).message);
    } finally { setBusy(false); }
  }

  const onActive = running;
  const tone = onActive
    ? "border-amber-400 text-amber-400"
    : "border-border text-muted-foreground";

  return (
    <div
      className={cn(
        "inline-flex items-stretch h-8 rounded border overflow-hidden",
        tone,
        !inTauri && "opacity-50"
      )}
    >
      <button
        onClick={handleClick}
        disabled={busy}
        title={running ? "오버레이 닫기" : "오버레이 열기"}
        className={cn(
          "inline-flex items-center gap-1 px-3 text-xs font-bold transition-colors",
          onActive ? "bg-amber-400/15 hover:bg-amber-400/25" : "hover:bg-accent/10 hover:text-foreground"
        )}
      >
        {running ? <Monitor className="h-3.5 w-3.5" /> : <MonitorOff className="h-3.5 w-3.5" />}
        <span>오버레이 {running ? "ON" : "OFF"}</span>
      </button>
      {settingsHref && (
        <Link
          href={settingsHref}
          title="오버레이 설정"
          aria-label="오버레이 설정"
          className={cn(
            "inline-flex items-center justify-center px-2 border-l border-current/30 transition-colors",
            settingsActive
              ? "bg-amber-400/15 text-amber-400"
              : "hover:bg-accent/10 hover:text-foreground"
          )}
        >
          <Settings className="h-3.5 w-3.5" />
        </Link>
      )}
    </div>
  );
}
