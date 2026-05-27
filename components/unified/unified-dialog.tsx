"use client";

import { useEffect, useRef, useState } from "react";
import { Upload, Download, FileText, Settings } from "lucide-react";
import { useBarrackStore } from "@/lib/barrack/store";
import { useNotifierStore } from "@/lib/notifier/store";
import { useOverlayStore } from "@/lib/overlay/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/util/toast";
import { log } from "@/lib/util/logger";
import { confirmDialog } from "@/lib/util/confirm";
import { UNIFIED_AREAS } from "@/lib/unified/areas";
import { normalizeUnified } from "@/lib/unified/normalize";
import { UNIFIED_CATEGORY_LABELS, type UnifiedArea, type UnifiedCategory, type UnifiedPayload } from "@/lib/unified/types";
import { cn } from "@/lib/utils";

const CATEGORY_ORDER: UnifiedCategory[] = ["user", "db", "overlay"];

function groupByCategory(areas: UnifiedArea[]): { cat: UnifiedCategory; items: UnifiedArea[] }[] {
  return CATEGORY_ORDER
    .map((cat) => ({ cat, items: areas.filter((a) => a.category === cat) }))
    .filter((g) => g.items.length > 0);
}

type Props = { open: boolean; onClose: () => void };

type Pending = { data: UnifiedPayload; fileName: string };

