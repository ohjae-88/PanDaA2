"use client";

import { isTauri } from "@/lib/tauri";

const API_BASE = "https://aion2.plaync.com/api/character/equipment";
const API_ITEM = "https://aion2.plaync.com/api/character/equipment/item";
const API_INFO = "https://aion2.plaync.com/api/character/info";

export type EquipResponse = unknown;

type ProxyResponse = { status: number; body: string };

/** Tauri Rust 백엔드 프록시 호출 (CORS 우회) */
async function fetchViaTauri(url: string): Promise<EquipResponse> {
  const mod = await import("@tauri-apps/api/core");
  const res = await mod.invoke<ProxyResponse>("fetch_aion2_api", { url });
  if (res.status < 200 || res.status >= 300) {
    // 응답 본문에 서버 에러 메시지가 있을 수 있음
    const snippet = (res.body || "").slice(0, 400).replace(/\s+/g, " ").trim();
    throw new Error(`HTTP ${res.status}${snippet ? ` — ${snippet}` : ""}`);
  }
  try {
    return JSON.parse(res.body);
  } catch {
    return res.body;
  }
}

/** 브라우저 fetch 폴백 (CORS 제약 받을 수 있음) */
async function fetchViaBrowser(url: string): Promise<EquipResponse> {
  const res = await fetch(url, { method: "GET", headers: { Accept: "application/json" } });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const snippet = text.slice(0, 400).replace(/\s+/g, " ").trim();
    throw new Error(`HTTP ${res.status}${snippet ? ` — ${snippet}` : ""}`);
  }
  return await res.json();
}

/** 외부 CORS 프록시 폴백 — V4.0.9와 동일한 3종 프록시 순차 시도 */
async function fetchViaCorsProxy(url: string): Promise<EquipResponse> {
  const proxies: Array<{ name: string; make: (u: string) => string; extract?: (raw: any) => any }> = [
    { name: "corsproxy.io", make: (u) => "https://corsproxy.io/?" + encodeURIComponent(u) },
    {
      name: "allorigins",
      make: (u) => "https://api.allorigins.win/get?url=" + encodeURIComponent(u),
      extract: (raw) => (raw && raw.contents ? safeParseJson(raw.contents) : raw),
    },
    { name: "codetabs",   make: (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u) },
  ];
  let lastErr = "";
  for (const p of proxies) {
    try {
      const res = await fetch(p.make(url), { signal: AbortSignal.timeout(8000) });
      if (!res.ok) { lastErr = `${p.name} HTTP ${res.status}`; continue; }
      const text = await res.text();
      const raw = safeParseJson(text);
      const data = p.extract ? p.extract(raw) : raw;
      if (data) return data;
    } catch (err) {
      lastErr = `${p.name}: ${(err as Error).message}`;
    }
  }
  throw new Error(lastErr || "all CORS proxies failed");
}

function safeParseJson(text: string): any {
  try { return JSON.parse(text); } catch { return text; }
}

/** 캐릭터 장비/스킬 조회 — Tauri 프록시 → 브라우저 fetch → 외부 CORS 프록시 순차 시도 */
export async function fetchEquipment(
  characterId: string,
  serverId: string | number
): Promise<EquipResponse> {
  // V4.0.9 동등: characterId가 이미 URL-encoded일 가능성에 대비해 한 번 디코드 후 재인코드
  let cid = characterId;
  try { cid = encodeURIComponent(decodeURIComponent(characterId)); }
  catch { cid = encodeURIComponent(characterId); }
  const url = `${API_BASE}?lang=ko&characterId=${cid}&serverId=${serverId}`;

  const errors: string[] = [];

  // 1차: Tauri Rust 프록시 (CORS 우회 + 적절한 Referer/UA)
  if (isTauri()) {
    try { return await fetchViaTauri(url); }
    catch (err) { errors.push(`Tauri: ${(err as Error).message}`); }
  }

  // 2차: 브라우저 직접 fetch
  try { return await fetchViaBrowser(url); }
  catch (err) { errors.push(`Direct: ${(err as Error).message}`); }

  // 3차: 외부 CORS 프록시 (V4.0.9 동일)
  try { return await fetchViaCorsProxy(url); }
  catch (err) { errors.push(`CorsProxy: ${(err as Error).message}`); }

  throw new Error(errors.join(" / "));
}

/** 캐릭터 기본 정보 (전투력·아이템레벨 갱신용) */
export async function fetchCharacterBasic(
  characterId: string,
  serverId: string | number
): Promise<{ name?: string; level?: number; cp?: number; itemLevel?: number }> {
  const data: any = await fetchEquipment(characterId, serverId);
  const root = data?.item ?? data?.data ?? data;
  const basic = root?.basic ?? root?.character ?? {};
  const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    name: basic?.name ?? basic?.characterName,
    level: num(basic?.level),
    cp: num(basic?.combatPower ?? basic?.cp),
    itemLevel: num(basic?.itemLevel),
  };
}

