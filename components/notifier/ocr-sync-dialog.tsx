"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotifierStore } from "@/lib/notifier/store";
import { serverNow } from "@/lib/notifier/time-sync";
import { useOcrStore, ocrRegion, ocrRegionWindow } from "@/lib/notifier/ocr-store";
import { parseOcrLines, matchEntries, type SyncMatch } from "@/lib/notifier/ocr-sync";
import { isTauri } from "@/lib/tauri";
import { toast } from "@/lib/util/toast";
import { cn } from "@/lib/utils";
import { RegionSelectDialog } from "./region-select-dialog";

type Props = { open: boolean; onClose: () => void };

function fmtRemain(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

export function OcrSyncDialog({ open, onClose }: Props) {
  const items = useNotifierStore((s) => s.items);
  const setLastSpawnTs = useNotifierStore((s) => s.setLastSpawnTs);
  const region = useOcrStore((s) => s.region);
  const windowTitle = useOcrStore((s) => s.windowTitle);

  const [running, setRunning] = useState(false);
  const [results, setResults] = useState<SyncMatch[] | null>(null);
  const [capturedAt, setCapturedAt] = useState<number>(0); // 캡처 순간 서버시간
  const [regionOpen, setRegionOpen] = useState(false);

  const matchedCount = results?.filter((r) => r.itemId).length ?? 0;

  async function handleRun() {
    if (!isTauri()) { toast.error("데스크톱 앱(Tauri)에서만 동작합니다."); return; }
    if (!region) { toast.error("먼저 캡처 영역을 지정하세요."); return; }
    setRunning(true);
    setResults(null);
    // 캡처 순간 시간 고정 — 적용까지 사용자 검토 시간만큼 오차 누적 방지
    const ts0 = serverNow();
    setCapturedAt(ts0);
    try {
      const lines = windowTitle
        ? await ocrRegionWindow(windowTitle, region)
        : await ocrRegion(region);
      if (!lines) { toast.error("OCR 호출 실패"); return; }
      const entries = parseOcrLines(lines);
      const matches = matchEntries(entries, items);
      setResults(matches);
      if (matches.length === 0) toast.error("인식된 보스 잔여시간이 없습니다. 영역을 다시 지정해 보세요.");
    } catch (e) {
      toast.error(`인식 실패: ${e}`);
    } finally {
      setRunning(false);
    }
  }

  // 수동 매칭용 — 알리미DB 전체 항목 (이름 가나다순)
  const cdItems = [...items].sort((a, b) => a.name.localeCompare(b.name, "ko"));

  function assignItem(idx: number, itemId: string) {
    setResults((prev) =>
      prev
        ? prev.map((r, i) => {
            if (i !== idx) return r;
            if (!itemId) return { ...r, itemId: null, itemName: null, cycleMinutes: null };
            const it = cdItems.find((x) => x.id === itemId);
            return { ...r, itemId: it?.id ?? null, itemName: it?.name ?? null, cycleMinutes: it?.cycleMinutes ?? null };
          })
        : prev
    );
  }

  function handleApply() {
    if (!results) return;
    // 적용 시점이 아닌 "캡처 순간" 기준 — 화면에 보였던 잔여시간과 정확히 일치
    const base = capturedAt || serverNow();
    let n = 0;
    for (const r of results) {
      if (!r.itemId || r.cycleMinutes == null) continue;
      // 출현 중 → 방금 출현(쿨타임 full): lastSpawnTs = base
      // 남은 시간 → base - 경과시간 (시간입력 다이얼로그와 동일 공식)
      const ts = r.spawned
        ? base
        : base - Math.max(0, r.cycleMinutes * 60 - r.remainSec) * 1000;
      setLastSpawnTs(r.itemId, ts);
      n++;
    }
    toast.success(`${n}개 항목 잔여시간 동기화됨`);
    onClose();
  }

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>🎯 화면에서 잔여시간 동기화</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">대상:</span>
            <span className="font-bold truncate max-w-[40%]">{windowTitle ?? "주 모니터(폴백)"}</span>
            <span className="text-muted-foreground">영역:</span>
            {region ? (
              <span className="tabular-nums font-bold">
                {Math.round(region.x)},{Math.round(region.y)} · {Math.round(region.w)}×{Math.round(region.h)}
              </span>
            ) : (
              <span className="text-rose-400 font-bold">미지정</span>
            )}
            <Button size="sm" variant="ghost" className="ml-auto" onClick={() => setRegionOpen(true)}>
              {region ? "① 대상·영역 재지정" : "① 대상·영역 지정"}
            </Button>
          </div>

          <div className="flex gap-2">
            <Button size="sm" onClick={handleRun} disabled={running || !region}>
              {running ? "인식 중…" : "② 동기화 실행"}
            </Button>
          </div>

          {results && (
            <div className="max-h-72 overflow-y-auto rounded border divide-y text-xs">
              {results.length === 0 ? (
                <div className="px-3 py-4 text-center text-muted-foreground">인식 결과 없음</div>
              ) : (
                results.map((r, i) => (
                  <div key={i} className="px-3 py-1.5 flex items-center gap-2">
                    <span className="truncate max-w-[32%] text-muted-foreground" title={`인식: ${r.ocrName}`}>
                      {r.ocrName}
                    </span>
                    <span className="tabular-nums font-bold text-cat-notifier shrink-0">
                      {r.spawned ? "출현 중" : fmtRemain(r.remainSec)}
                    </span>
                    <select
                      value={r.itemId ?? ""}
                      onChange={(e) => assignItem(i, e.target.value)}
                      className={cn(
                        "ml-auto px-1 py-0.5 rounded border bg-background text-xs max-w-[46%]",
                        !r.itemId && "border-rose-400/60 text-rose-400"
                      )}
                      title="알리미DB 항목 수동 선택"
                    >
                      <option value="">(매칭 없음)</option>
                      {cdItems.map((it) => (
                        <option key={it.id} value={it.id}>
                          {it.ocrName && it.ocrName !== it.name ? `${it.name} (${it.ocrName})` : it.name}
                        </option>
                      ))}
                    </select>
                  </div>
                ))
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={handleApply} disabled={!results || matchedCount === 0}>
              ③ 적용 ({matchedCount})
            </Button>
            <Button variant="ghost" onClick={onClose}>닫기</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <RegionSelectDialog open={regionOpen} onClose={() => setRegionOpen(false)} />
    </>
  );
}