export function UnifiedDialog({ open, onClose }: Props) {
  // 내보내기 — 사용 가능한 영역만 기본 체크
  const [exp, setExp] = useState<Record<string, boolean>>({});
  // 불러오기 — 파일 분석 결과
  const [pending, setPending] = useState<Pending | null>(null);
  const [imp, setImp] = useState<Record<string, boolean>>({});
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPending(null);
    const initExp: Record<string, boolean> = {};
    UNIFIED_AREAS.forEach((a) => (initExp[a.key] = a.available()));
    setExp(initExp);
  }, [open]);

  async function handleExport() {
    const payload: UnifiedPayload = {
      _kind: "a2-unified",
      _version: 4,
      exportedAt: new Date().toISOString(),
    };
    let count = 0;
    for (const a of UNIFIED_AREAS) {
      if (!exp[a.key] || !a.available()) continue;
      const sec = a.getSection();
      if (sec) {
        (payload as any)[a.key] = sec;
        count++;
      }
    }
    if (count === 0) {
      toast.warning("내보낼 항목을 1개 이상 선택하세요.");
      return;
    }
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const filename = `a2-unified-${new Date().toISOString().slice(0, 10)}.json`;
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    const selectedLabels = UNIFIED_AREAS
      .filter((ar) => exp[ar.key] && ar.available())
      .map((ar) => `• ${ar.label}`)
      .join("\n");
    const openFolder = await confirmDialog({
      title: "내보내기 완료",
      description:
        `파일: ${filename}\n` +
        `항목 (${count}개):\n${selectedLabels}\n\n` +
        `다운로드 폴더를 열까요?`,
      confirmText: "폴더 열기",
      cancelText: "닫기",
    });
    if (openFolder) void openDownloadFolder();
  }

  /** Tauri 환경 — 시스템 다운로드 폴더 탐색기로 열기. 비-Tauri는 무시. */
  async function openDownloadFolder() {
    try {
      const { openDownloadFolder: openFolder } = await import("@/lib/tauri");
      await openFolder();
    } catch (e) {
      log.error("폴더 열기 실패", e);
      toast.error("다운로드 폴더를 열 수 없습니다.");
    }
  }

  /** 빌드 기본값 스냅샷 — 배럭DB + 알리미DB·설정·그룹 + 오버레이 통합 설정만 추출 */
  async function handleExportBuildDefaults() {
    const proceed = await confirmDialog({
      title: "빌드 기본값 스냅샷",
      description:
        "현재 설정을 빌드 기본값으로 저장하시겠습니까?\n\n" +
        "다음 항목이 [build-snapshot.json] 파일로 다운로드됩니다:\n" +
        "  • 배럭 DB 설정\n" +
        "  • 알리미 DB · 설정 · 그룹\n" +
        "  • 오버레이 통합 설정 (단축키·배율·비주얼·카테고리)\n\n" +
        "캐릭터 / 계정 / 파티 데이터는 제외됩니다.\n\n" +
        "이후 lib/defaults/build-snapshot.json 에 덮어쓰고 빌드.bat 실행 시\n신규 설치자에게 현재 설정이 기본값으로 적용됩니다.",
      confirmText: "다운로드",
    });
    if (!proceed) return;
    const b = useBarrackStore.getState();
    const n = useNotifierStore.getState();
    const o = useOverlayStore.getState();
    const payload = {
      // 메타 — 디버깅용
      _kind: "a2-build-snapshot",
      _exportedAt: new Date().toISOString(),
      barrackDb: JSON.parse(JSON.stringify(b.dbSettings)),
      notifierItems: JSON.parse(JSON.stringify(n.items)),
      notifierSettings: JSON.parse(JSON.stringify(n.settings)),
      notifierGroups: JSON.parse(JSON.stringify(n.groupDefs ?? [])),
      overlay: {
        passthroughHotkey: o.passthroughHotkey,
        headerHiddenHotkey: o.headerHiddenHotkey,
        overallOpacity: o.overallOpacity,
        scale: o.scale,
        textScale: o.textScale,
        expandedSize: o.expandedSize,
        collapsedSize: o.collapsedSize,
        iframeUrls: o.iframeUrls,
        visual: JSON.parse(JSON.stringify(o.visual)),
        notifier: JSON.parse(JSON.stringify(o.notifier)),
        barrack: JSON.parse(JSON.stringify(o.barrack)),
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "build-snapshot.json";
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    toast.success("빌드 기본값 스냅샷 저장됨", {
      description: "lib/defaults/build-snapshot.json 에 덮어쓰기 → 빌드. 배럭 DB · 알리미 DB·설정·그룹 · 오버레이 통합 설정 포함. 캐릭터/계정/파티 제외.",
      duration: 8000,
    });
  }

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = (ev) => {
      try {
        const raw = JSON.parse(String(ev.target?.result));
        const data = normalizeUnified(raw);
        setPending({ data, fileName: f.name });
        // 기본: 파일에 있고 + 가능한 영역만 체크
        const initImp: Record<string, boolean> = {};
        UNIFIED_AREAS.forEach((a) => {
          initImp[a.key] = a.available() && data[a.key] !== undefined;
        });
        setImp(initImp);
      } catch {
        toast.error("파일 형식 오류");
      }
      e.target.value = "";
    };
    rd.readAsText(f);
  }

  function handleImport() {
    if (!pending) return;
    let count = 0;
    for (const a of UNIFIED_AREAS) {
      if (!imp[a.key] || !a.available()) continue;
      const sec = pending.data[a.key];
      if (sec && typeof sec === "object") {
        a.applySection(sec as Record<string, unknown>);
        count++;
      }
    }
    setPending(null);
    onClose();
    if (count > 0) toast.success(`${count}개 영역을 불러왔습니다.`);
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>💾 통합 저장 / 불러오기</DialogTitle>
        </DialogHeader>

        {/* 내보내기 */}
        <section>
          <div className="text-xs font-bold text-muted-foreground mb-2">📤 내보내기</div>
          <div className="space-y-3">
            {groupByCategory(UNIFIED_AREAS).map(({ cat, items }) => {
              const availItems = items.filter((a) => a.available());
              const allChecked = availItems.length > 0 && availItems.every((a) => exp[a.key]);
              const noneChecked = availItems.every((a) => !exp[a.key]);
              return (
                <div key={cat} className="rounded border border-border/40 bg-background/30 p-2 space-y-1">
                  <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                    <span className="font-extrabold text-sm flex-1">{UNIFIED_CATEGORY_LABELS[cat]}</span>
                    <button
                      onClick={() => {
                        const next = { ...exp };
                        availItems.forEach((a) => (next[a.key] = !allChecked));
                        setExp(next);
                      }}
                      className="text-[10px] font-bold px-2 py-0.5 rounded border hover:bg-accent/15"
                      title={allChecked ? "이 카테고리 전체 해제" : "이 카테고리 전체 선택"}
                    >
                      {allChecked ? "전체 해제" : noneChecked ? "전체 선택" : "전체 선택"}
                    </button>
                  </div>
                  {items.map((a) => {
                    const avail = a.available();
                    return (
                      <label
                        key={a.key}
                        className={cn(
                          "flex items-center gap-2 p-1.5 rounded cursor-pointer hover:bg-accent/10",
                          !avail && "opacity-40 cursor-not-allowed"
                        )}
                      >
                        <Checkbox
                          checked={!!exp[a.key]}
                          onCheckedChange={(v) => setExp((s) => ({ ...s, [a.key]: !!v }))}
                          disabled={!avail}
                        />
                        <span className="font-semibold text-sm">{a.label}</span>
                        <span className="text-xs text-muted-foreground">{a.desc}</span>
                        {!avail && (
                          <span className="ml-auto text-[10px] text-muted-foreground italic">준비 중</span>
                        )}
                      </label>
                    );
                  })}
                </div>
              );
            })}
          </div>
          <Button onClick={handleExport} className="w-full mt-2">
            <Download className="h-4 w-4" /> 선택 항목 내보내기 (.json)
          </Button>
          <Button
            variant="ghost"
            onClick={handleExportBuildDefaults}
            className="w-full mt-1.5 border border-amber-400/40 bg-amber-400/10 text-amber-300 hover:bg-amber-400/20"
            title="배럭 DB · 알리미 DB · 알리미 설정 · 오버레이 설정만 추출 — lib/defaults/build-snapshot.json 으로 저장 후 빌드"
          >
            <Settings className="h-4 w-4" /> 🛠 현재 설정을 빌드 기본값으로
          </Button>
        </section>

        <div className="border-t" />

        {/* 불러오기 */}
        <section>
          <div className="text-xs font-bold text-muted-foreground mb-2">📥 불러오기</div>
          {!pending ? (
            <>
              <p className="text-xs text-muted-foreground mb-2">
                파일을 선택하면 포함된 항목이 표시됩니다
              </p>
              <Button variant="ghost" className="w-full" onClick={() => fileRef.current?.click()}>
                <Upload className="h-4 w-4" /> 파일 선택...
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept=".json,.txt"
                className="hidden"
                onChange={handleFile}
              />
            </>
          ) : (
            <>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <FileText className="h-3 w-3" /> {pending.fileName}
              </div>
              <div className="space-y-3">
                {groupByCategory(UNIFIED_AREAS).map(({ cat, items }) => {
                  const eligible = items.filter((a) => a.available() && pending.data[a.key] !== undefined);
                  const allChecked = eligible.length > 0 && eligible.every((a) => imp[a.key]);
                  return (
                    <div key={cat} className="rounded border border-border/40 bg-background/30 p-2 space-y-1">
                      <div className="flex items-center gap-2 pb-1 border-b border-border/40">
                        <span className="font-extrabold text-sm flex-1">{UNIFIED_CATEGORY_LABELS[cat]}</span>
                        <button
                          onClick={() => {
                            const next = { ...imp };
                            eligible.forEach((a) => (next[a.key] = !allChecked));
                            setImp(next);
                          }}
                          disabled={eligible.length === 0}
                          className="text-[10px] font-bold px-2 py-0.5 rounded border hover:bg-accent/15 disabled:opacity-40"
                          title={allChecked ? "이 카테고리 전체 해제" : "이 카테고리 전체 선택"}
                        >
                          {allChecked ? "전체 해제" : "전체 선택"}
                        </button>
                      </div>
                      {items.map((a) => {
                        const inFile = pending.data[a.key] !== undefined;
                        const avail = a.available();
                        const disabled = !inFile || !avail;
                        return (
                          <label
                            key={a.key}
                            className={cn(
                              "flex items-center gap-2 p-1.5 rounded",
                              disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-accent/10"
                            )}
                          >
                            <Checkbox
                              checked={!!imp[a.key] && !disabled}
                              onCheckedChange={(v) => setImp((s) => ({ ...s, [a.key]: !!v }))}
                              disabled={disabled}
                            />
                            <span className="font-semibold text-sm">{a.label}</span>
                            <span className="text-xs text-muted-foreground">{a.desc}</span>
                            {!inFile && (
                              <span className="ml-auto text-[10px] text-muted-foreground italic">파일에 없음</span>
                            )}
                            {inFile && !avail && (
                              <span className="ml-auto text-[10px] text-muted-foreground italic">준비 중</span>
                            )}
                          </label>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-2 mt-2">
                <Button variant="ghost" className="flex-1" onClick={() => setPending(null)}>
                  취소
                </Button>
                <Button className="flex-1" onClick={handleImport}>
                  ✓ 선택 항목 불러오기
                </Button>
              </div>
            </>
          )}
        </section>
      </DialogContent>
    </Dialog>
  );
}
