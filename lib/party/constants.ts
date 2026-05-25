import type { PartyServer } from "./types";

export const PARTY_JOBS = [
  { id: "수호성", icon: "🛡️", color: "#4a90d9" },
  { id: "검성",   icon: "🗡️", color: "#30bfbf" },
  { id: "치유성", icon: "💗", color: "#e8609a" },
  { id: "호법성", icon: "💪", color: "#3dbf6e" },
  { id: "궁성",   icon: "🏹", color: "#d4b800" },
  { id: "마도성", icon: "🔥", color: "#e8711a" },
  { id: "살성",   icon: "🔪", color: "#d94040" },
  { id: "정령성", icon: "🏵️", color: "#9b50e0" },
] as const;

export const PARTY_JOB_MAP = Object.fromEntries(PARTY_JOBS.map((j) => [j.id, j]));

export function jI(id: string | undefined): { id: string; icon: string; color: string } {
  return (id && PARTY_JOB_MAP[id]) || { id: id || "", icon: "⚔️", color: "#888" };
}

/** V4.0.9 DEFAULT_SERVERS — 천족 21 + 마족 21 = 42 서버 */
export const DEFAULT_PARTY_SERVERS: PartyServer[] = [
  { name: "시엘", serverId: 1001, race: "천족" }, { name: "네자칸", serverId: 1002, race: "천족" },
  { name: "바이젤", serverId: 1003, race: "천족" }, { name: "카이시넬", serverId: 1004, race: "천족" },
  { name: "유스티엘", serverId: 1005, race: "천족" }, { name: "아리엘", serverId: 1006, race: "천족" },
  { name: "프레기온", serverId: 1007, race: "천족" }, { name: "메스람타에다", serverId: 1008, race: "천족" },
  { name: "히타니에", serverId: 1009, race: "천족" }, { name: "나니아", serverId: 1010, race: "천족" },
  { name: "타하바타", serverId: 1011, race: "천족" }, { name: "루터스", serverId: 1012, race: "천족" },
  { name: "페르노스", serverId: 1013, race: "천족" }, { name: "다미누", serverId: 1014, race: "천족" },
  { name: "카사카", serverId: 1015, race: "천족" }, { name: "바카르마", serverId: 1016, race: "천족" },
  { name: "첸가룽", serverId: 1017, race: "천족" }, { name: "코치룽", serverId: 1018, race: "천족" },
  { name: "이슈타르", serverId: 1019, race: "천족" }, { name: "티아마트", serverId: 1020, race: "천족" },
  { name: "포에타", serverId: 1021, race: "천족" },
  { name: "이스라펠", serverId: 2001, race: "마족" }, { name: "지켈", serverId: 2002, race: "마족" },
  { name: "트리니엘", serverId: 2003, race: "마족" }, { name: "루미엘", serverId: 2004, race: "마족" },
  { name: "마르쿠탄", serverId: 2005, race: "마족" }, { name: "아스펠", serverId: 2006, race: "마족" },
  { name: "에레슈키칼", serverId: 2007, race: "마족" }, { name: "브리트라", serverId: 2008, race: "마족" },
  { name: "네몬", serverId: 2009, race: "마족" }, { name: "하달", serverId: 2010, race: "마족" },
  { name: "루드라", serverId: 2011, race: "마족" }, { name: "울고른", serverId: 2012, race: "마족" },
  { name: "무닌", serverId: 2013, race: "마족" }, { name: "오다르", serverId: 2014, race: "마족" },
  { name: "젠카카", serverId: 2015, race: "마족" }, { name: "크로메데", serverId: 2016, race: "마족" },
  { name: "콰이링", serverId: 2017, race: "마족" }, { name: "바바룽", serverId: 2018, race: "마족" },
  { name: "파프니르", serverId: 2019, race: "마족" }, { name: "인드나흐", serverId: 2020, race: "마족" },
  { name: "이스할겐", serverId: 2021, race: "마족" },
];

/** V4.0.9 pColor — 플레이어 id 해시 색상 (어두운 톤, 배경용) */
export function pColor(id: string): string {
  const h = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `hsl(${h}, 35%, 24%)`;
}

/** 플레이어 칩 등 다크모드 가시성 우선 — 한 색상으로 fg/bg 일관 적용 */
export function pColorBright(id: string): string {
  const h = [...id].reduce((a, c) => a + c.charCodeAt(0), 0) % 360;
  return `hsl(${h}, 75%, 72%)`;
}

/** V4.0.9 pFmtN — 큰 숫자는 만/억 단위 표기 */
export function pFmtN(n: number | undefined | null): string {
  if (!n) return "—";
  if (n >= 100_000_000) return (n / 100_000_000).toFixed(1) + "억";
  if (n >= 10_000) return Math.round(n / 10_000) + "만";
  return n.toLocaleString();
}