/** 캐릭터 전체 정보 (V4.0.9 fetchAndApplyCharInfo 동등) — /api/character/info 엔드포인트
 *  반환: 이름·레벨·전투력·아이템레벨 + 종족명·직업명·서버명 (캐릭터 추가/수정 폼 자동 채움용) */
export async function fetchCharacterFullInfo(
  characterId: string,
  serverId: string | number
): Promise<{
  name?: string;
  level?: number;
  cp?: number;
  itemLevel?: number;
  raceName?: string;
  className?: string;
  serverName?: string;
}> {
  let cid = characterId;
  try { cid = encodeURIComponent(decodeURIComponent(characterId)); }
  catch { cid = encodeURIComponent(characterId); }
  const url = `${API_INFO}?lang=ko&characterId=${cid}&serverId=${serverId}`;

  const errors: string[] = [];
  let data: unknown = null;
  if (isTauri()) {
    try { data = await fetchViaTauri(url); }
    catch (err) { errors.push(`Tauri: ${(err as Error).message}`); }
  }
  if (data === null) {
    try { data = await fetchViaBrowser(url); }
    catch (err) { errors.push(`Direct: ${(err as Error).message}`); }
  }
  if (data === null) {
    try { data = await fetchViaCorsProxy(url); }
    catch (err) { errors.push(`CorsProxy: ${(err as Error).message}`); }
  }
  if (data === null) throw new Error(errors.join(" / "));

  const root = (data as any)?.item ?? (data as any)?.data ?? data;
  const profile = (root as any)?.profile ?? {};
  const stat = (root as any)?.stat ?? {};
  const num = (v: unknown): number | undefined => {
    if (v === undefined || v === null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  // V4.0.9 동등: combatPower를 ÷1000 후 반올림. 예: 577660 → 578 (천 단위 표기)
  const cpRaw = num(profile?.combatPower ?? profile?.cp);
  const cp = cpRaw !== undefined ? Math.round(cpRaw / 1000) : undefined;
  // 아이템레벨: V4.0.9는 stat.statList[16].value 사용
  let itemLevel: number | undefined = num(profile?.itemLevel);
  if (itemLevel === undefined) {
    const list = stat?.statList;
    if (Array.isArray(list)) {
      const idx16 = list[16];
      if (idx16 && typeof idx16 === "object") itemLevel = num((idx16 as any).value);
      // 일부 응답에서 statName 기반 매핑
      if (itemLevel === undefined) {
        const m = list.find((x: any) => x?.statName?.includes?.("아이템") || x?.statName === "itemLevel");
        if (m) itemLevel = num(m.value);
      }
    }
  }
  return {
    name: profile?.characterName ?? profile?.name,
    level: num(profile?.level ?? profile?.characterLevel),
    cp,
    itemLevel,
    raceName: profile?.raceName,
    className: profile?.className,
    serverName: profile?.serverName,
  };
}

/** 아이템 상세 옵션 (메인스텟/서브스텟/서브스킬/마석/신석) 조회 */
export async function fetchEquipmentItem(
  itemId: string | number,
  enchantLevel: number,
  characterId: string,
  serverId: string | number,
  slotPos: number | string
): Promise<EquipResponse> {
  let cid = characterId;
  try { cid = encodeURIComponent(decodeURIComponent(characterId)); }
  catch { cid = encodeURIComponent(characterId); }
  const url = `${API_ITEM}?id=${encodeURIComponent(String(itemId))}&enchantLevel=${enchantLevel || 0}&characterId=${cid}&serverId=${serverId}&slotPos=${slotPos}&lang=ko`;

  const errors: string[] = [];
  if (isTauri()) {
    try { return await fetchViaTauri(url); }
    catch (err) { errors.push(`Tauri: ${(err as Error).message}`); }
  }
  try { return await fetchViaBrowser(url); }
  catch (err) { errors.push(`Direct: ${(err as Error).message}`); }
  try { return await fetchViaCorsProxy(url); }
  catch (err) { errors.push(`CorsProxy: ${(err as Error).message}`); }
  throw new Error(errors.join(" / "));
}

export type EquipItemSummary = {
  slotPos: number | string;
  name?: string;
  grade?: string;
  enchantLevel?: number;
  icon?: string;
};
export type SkillSummary = {
  id?: number | string;
  name?: string;
  category?: "Active" | "Passive" | "Dp" | string;
  icon?: string;
  skillLevel?: number;
  equip?: boolean;
};
