"use client";

import { useEffect, useRef, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  capturePrimary, captureWindow, listWindows, useOcrStore,
  type CaptureResult, type OcrRegion, type WinInfo,
} from "@/lib/notifier/ocr-store";
import { isTauri } from "@/lib/tauri";
import { toast } from "@/lib/util/toast";

type Props = { open: boolean; onClose: () => void };
type Rect = { x: number; y: number; w: number; h: number };

const PRIMARY = "__primary__";

export function RegionSelectDialog({ open, onClose }: Props) {
  const setRegion = useOcrStore((s) => s.setRegion);
  const setWindowTitle = useOcrStore((s) => s.setWindowTitle);
  const savedTitle = useOcrStore((s) => s.windowTitle);

  const [windows, setWindows] = useState<WinInfo[]>([]);
  const [target, setTarget] = useState<string>(PRIMARY); // 창 제목 or PRIMARY
  const [cap, setCap] = useState<CaptureResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const dragStart = useRef<{ x: number; y: number } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  // 열릴 때 창 목록 로드
  useEffect(() => {
    if (!open) return;
    setRect(null);
    setCap(null);
    setTarget(savedTitle ?? PRIMARY);
    if (!isTauri()) return;
    listWindows()
      .then((ws) => {
        const list = ws ?? [];
        setWindows(list);
        // 저장된 대상 없으면 "AION2 …" 창 자동 선택
        if (!savedTitle) {
          const aion = list.find((w) => w.title.startsWith("AION2") || w.title.includes("AION2"));
          if (aion) setTarget(aion.title);
        }
      })
      .catch(() => setWindows([]));
  }, [open, savedTitle]);

  async function doCapture(t: string) {
    if (!isTauri()) return;
    setLoading(true);
    setRect(null);
    setCap(null);
    try {
      const c = t === PRIMARY ? await capturePrimary() : await captureWindow(t);
      setCap(c);
    } catch (e) {
      toast.error(`캡처 실패: ${e}`);
    } finally {
      setLoading(false);
    }
  }

  function relPos(e: React.MouseEvent): { x: number; y: number } {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const r = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(r.width, e.clientX - r.left)),
      y: Math.max(0, Math.min(r.height, e.clientY - r.top)),
    };
  }
  function onDown(e: React.MouseEvent) {
    e.preventDefault();
    const p = relPos(e);
    dragStart.current = p;
    setRect({ x: p.x, y: p.y, w: 0, h: 0 });
  }
  function onMove(e: React.MouseEvent) {
    if (!dragStart.current) return;
    const p = relPos(e);
    const s = dragStart.current;
    setRect({ x: Math.min(s.x, p.x), y: Math.min(s.y, p.y), w: Math.abs(p.x - s.x), h: Math.abs(p.y - s.y) });
  }
  function onUp() {
    dragStart.current = null;
  }

  function handleSave() {
    if (!cap || !rect || rect.w < 4 || rect.h < 4) { toast.error("영역을 드래그하여 지정하세요."); return; }
    const img = imgRef.current;
    if (!img) return;
    const scale = cap.width / img.clientWidth; // 표시 px → 물리 px
    const region: OcrRegion = { x: rect.x * scale, y: rect.y * scale, w: rect.w * scale, h: rect.h * scale };
    setRegion(region);
    setWindowTitle(target === PRIMARY ? null : target);
    toast.success("캡처 대상·영역 저장됨");
    onClose();
  }

  const scaleNow = cap && imgRef.current ? cap.width / (imgRef.current.clientWidth || cap.width) : 1;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[96vw] w-[96vw]">
        <DialogHeader>
          <DialogTitle>🎯 캡처 대상·영역 지정 — 보스 잔여시간 목록</DialogTitle>
        </DialogHeader>
        {!isTauri() ? (
          <div className="text-sm text-muted-foreground py-8 text-center">
            화면 캡처는 데스크톱 앱(Tauri)에서만 동작합니다.
          </div>
        ) : (
          <div className="space-y-2">
            {/* 1단계: 대상 프로그램 선택 */}
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-muted-foreground font-bold">1) 대상 프로그램</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="px-2 py-1 rounded border bg-background text-xs max-w-[60vw]"
              >
                <option value={PRIMARY}>주 모니터 전체 (폴백)</option>
                {windows.map((w) => (
                  <option key={w.id} value={w.title}>
                    {w.title}{w.app ? ` — ${w.app}` : ""}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => doCapture(target)}>화면 불러오기</Button>
              <Button size="sm" onClick={handleSave} disabled={!cap || !rect || rect.w < 4}>영역 저장</Button>
              <Button size="sm" variant="ghost" onClick={onClose}>취소</Button>
              <span className="text-muted-foreground">2) 아래에서 보스 목록 영역 드래그</span>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">캡처 중…</div>
            ) : cap ? (
              <>
                <div className="max-h-[78vh] overflow-auto rounded border">
                  <div
                    className="relative select-none cursor-crosshair"
                    onMouseDown={onDown}
                    onMouseMove={onMove}
                    onMouseUp={onUp}
                    onMouseLeave={onUp}
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      ref={imgRef}
                      src={`data:image/png;base64,${cap.png_base64}`}
                      alt="capture"
                      className="block w-full h-auto pointer-events-none"
                      draggable={false}
                    />
                    {rect && (
                      <div
                        className="absolute border-2 border-cat-notifier bg-cat-notifier/20 pointer-events-none"
                        style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                      />
                    )}
                  </div>
                </div>
                {rect && rect.w >= 4 && (
                  <div className="text-[11px] text-muted-foreground tabular-nums">
                    선택 영역(물리px): {Math.round(rect.x * scaleNow)},{Math.round(rect.y * scaleNow)}
                    {" "}~ {Math.round(rect.w * scaleNow)}×{Math.round(rect.h * scaleNow)}
                  </div>
                )}
              </>
            ) : (
              <div className="text-sm text-muted-foreground py-8 text-center">
                대상 프로그램을 선택하고 [화면 불러오기]를 누르세요.
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
