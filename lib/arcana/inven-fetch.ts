"use client";

/** Inven 아이온2 스킬 시뮬레이터에서 직업별 스킬 마스터 가져오기.
 *  V4.0.9 fetchInvenSkillPage + importInvenSkillsForJobs 포팅.
 *
 *  Tauri: Rust 프록시(fetch_aion2_api)로 CORS 우회.
 *  브라우저: 직접 fetch → CORS 프록시 fallback.
 */

import { isTauri } from "@/lib/tauri";
import { ICON_BASE, INVEN_CAT_MAP, JOB_NUM_TO_ID, SKILL_BASELV_SEED } from "./constants";
import type { Skill, SkillCategory, SpecialEffect } from "./types";

const JOB_KO: Record<string, string> = {
  guardian: "수호성",
  sword: "검성",
  healer: "치유성",
  protector: "호법성",
  archer: "궁성",
  mage: "마도성",
  assassin: "살성",
  spirit: "정령성",
};

type ProxyResponse = { status: number; body: string };

/** Tauri Rust 프록시 호출 */
async function fetchViaTauri(url: string): Promise<string> {
  const mod = await import("@tauri-apps/api/core");
  const res = await mod.invoke<ProxyResponse>("fetch_aion2_api", { url });
  if (res.status < 200 || res.status >= 300) {
    throw new Error(`HTTP ${res.status}`);
  }
  return res.body;
}

/** 외부 CORS 프록시 fallback */
async function fetchViaCorsProxy(url: string): Promise<string> {
  const proxies: Array<{ name: string; make: (u: string) => string; extract?: (raw: string) => string }> = [
    { name: "corsproxy.io", make: (u) => "https://corsproxy.io/?" + encodeURIComponent(u) },
    {
      name: "allorigins",
      make: (u) => "https://api.allorigins.win/get?url=" + encodeURIComponent(u),
      extract: (raw) => {
        try {
          const obj = JSON.parse(raw);
          if (obj && typeof obj.contents === "string") return obj.contents;
        } catch { /* ignore */ }
        return raw;
      },
    },
    { name: "codetabs", make: (u) => "https://api.codetabs.com/v1/proxy?quest=" + encodeURIComponent(u) },
  ];
  let lastErr = "";
  for (const p of proxies) {
    try {
      const res = await fetch(p.make(url), { signal: AbortSignal.timeout(12000) });
      if (!res.ok) { lastErr = `${p.name} HTTP ${res.status}`; continue; }
      const text = await res.text();
      return p.extract ? p.extract(text) : text;
    } catch (err) {
      lastErr = `${p.name}: ${(err as Error).message}`;
    }
  }
  throw new Error(lastErr || "all CORS proxies failed");
}

/** 단일 직업번호 → Inven HTML 페이지의 `data-props` JSON 추출 (V4.0.9 동등) */
async function fetchInvenSkillPage(jobNum: number): Promise<Record<string, InvenSkillRaw>> {
  const url = `https://aion2.inven.co.kr/db/skillsimulator/write/${jobNum}`;

  let html: string | null = null;

  // 1) Tauri Rust 프록시 우선
  if (isTauri()) {
    try { html = await fetchViaTauri(url); } catch { /* fall through */ }
  }

  // 2) 직접 fetch
  if (!html) {
    try {
      const r = await fetch(url, {
        headers: {
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
          "Accept-Language": "ko-KR,ko;q=0.9",
          Referer: "https://aion2.inven.co.kr/",
        },
        signal: AbortSignal.timeout(8000),
      });
      if (r.ok) html = await r.text();
    } catch { /* ignore */ }
  }

  // 3) CORS 프록시 fallback
  if (!html) {
    html = await fetchViaCorsProxy(url);
  }

  if (!html) throw new Error(`직업 ${jobNum} 페이지 로드 실패`);

  // HTML 파싱 → data-props 추출 (브라우저가 엔티티 자동 디코딩)
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, "text/html");
  const main = doc.querySelector("[data-props]");
  if (!main) throw new Error(`직업 ${jobNum}: data-props 요소 없음`);

  let props: { baseData?: Record<string, InvenSkillRaw> };
  try {
    props = JSON.parse(main.getAttribute("data-props") || "{}");
  } catch (e) {
    throw new Error(`직업 ${jobNum}: JSON 파싱 실패 — ${(e as Error).message}`);
  }
  if (!props.baseData) throw new Error(`직업 ${jobNum}: baseData 없음`);
  return props.baseData;
}

