"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNotifierStore } from "@/lib/notifier/store";
import { serverNow } from "@/lib/notifier/time-sync";
import { useOcrStore, ocrRegion, ocrRegionWindow, listWindows, extractPrefix, DEFAULT_OCR_REGION } from "@/lib/notifier/ocr-store";
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
  const windowPrefix = useOcrStore((s) => s.windowPrefix);
  const previewBase64 = useOcrStore((s) => s.previewBase64);

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
      // prefix로 현재 창 재탐색 — 캐릭터명 변경 대응
      let resolvedTitle: string | null = null;
      if (windowPrefix) {
        const wins = await listWindows();
        const match = wins?.find((w) => extractPrefix(w.title) === windowPrefix || extractPrefix(w.title).startsWith(windowPrefix));
        resolvedTitle = match?.title ?? windowPrefix; // 못 찾으면 prefix 그대로 Rust에 전달(Rust가 포함 매칭)
      }
      const lines = resolvedTitle
        ? await ocrRegionWindow(resolvedTitle, region)
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
            <DialogTitle>📷 캡처 — 보스 잔여시간 동기화</DialogTitle>
          </DialogHeader>

          <div className="flex items-center gap-2 text-xs flex-wrap">
            <Button size="sm" onClick={() => setRegionOpen(true)}>
              ① 캡처 영역 설정
            </Button>
            <span className="text-muted-foreground">대상:</span>
            <span className="font-bold truncate max-w-[35%]">{windowPrefix ?? "주 모니터(폴백)"}</span>
            <span className="text-muted-foreground">영역:</span>
            {region ? (
              <span className="tabular-nums font-bold">
                {Math.round(region.w)}×{Math.round(region.h)}
                {region.x === DEFAULT_OCR_REGION.x && region.y === DEFAULT_OCR_REGION.y &&
                 region.w === DEFAULT_OCR_REGION.w && region.h === DEFAULT_OCR_REGION.h && (
                  <span className="ml-1 text-[10px] text-muted-foreground font-normal">(기본)</span>
                )}
              </span>
            ) : (
              <span className="text-rose-400 font-bold">미지정</span>
            )}
          </div>

          {/* 썸네일: 설정된 캡처 영역 미리보기 OR 최초 가이드 이미지 */}
          {previewBase64 ? (
            <div className="rounded border overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewBase64} alt="캡처 영역 미리보기" className="block w-full h-auto" />
              <div className="px-2 py-1 text-[10px] text-muted-foreground bg-muted/20">
                ↑ 이전 설정 화면 · 주황 박스 = 캡처 영역 (재설정 필요 시 ① 클릭)
              </div>
            </div>
          ) : (
            <div className="rounded border overflow-hidden">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/images/ocr-guide.jpg"
                alt="캡처 영역 설정 예시"
                className="block w-full h-auto"
                onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
              />
              <div className="px-3 py-2 bg-amber-500/10 border-t border-amber-500/20 flex items-start gap-2">
                <span className="text-amber-400 text-sm mt-0.5 shrink-0">📷</span>
                <div>
                  <div className="text-xs font-bold text-amber-400">캡처 영역 설정 예시</div>
                  <div className="text-[10px] text-muted-foreground leading-relaxed mt-0.5">
                    게임에서 지도를 열면 좌측에 보스 목록이 표시됩니다.<br />
                    ① 버튼 → 대상 프로그램 선택 → 화면 불러오기 → 보스 목록 영역 드래그 → 저장
                  </div>
                </div>
              </div>
            </div>
          )}

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
