"use client";

import { useEffect, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { ZoomOut, ZoomIn } from "lucide-react";
import { useUiStore } from "@/lib/ui-store";
import { cn } from "@/lib/utils";

const STEP = 0.05;
const MIN = 0.5;
const MAX = 2.0;

/**
 * 메인 앱 화면 배율 — 헤더 3등분 카드 [돋보기- | 배율 | 돋보기+]. 가운데 클릭 시 팝오버.
 * 오버레이 윈도우 / iframe 임베드 모드에서는 비활성.
 */
export function MainScaleControl() {
  const pathname = usePathname() ?? "";
  const searchParams = useSearchParams();
  const isOverlayWindow = pathname.startsWith("/overlay/window/");
  const isEmbedded = searchParams?.get("embedded") === "1";
  const disabled = isOverlayWindow || isEmbedded;

  const mainScale = useUiStore((s) => s.mainScale);
  const setMainScale = useUiStore((s) => s.setMainScale);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (disabled) return;
    if (typeof document === "undefined") return;
    if (mainScale === 1) {
      document.body.style.zoom = "";
    } else {
      (document.body.style as unknown as { zoom: string }).zoom = String(mainScale);
    }
    return () => {
      document.body.style.zoom = "";
    };
  }, [mainScale, disabled]);

  if (disabled) return null;

  const clamp = (v: number) => Math.max(MIN, Math.min(MAX, v));
  const dec = () => setMainScale(clamp(Math.round((mainScale - STEP) * 100) / 100));
  const inc = () => setMainScale(clamp(Math.round((mainScale + STEP) * 100) / 100));
  const active = Math.abs(mainScale - 1) > 0.001;

  return (
    <div className="relative">
      <div
        className={cn(
          "inline-flex items-stretch h-8 rounded border text-xs font-bold overflow-hidden transition-colors",
          active
            ? "border-amber-400 bg-amber-400/15 text-amber-400"
            : "border-border text-muted-foreground"
        )}
      >
        <button
          onClick={dec}
          disabled={mainScale <= MIN + 0.001}
          title="축소"
          className="inline-flex items-center justify-center px-2 hover:bg-accent/10 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ZoomOut className="h-3.5 w-3.5" />
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          title={`화면 배율 ${Math.round(mainScale * 100)}% — 클릭하여 상세 설정`}
          className="inline-flex items-center justify-center px-2 min-w-[44px] border-l border-r border-current/20 tabular-nums hover:bg-accent/10"
        >
          {Math.round(mainScale * 100)}%
        </button>
        <button
          onClick={inc}
          disabled={mainScale >= MAX - 0.001}
          title="확대"
          className="inline-flex items-center justify-center px-2 hover:bg-accent/10 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ZoomIn className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-1 z-50 min-w-[260px] border border-border bg-background/95 backdrop-blur-sm shadow-lg rounded p-3 space-y-2">
            <div className="text-xs font-bold">화면 배율</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={MIN} max={MAX} step={STEP}
                value={mainScale}
                onChange={(e) => setMainScale(Number(e.target.value))}
                className="flex-1"
              />
              <input
                type="number"
                min={MIN * 100} max={MAX * 100} step={1}
                value={Math.round(mainScale * 100)}
                onChange={(e) => setMainScale(clamp(Number(e.target.value) / 100 || 1))}
                className="w-16 px-1 py-0.5 text-xs text-right tabular-nums rounded border bg-background"
              />
              <span className="text-xs text-muted-foreground">%</span>
            </div>
            <div className="flex gap-1">
              {[0.75, 1.0, 1.25, 1.5].map((v) => (
                <button
                  key={v}
                  onClick={() => setMainScale(v)}
                  className={cn(
                    "flex-1 px-2 py-1 text-[10px] rounded border transition-colors",
                    Math.abs(mainScale - v) < 0.025
                      ? "border-amber-400 bg-amber-400/15 text-amber-400"
                      : "border-border hover:bg-accent/10"
                  )}
                >
                  {Math.round(v * 100)}%
                </button>
              ))}
            </div>
            <p className="text-[10px] text-muted-foreground italic">
              메인 앱 화면 전체 확대/축소. 오버레이는 영향 없음.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
