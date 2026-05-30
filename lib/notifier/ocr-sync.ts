// OCR 라인 → 보스명 + 잔여초 추출 → 알리미 항목 매칭
//
// 게임 화면 한 항목은 보통 2줄:
//   "동쪽의 네이켈        965M"   ← 이름 + 거리(무시)
//   "남은 시간 8분 12초"          ← 잔여 시간
// 거리([N]M / [N]K)는 무시. 이름 줄 뒤의 거리 토큰을 제거 후 매칭.

import type { OcrLine } from "./ocr-store";
import type { NotifierItem } from "./types";

export type ParsedEntry = { name: string; remainSec: number; spawned: boolean };

export type SyncMatch = {
  ocrName: string;
  remainSec: number;
  /** "출현 중" — 잔여시간 미표시, 쿨타임 full 반영 */
  spawned: boolean;
  /** 매칭된 항목 (없으면 null) */
  itemId: string | null;
  itemName: string | null;
  cycleMinutes: number | null;
};

/** 거리 토큰 제거: "동쪽의 네이켈 965M" → "동쪽의 네이켈" */
function stripDistance(s: string): string {
  return s.replace(/\s*\d[\d,]*\s*[MmKk]\b.*$/u, "").trim();
}

/** 공백 제거 + 소문자 정규화 (매칭용) */
function norm(s: string): string {
  return s.replace(/\s+/g, "").toLowerCase();
}

/** "남은 시간 1시간 22분 6초" → 초. "남은 시간" 라벨 + 시/분/초 개별 추출.
 *  0시간·0분 생략, 공백 유무 무관. 시간 정보 없으면 null. */
function parseRemain(s: string): number | null {
  if (!/남은\s*시간/u.test(s)) return null;
  // 라벨 뒤 구간만 대상 (라벨의 "시간" 글자 오인 방지)
  const m = s.match(/남은\s*시간/u);
  const after = m ? s.slice((m.index ?? 0) + m[0].length) : s;
  const h = after.match(/(\d+)\s*시간/u);
  const min = after.match(/(\d+)\s*분/u);
  const sec = after.match(/(\d+)\s*초/u);
  if (!h && !min && !sec) return null;
  return Number(h?.[1] ?? 0) * 3600 + Number(min?.[1] ?? 0) * 60 + Number(sec?.[1] ?? 0);
}

/** "출현 중" 상태 판정 (OCR 오인식 대비 느슨하게) */
function isSpawned(s: string): boolean {
  return /출\s*현/u.test(s);
}

/** OCR 라인들 → 보스명 + (잔여초 | 출현중) 항목 추출.
 *  구조: [보스명 ... 000M] 줄 다음에 [남은 시간 00시간 00분 00초] 또는 [출현 중] 줄.
 *  - "출현 중": 잔여 미표시 → spawned=true (적용 시 쿨타임 full 반영)
 *  - "남은 시간": 시/분/초 일부 생략 가능 (0시간·0분 미표시) */
export function parseOcrLines(lines: OcrLine[]): ParsedEntry[] {
  const sorted = [...lines].sort((a, b) => a.y - b.y);
  const out: ParsedEntry[] = [];
  let lastName: string | null = null;
  for (const ln of sorted) {
    const text = ln.text.trim();
    if (!text) continue;

    // 1) 출현 중 — 상태 줄
    if (isSpawned(text) && !/남은\s*시간/u.test(text)) {
      const head = text.slice(0, text.search(/출\s*현/u)).trim();
      const name = head ? stripDistance(head) : lastName;
      if (name) out.push({ name, remainSec: 0, spawned: true });
      lastName = null;
      continue;
    }

    // 2) 남은 시간 — 잔여시간 줄
    const rem = parseRemain(text);
    if (rem !== null) {
      // 같은 줄에 이름이 함께 있을 수도 있음 (OCR 병합) → "남은 시간" 앞부분 검사
      const head = text.slice(0, text.search(/남은\s*시간/u)).trim();
      const name = head ? stripDistance(head) : lastName;
      if (name) out.push({ name, remainSec: rem, spawned: false });
      lastName = null;
      continue;
    }

    // 3) 그 외 → 보스명 후보 (거리 토큰 제거)
    const cleaned = stripDistance(text);
    if (cleaned) lastName = cleaned;
  }
  return out;
}

/** 추출 항목 → 알리미 항목 매칭. 쿨다운(cooldown) 항목만 대상. */
export function matchEntries(entries: ParsedEntry[], items: NotifierItem[]): SyncMatch[] {
  const mname = (it: NotifierItem) => (it.ocrName && it.ocrName.trim() ? it.ocrName : it.name);
  return entries.map((e) => {
    const en = norm(e.name);
    // 1) 완전 일치 → 2) 포함 관계 (양방향). 비교는 ocrName(없으면 name) 기준. 전체 항목 대상.
    let hit =
      items.find((it) => norm(mname(it)) === en) ||
      items.find((it) => {
        const inm = norm(mname(it));
        return inm.length >= 2 && en.length >= 2 && (inm.includes(en) || en.includes(inm));
      });
    return {
      ocrName: e.name,
      remainSec: e.remainSec,
      spawned: e.spawned,
      itemId: hit?.id ?? null,
      itemName: hit?.name ?? null,
      cycleMinutes: hit?.cycleMinutes ?? null,
    };
  });
}