type InvenSkillRaw = {
  name: string;
  category: number; // 1=Active, 2=Passive, 3=Dp
  speciality?: Array<{ level: number; desc: string }>;
  icon?: string;
};

export type ImportResult = {
  /** 갱신된 기존 스킬 수 (이름·카테고리·특화 효과 자동 갱신) */
  updated: number;
  /** 기존 DB에 없는 신규 스킬 — 호출자가 confirm 후 추가 */
  newSkills: Skill[];
  /** 직업별 오류 메시지 */
  errors: string[];
};

/** V4.0.9 importInvenSkillsForJobs 포팅.
 *  매칭 키: 기존 store에서 `id === canonId` 또는 `(skillId === code AND jobId 일치)`.
 *  갱신은 호출자(store.bulkUpsertSkills)에서 처리. 이 함수는 raw 결과만 반환. */
export async function importInvenSkillsForJobs(
  jobNums: number[],
  currentSkills: Skill[],
  statusCb: (msg: string) => void = () => {}
): Promise<ImportResult> {
  const updated: Skill[] = []; // 갱신된 기존 스킬
  const newSkills: Skill[] = []; // 신규 스킬
  const errors: string[] = [];

  for (const jobNum of jobNums) {
    const jobId = JOB_NUM_TO_ID[jobNum];
    if (!jobId) continue;
    const jobName = JOB_KO[jobId] ?? jobId;

    statusCb(`⏳ ${jobName} (${jobNum}번) 불러오는 중…`);

    let baseData: Record<string, InvenSkillRaw>;
    try {
      baseData = await fetchInvenSkillPage(jobNum);
    } catch (e) {
      errors.push(`${jobName}: ${(e as Error).message}`);
      continue;
    }

    for (const [codeStr, skData] of Object.entries(baseData)) {
      const code = Number(codeStr);
      const cat: SkillCategory = INVEN_CAT_MAP[skData.category] ?? "Active";

      // speciality → specialEffects 배열
      // Inven 응답의 level은 string/number 혼용 — Number() 변환으로 양쪽 모두 대응.
      // desc도 string이 아닐 수 있으므로 String() 캐스팅. V4.0.9 동등.
      const specialEffects: SpecialEffect[] = [];
      const specRaw: unknown = (skData as { speciality?: unknown }).speciality;
      const specArr: Array<{ level?: unknown; desc?: unknown }> = Array.isArray(specRaw)
        ? (specRaw as Array<{ level?: unknown; desc?: unknown }>)
        : [];
      for (const eff of specArr) {
        const lv = Number(eff?.level);
        const text = String(eff?.desc ?? "").trim();
        if (Number.isFinite(lv) && lv > 0 && text) {
          specialEffects.push({ level: lv, text });
        }
      }

      const canonId = `sk_${jobId}_${code}`;
      const existing = currentSkills.find(
        (s) =>
          s.id === canonId ||
          (s.skillId === code && (s.jobId === jobId || s.job === jobName))
      );

      const baseLv = SKILL_BASELV_SEED[cat] ?? { base: 0, daevanion: 0 };

      if (existing) {
        updated.push({
          ...existing,
          name: skData.name || existing.name,
          category: cat,
          skillId: code || existing.skillId,
          specialEffects,
        });
      } else {
        newSkills.push({
          id: canonId,
          skillId: code,
          name: skData.name,
          category: cat,
          jobId,
          job: jobName,
          icon: skData.icon ? (skData.icon.startsWith("http") ? skData.icon : ICON_BASE + skData.icon) : "",
          baseLv: { base: baseLv.base, daevanion: baseLv.daevanion },
          daevanion: baseLv.daevanion > 0,
          specialEffects,
        });
      }
    }
  }

  return {
    updated: updated.length,
    newSkills,
    errors,
    // updated 전체 객체는 호출자에서 store에 patch 적용 (이름·카테고리·특화 효과)
    // 호출자는 newSkills만 confirm 후 add. updated는 자동 적용.
    ...{ _updatedList: updated },
  } as ImportResult & { _updatedList: Skill[] };
}
