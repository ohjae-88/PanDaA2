import type { ContentChangeLog, RaidType } from "./types";

/** 콘텐츠 한글 이름 */
export const RAID_NAME_KO: Record<RaidType, string> = {
  expedition: "원정",
  transcend: "초월",
  sanctuary_ludra: "루드라",
  sanctuary_bagot: "바고트",
};

/** "보스" 단독 액션의 한글 라벨 — 원정/초월=보스처치, 루드라/바고트=입장권 사용 */
export function bossActionLabel(raidKey: RaidType): string {
  if (raidKey === "sanctuary_ludra" || raidKey === "sanctuary_bagot") return "입장권 사용";
  return "보스처치";
}

/** target/delta → 적용 내용 텍스트
 *  - both: "1회" (보상+보스 동시)
 *  - reward: "보상" (단독 보상 변경)
 *  - boss: 콘텐츠별 라벨 */
export function actionLabel(log: ContentChangeLog): string {
  const prefix = log.delta >= 0 ? "환급 " : "";
  if (log.target === "both") return `${prefix}1회`;
  if (log.target === "boss") return `${prefix}${bossActionLabel(log.raidKey)}`;
  return `${prefix}보상`;
}

/** 경과 시간 포맷 — 사용자 사양:
 *  - 1시간 이내: "{m}분 {s}초전" (분 0이면 "{s}초전")
 *  - 1시간 ~ 24시간: "{h}시간 {m}분전"
 *  - 24시간 초과: "{d}일 {h}시간전" */
export function formatElapsed(elapsedMs: number): string {
  if (elapsedMs < 0) elapsedMs = 0;
  const sec = Math.floor(elapsedMs / 1000);
  if (sec < 3600) {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}초전`;
    return `${m}분 ${s}초전`;
  }
  if (sec < 86_400) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    return `${h}시간 ${m}분전`;
  }
  const d = Math.floor(sec / 86_400);
  const h = Math.floor((sec % 86_400) / 3600);
  return `${d}일 ${h}시간전`;
}

/** 단일 로그 한 줄 — "[콘텐츠명] [경과] [적용]" */
export function formatLogLine(log: ContentChangeLog, nowMs: number = Date.now()): string {
  const name = RAID_NAME_KO[log.raidKey] ?? log.raidKey;
  const elapsed = formatElapsed(nowMs - log.ts);
  const action = actionLabel(log);
  return `${name} ${elapsed} ${action}`;
}
