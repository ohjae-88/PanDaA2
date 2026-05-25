"use client";

import { useEffect, useState } from "react";
import { RefreshCw, AlertTriangle, ExternalLink, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { fetchArtisanByServerName, type ArtisanResult } from "@/lib/barrack/artisan-fetch";
import { cn } from "@/lib/utils";

/** 아티팩트 명칭 — aion2tool 페이지 상수 동일 (LOWER_ARTIFACTS / UPPER_ARTIFACTS) */
const LOWER_ARTIFACTS = ["에레슈란타의 뿌리", "유황나무섬", "시엘의 날개 군도"];
const UPPER_ARTIFACTS = ["침식된 중앙섬", "오염된 늪지", "뒤틀린 고목나무 숲"];

type Props = {
  open: boolean;
  /** 검색 대상 서버명 (예: "나니아") */
  targetName: string;
  onClose: () => void;
};

/** [아티쟁 결과] — aion2tool.com 서버 비교 API에서 매치 데이터 표시. */
export function ArtisanDialog({ open, targetName, onClose }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ArtisanResult | null>(null);

  async function load() {
    setLoading(true);
    setError(null);
    setData(null);
    try {
      const r = await fetchArtisanByServerName(targetName);
      if (!r) {
        setError(`서버명 "${targetName}"과 일치하는 매치를 찾지 못했습니다.`);
        return;
      }
      setData(r);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open) void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, targetName]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl w-[min(820px,96vw)] max-h-[calc(100vh-32px)] flex flex-col p-4 gap-3" hideCloseButton>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <span>🛠 아티쟁 결과 — {targetName}</span>
            <div className="ml-auto flex items-center gap-1.5">
              <a
                href="https://www.aion2tool.com/server-comparison"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded border bg-cat-arcana/10 border-cat-arcana/40 text-cat-arcana hover:bg-cat-arcana/20"
                title="원본 페이지 열기"
              >
                <ExternalLink className="h-3.5 w-3.5" /> 아툴
              </a>
              <button
                onClick={load}
                disabled={loading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded border hover:bg-accent/10 disabled:opacity-50"
                title="다시 불러오기"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> 새로고침
              </button>
              <button
                onClick={onClose}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded border hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
                title="창 닫기"
              >
                <X className="h-3.5 w-3.5" /> 닫기
              </button>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 min-h-0 overflow-auto">
          {loading && (
            <div className="text-center py-10 text-muted-foreground">
              <RefreshCw className="h-6 w-6 animate-spin inline-block mr-2" />
              aion2tool.com에서 정보를 불러오는 중…
            </div>
          )}

          {error && !loading && (
            <div className="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm">
              <div className="flex items-center gap-2 font-bold mb-2 text-rose-300">
                <AlertTriangle className="h-4 w-4" /> 불러오기 실패
              </div>
              <div className="text-xs text-muted-foreground whitespace-pre-wrap break-all">{error}</div>
            </div>
          )}

          {data && !loading && !error && (
            <div className="space-y-3">
              {/* 매치 헤더 */}
              <div className="rounded border bg-card/40 p-3">
                <div className="text-[11px] text-muted-foreground mb-2">
                  매치 #{data.matchId}
                  {typeof data.battleNumber === "number" && (
                    <span className="ml-2">전투 {data.battleNumber}</span>
                  )}
                  {data.captureDate && (
                    <span className="ml-2">📅 {data.captureDate}</span>
                  )}
                </div>
                {(() => {
                  const all = [...(data.match.lower ?? []), ...(data.match.upper ?? [])];
                  const elyosScore = all.filter((c) => c === "elyos").length;
                  const asmoScore = all.filter((c) => c === "asmodian").length;
                  const total = (data.match.lower?.length ?? 0) + (data.match.upper?.length ?? 0);
                  return (
                    <div className="grid grid-cols-2 gap-2">
                      <SideCard
                        name={data.match.elyos || "-"}
                        side="elyos"
                        cumulative={data.match.cumulative_elyos}
                        captureScore={elyosScore}
                        captureTotal={total}
                        rank={data.rankings.elyos?.rank}
                        isTarget={data.side === "elyos"}
                      />
                      <SideCard
                        name={data.match.asmodian || "-"}
                        side="asmodian"
                        cumulative={data.match.cumulative_asmodian}
                        captureScore={asmoScore}
                        captureTotal={total}
                        rank={data.rankings.asmodian?.rank}
                        isTarget={data.side === "asmodian"}
                      />
                    </div>
                  );
                })()}
              </div>

              {/* 아티팩트 점령 현황 */}
              <div className="rounded border bg-card/40 p-3 space-y-2">
                <div className="text-[11px] font-bold text-muted-foreground">⚔ 아티팩트 점령</div>
                <ArtifactRow label="하층" cells={data.match.lower ?? []} names={LOWER_ARTIFACTS} />
                <ArtifactRow label="중층" cells={data.match.upper ?? []} names={UPPER_ARTIFACTS} />
              </div>

              {/* 제보자 */}
              {data.match.contributors && data.match.contributors.length > 0 && (
                <div className="rounded border bg-card/40 p-3">
                  <div className="text-[11px] font-bold text-muted-foreground mb-1">👤 제보자</div>
                  <div className="flex flex-wrap gap-1">
                    {data.match.contributors.map((c, i) => (
                      <span key={i} className="text-[11px] px-2 py-0.5 rounded border bg-background/40">
                        {c.nickname ?? "?"} <span className="text-muted-foreground">({c.server ?? "?"})</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}

            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function SideCard({ name, side, cumulative, captureScore, rank, isTarget }: {
  name: string;
  side: "elyos" | "asmodian";
  cumulative?: number;
  captureScore?: number;
  captureTotal?: number;
  rank?: number;
  isTarget: boolean;
}) {
  const borderCls = side === "elyos" ? "border-blue-500/40" : "border-rose-500/40";
  const bgCls = side === "elyos" ? "bg-blue-500/10" : "bg-rose-500/10";
  const bgStrongCls = side === "elyos" ? "bg-blue-500/20" : "bg-rose-500/20";
  const textCls = side === "elyos" ? "text-blue-300" : "text-rose-300";

  return (
    <div
      className={cn(
        "rounded border flex items-stretch overflow-hidden",
        borderCls,
        isTarget && "ring-2 ring-amber-400/60"
      )}
    >
      {/* 좌측 셀: 서버명 (진영 아이콘 + 랭킹) + 누적 점수 */}
      <div className={cn("flex-1 min-w-0 p-2", bgCls)}>
        <div className={cn("flex items-center gap-1 font-extrabold text-lg", textCls)}>
          <span className="text-base">{side === "elyos" ? "🕊" : "👹"}</span>
          <span className="truncate">{name}</span>
          {isTarget && <span className="text-amber-400">★</span>}
          {typeof rank === "number" && (
            <span className="ml-auto inline-flex items-center px-1.5 py-0.5 rounded bg-gold/20 border border-gold/40 text-gold-light text-[11px] font-extrabold tabular-nums">
              Rank. {String(rank).padStart(2, "0")}
            </span>
          )}
        </div>
        {typeof cumulative === "number" && (
          <div className="text-[10px] text-muted-foreground mt-1 tabular-nums">
            누적 점수: <b className="text-foreground">{cumulative}</b>
          </div>
        )}
      </div>
      {/* 우측 셀 (분리) — 점령 스코어 */}
      {typeof captureScore === "number" && (
        <div className={cn(
          "flex flex-col items-center justify-center min-w-[64px] px-3 py-1 tabular-nums border-l",
          borderCls,
          bgStrongCls
        )}>
          <span className="text-[10px] font-bold opacity-80">점령</span>
          <span className="text-3xl font-extrabold leading-none">{captureScore}</span>
        </div>
      )}
    </div>
  );
}

function ArtifactRow({ label, cells, names }: {
  label: string;
  cells: ("elyos" | "asmodian")[];
  names: string[];
}) {
  // 진영 카운트 — 카드 강조용
  const elyosCount = cells.filter((c) => c === "elyos").length;
  const asmoCount = cells.filter((c) => c === "asmodian").length;
  const dominant: "elyos" | "asmodian" | null =
    elyosCount > asmoCount ? "elyos" : asmoCount > elyosCount ? "asmodian" : null;

  return (
    <div className="flex items-stretch gap-1">
      {/* 층 라벨 — 카드형, 우세 진영 색상 */}
      <div
        className={cn(
          "min-w-[56px] px-2 py-1 rounded border flex flex-col items-center justify-center",
          dominant === "elyos"
            ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
            : dominant === "asmodian"
            ? "border-rose-500/40 bg-rose-500/10 text-rose-300"
            : "border-border bg-background/40 text-muted-foreground"
        )}
      >
        <span className="text-[12px] font-extrabold leading-tight">{label}</span>
        {dominant && (
          <span className="text-[9px] font-bold tabular-nums">
            {elyosCount}:{asmoCount}
          </span>
        )}
      </div>
      <div className="flex gap-1 flex-1">
        {cells.length === 0 ? (
          <span className="text-[10px] text-muted-foreground italic">데이터 없음</span>
        ) : (
          cells.map((c, i) => (
            <div
              key={i}
              className={cn(
                "flex-1 text-center px-2 py-1 rounded border flex flex-col items-center gap-0.5",
                c === "elyos"
                  ? "border-blue-500/40 bg-blue-500/15 text-blue-300"
                  : "border-rose-500/40 bg-rose-500/15 text-rose-300"
              )}
            >
              <span className="text-[11px] font-extrabold leading-tight">{names[i] ?? `#${i + 1}`}</span>
              <span className="text-[10px] font-bold opacity-90">{c === "elyos" ? "🕊 천족" : "👹 마족"}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
