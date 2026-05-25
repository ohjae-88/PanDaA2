"use client";

import { isTauri } from "@/lib/tauri";

const URL_API_SEASONS = "https://www.aion2tool.com/api/artifact/seasons";
const URL_API_STATUS = "https://www.aion2tool.com/api/artifact/status";
const URL_API_RANKING = "https://www.aion2tool.com/api/artifact/ranking";

type ProxyResponse = { status: number; body: string };

async function fetchJson<T>(url: string): Promise<T> {
  if (!isTauri()) {
    const res = await fetch(url, {
      headers: { Accept: "application/json" },
      mode: "cors",
    });
    return (await res.json()) as T;
  }
  const mod = await import("@tauri-apps/api/core");
  const res = await mod.invoke<ProxyResponse>("fetch_aion2_api", { url });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }
  return JSON.parse(res.body) as T;
}

/** /api/artifact/status 응답 — matches 1~21 매핑.
 *  각 매치: { elyos, asmodian, lower[3], upper[3], cumulative_elyos, cumulative_asmodian, capture_date, contributors[] } */
type StatusResp = {
  data?: {
    battle_number?: number;
    capture_date?: string;
    is_current_season?: boolean;
    matches?: Record<string, MatchInfo>;
    confirmed_matches?: number[];
  };
};

type MatchInfo = {
  elyos?: string;
  asmodian?: string;
  capture_date?: string;
  confirmed?: boolean;
  contributors?: { nickname?: string; server?: string }[];
  cumulative_elyos?: number;
  cumulative_asmodian?: number;
  lower?: ("elyos" | "asmodian")[];
  upper?: ("elyos" | "asmodian")[];
};

export type RankingRow = {
  rank?: number;
  server?: string;
  race?: string;
  captures?: number;
  score?: number;
  [k: string]: unknown;
};
type RankingResp = {
  data?: RankingRow[];
  contributors?: Array<{ nickname?: string; server?: string; score?: number; [k: string]: unknown }>;
};

export type ArtisanResult = {
  /** 매치 ID (1~21) */
  matchId: string;
  /** 매칭 진영 — targetName이 어느 쪽에 있는지 */
  side: "elyos" | "asmodian";
  /** 입력 서버명 */
  name: string;
  /** 상대 서버명 */
  opponent: string;
  /** 매치 데이터 원본 */
  match: MatchInfo;
  /** battle number */
  battleNumber?: number;
  /** capture_date (서버 또는 매치 단위) */
  captureDate?: string;
  /** 양 진영 서버의 순위 정보 — ranking API의 자기/상대 행 */
  rankings: { elyos?: RankingRow | null; asmodian?: RankingRow | null };
  /** 전체 status JSON (디버깅/추가 표시용) */
  raw: StatusResp;
};

type SeasonsResp = {
  current_season_id?: string;
  data?: Array<{ id?: string; label?: string; is_current?: boolean; start_date?: string; end_date?: string | null }>;
};

/** aion2tool.com 서버 비교 API에서 targetName 매칭 데이터 가져오기. */
export async function fetchArtisanByServerName(targetName: string): Promise<ArtisanResult | null> {
  // 1) 현재 시즌 ID — seasons API에서 자동 감지 (실패 시 season 미지정 = 서버 기본)
  let seasonQs = "";
  try {
    const seasons = await fetchJson<SeasonsResp>(URL_API_SEASONS);
    if (seasons.current_season_id) {
      seasonQs = `?season=${encodeURIComponent(seasons.current_season_id)}`;
    }
  } catch {
    // seasons 실패 시 상태 API의 기본 시즌 사용
  }

  const [status, ranking] = await Promise.allSettled([
    fetchJson<StatusResp>(URL_API_STATUS + seasonQs),
    fetchJson<RankingResp>(URL_API_RANKING + seasonQs),
  ]);

  if (status.status !== "fulfilled") {
    throw new Error(`status API 실패: ${(status.reason as Error).message}`);
  }
  const statusBody = status.value;
  const matches = statusBody.data?.matches || {};
  let foundId: string | null = null;
  let foundSide: "elyos" | "asmodian" | null = null;
  for (const [id, m] of Object.entries(matches)) {
    if (m.elyos === targetName) { foundId = id; foundSide = "elyos"; break; }
    if (m.asmodian === targetName) { foundId = id; foundSide = "asmodian"; break; }
  }
  if (!foundId || !foundSide) return null;
  const match = matches[foundId];

  // ranking — 매치 양 서버 모두 추출
  const rankings: { elyos?: RankingRow | null; asmodian?: RankingRow | null } = { elyos: null, asmodian: null };
  if (ranking.status === "fulfilled") {
    const arr = ranking.value.data || [];
    if (match.elyos) rankings.elyos = arr.find((r) => r.server === match.elyos) ?? null;
    if (match.asmodian) rankings.asmodian = arr.find((r) => r.server === match.asmodian) ?? null;
  }

  return {
    matchId: foundId,
    side: foundSide,
    name: targetName,
    opponent: foundSide === "elyos" ? (match.asmodian ?? "") : (match.elyos ?? ""),
    match,
    battleNumber: statusBody.data?.battle_number,
    captureDate: match.capture_date ?? statusBody.data?.capture_date,
    rankings,
    raw: statusBody,
  };
}
