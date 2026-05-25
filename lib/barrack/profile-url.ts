import type { Character, DbSettings } from "./types";
import { DB_DEFAULTS } from "./constants";

/** V4.0.9 getServerId — dbSettings.serverList 우선, default 폴백 */
export function getServerId(
  serverName: string | undefined,
  race: string | undefined,
  db: DbSettings
): string | null {
  if (!serverName) return null;
  const list = db.serverList?.length ? db.serverList : DB_DEFAULTS.serverList;
  const s = list.find((x) => x.name === serverName && (!race || x.race === race));
  if (s && s.id) return s.id;
  const fb = DB_DEFAULTS.serverList.find((x) => x.name === serverName && (!race || x.race === race));
  return fb ? fb.id : null;
}

/** V4.0.9 charProfileUrl 동등 — aion2tool.com 캐릭터 페이지 */
export function charProfileUrl(c: Character, db: DbSettings): string | null {
  const srvId = getServerId(c.server, c.race, db);
  if (!srvId || !c.name) return null;
  return `https://www.aion2tool.com/char/serverid=${srvId}/${encodeURIComponent(c.name)}`;
}
