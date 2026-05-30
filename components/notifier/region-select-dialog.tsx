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
type Dir = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w";

const PRIMARY = "__primary__";
const HANDLES: Dir[] = ["nw", "n", "ne", "e", "se", "s", "sw", "w"];
const CURSOR: Record<Dir, string> = {
  nw: "nwse-resize", se: "nwse-resize", ne: "nesw-resize", sw: "nesw-resize",
  n: "ns-resize", s: "ns-resize", e: "ew-resize", w: "ew-resize",
};

export function RegionSelectDialog({ open, onClose }: Props) {
  const setRegion = useOcrStore((s) => s.setRegion);
  const setWindowTitle = useOcrStore((s) => s.setWindowTitle);
  const savedTitle = useOcrStore((s) => s.windowTitle);

  const [windows, setWindows] = useState<WinInfo[]>([]);
  const [target, setTarget] = useState<string>(PRIMARY);
  const [cap, setCap] = useState<CaptureResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);
  const drag = useRef<{ mode: "new" | "move" | "resize"; dir?: Dir; sm: { x: number; y: number }; sr: Rect } | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

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
        if (!savedTitle) {
          const aion = list.find((w) => w.title.startsWith("AION") || w.title.includes("AION"));
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

  function bounds() {
    const img = imgRef.current;
    return { w: img?.clientWidth ?? 0, h: img?.clientHeight ?? 0 };
  }
  function relPos(e: React.MouseEvent) {
    const img = imgRef.current;
    if (!img) return { x: 0, y: 0 };
    const r = img.getBoundingClientRect();
    return {
      x: Math.max(0, Math.min(r.width, e.clientX - r.left)),
      y: Math.max(0, Math.min(r.height, e.clientY - r.top)),
    };
  }
  function clampRect(r: Rect): Rect {
    const b = bounds();
    let { x, y, w, h } = r;
    if (w < 0) { x += w; w = -w; }
    if (h < 0) { y += h; h = -h; }
    x = Math.max(0, Math.min(x, b.w));
    y = Math.max(0, Math.min(y, b.h));
    w = Math.max(0, Math.min(w, b.w - x));
    h = Math.max(0, Math.min(h, b.h - y));
    return { x, y, w, h };
  }
  function inside(p: { x: number; y: number }, r: Rect) {
    return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
  }

  function onDown(e: React.MouseEvent) {
    e.preventDefault();
    const p = relPos(e);
    const dir = (e.target as HTMLElement).dataset.h as Dir | undefined;
    if (rect && dir) {
      drag.current = { mode: "resize", dir, sm: p, sr: rect };
    } else if (rect && inside(p, rect)) {
      drag.current = { mode: "move", sm: p, sr: rect };
    } else {
      drag.current = { mode: "new", sm: p, sr: { x: p.x, y: p.y, w: 0, h: 0 } };
      setRect({ x: p.x, y: p.y, w: 0, h: 0 });
    }
  }
  function onMove(e: React.MouseEvent) {
    const d = drag.current;
    if (!d) return;
    const p = relPos(e);
    const dx = p.x - d.sm.x;
    const dy = p.y - d.sm.y;
    if (d.mode === "new") {
      setRect(clampRect({ x: d.sm.x, y: d.sm.y, w: p.x - d.sm.x, h: p.y - d.sm.y }));
    } else if (d.mode === "move") {
      setRect(clampRect({ ...d.sr, x: d.sr.x + dx, y: d.sr.y + dy }));
    } else if (d.mode === "resize" && d.dir) {
      let { x, y, w, h } = d.sr;
      if (d.dir.includes("w")) { x += dx; w -= dx; }
      if (d.dir.includes("e")) { w += dx; }
      if (d.dir.includes("n")) { y += dy; h -= dy; }
      if (d.dir.includes("s")) { h += dy; }
      setRect(clampRect({ x, y, w, h }));
    }
  }
  function onUp() {
    drag.current = null;
  }

  function handleSave() {
    if (!cap || !rect || rect.w < 4 || rect.h < 4) { toast.error("영역을 드래그하여 지정하세요."); return; }
    const img = imgRef.current;
    if (!img) return;
    const scale = cap.width / img.clientWidth;
    const region: OcrRegion = { x: rect.x * scale, y: rect.y * scale, w: rect.w * scale, h: rect.h * scale };
    setRegion(region);
    setWindowTitle(target === PRIMARY ? null : target);
    toast.success("캡처 대상·영역 저장됨");
    onClose();
  }

  const scaleNow = cap && imgRef.current ? cap.width / (imgRef.current.clientWidth || cap.width) : 1;

  function handleStyle(dir: Dir, r: Rect): React.CSSProperties {
    const cx = dir.includes("w") ? r.x : dir.includes("e") ? r.x + r.w : r.x + r.w / 2;
    const cy = dir.includes("n") ? r.y : dir.includes("s") ? r.y + r.h : r.y + r.h / 2;
    return { left: cx - 5, top: cy - 5, cursor: CURSOR[dir] };
  }

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
            <div className="flex items-center gap-2 text-xs flex-wrap">
              <span className="text-muted-foreground font-bold">① 대상 프로그램</span>
              <select
                value={target}
                onChange={(e) => setTarget(e.target.value)}
                className="px-2 py-1 rounded border bg-background text-xs max-w-[50vw]"
              >
                <option value={PRIMARY}>주 모니터 전체 (폴백)</option>
                {windows.map((w) => (
                  <option key={w.id} value={w.title}>
                    {w.title}{w.app ? ` — ${w.app}` : ""}
                  </option>
                ))}
              </select>
              <Button size="sm" onClick={() => doCapture(target)}>② 화면 불러오기</Button>
              <Button size="sm" onClick={handleSave} disabled={!cap || !rect || rect.w < 4}>④ 영역 저장</Button>
              <Button size="sm" variant="ghost" onClick={onClose}>취소</Button>
              <span className="text-muted-foreground">③ 드래그로 영역 지정 · 모서리/변으로 크기 조절 · 안쪽 드래그로 이동</span>
            </div>

            {loading ? (
              <div className="text-sm text-muted-foreground py-8 text-center">캡처 중…</div>
            ) : cap ? (
              <>
                <div className="flex justify-center">
                  <div
                    className="relative inline-block select-none cursor-crosshair leading-[0]"
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
                      className="block pointer-events-none"
                      style={{ maxHeight: "72vh", maxWidth: "100%", width: "auto", height: "auto" }}
                      draggable={false}
                    />
                    {rect && rect.w > 0 && (
                      <>
                        <div
                          className="absolute border-2 border-cat-notifier bg-cat-notifier/20 pointer-events-none"
                          style={{ left: rect.x, top: rect.y, width: rect.w, height: rect.h }}
                        />
                        {HANDLES.map((dir) => (
                          <div
                            key={dir}
                            data-h={dir}
                            className="absolute w-2.5 h-2.5 bg-cat-notifier border border-white rounded-sm shadow"
                            style={handleStyle(dir, rect)}
                          />
                        ))}
                      </>
                    )}
                  </div>
                </div>
                {rect && rect.w >= 4 && (
                  <div className="text-[11px] text-muted-foreground tabular-nums text-center">
                    영역(물리px): {Math.round(rect.x * scaleNow)},{Math.round(rect.y * scaleNow)}
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
