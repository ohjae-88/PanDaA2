"use client";

import { useEffect, useMemo, useState } from "react";
import { RefreshCw, CheckCircle2, AlertCircle, MinusCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { usePartyStore } from "@/lib/party/store";
import { fetchCharacterFullInfo } from "@/lib/barrack/equip-api";
import { jI, pFmtN } from "@/lib/party/constants";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onClose: () => void };

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; oldCp?: number; newCp?: number; oldIlvl?: number; newIlvl?: number; nameChanged?: { old: string; new: string } }
  | { kind: "skip"; reason: string }
  | { kind: "error"; message: string };

type Row = { playerId: string; playerName: string; charId: string; cid: string; serverId: number };

/** 파티편집 — 캐릭터 DB 전체 캐릭터의 전투력/아이템레벨 일괄 갱신.
 *  characterId + serverId가 모두 있는 캐릭터만 대상. /api/character/info 호출. */
export function PartyRefreshCpDialog({ open, onClose }: Props) {
  const players = usePartyStore((s) => s.players);
  const patch = usePartyStore((s) => s.patchCharacter);

  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [running, setRunning] = useState(false);

  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const p of players) {
      for (const c of p.characters) {
        const cid = c.characterId;
        const srvId = c.serverId;
        if (!cid || !srvId) continue;
        out.push({ playerId: p.id, playerName: p.name, charId: c.id, cid, serverId: srvId });
      }
    }
    return out;
  }, [players]);

  const skipped = useMemo(() => {
    const out: { playerName: string; charName: string; reason: string }[] = [];
    for (const p of players) {
      for (const c of p.characters) {
        if (!c.characterId) out.push({ playerName: p.name, charName: c.name, reason: "캐릭터 ID 미등록" });
        else if (!c.serverId) out.push({ playerName: p.name, charName: c.name, reason: "서버 ID 미설정" });
      }
    }
    return out;
  }, [players]);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, Status> = {};
    rows.forEach((r) => { init[r.charId] = { kind: "idle" }; });
    setStatuses(init);
  }, [open, rows]);

  async function runOne(row: Row) {
    const pl = players.find((x) => x.id === row.playerId);
    const c = pl?.characters.find((x) => x.id === row.charId);
    if (!c) return;
    setStatuses((s) => ({ ...s, [row.charId]: { kind: "pending" } }));
    try {
      const info = await fetchCharacterFullInfo(row.cid, row.serverId);
      const oldCp = c.cp ?? 0;
      const oldIlvl = c.itemLevel ?? 0;
      const oldName = c.name;
      const update: Partial<typeof c> = {};
      if (info.cp !== undefined && info.cp !== oldCp) update.cp = info.cp;
      if (info.itemLevel !== undefined && info.itemLevel !== oldIlvl) update.itemLevel = info.itemLevel;
      let nameChanged: { old: string; new: string } | undefined;
      if (info.name && info.name !== oldName) {
        update.name = info.name;
        nameChanged = { old: oldName, new: info.name };
      }
      if (Object.keys(update).length) patch(row.playerId, row.charId, update);
      setStatuses((s) => ({
        ...s,
        [row.charId]: {
          kind: "ok",
          oldCp, newCp: info.cp ?? oldCp,
          oldIlvl, newIlvl: info.itemLevel ?? oldIlvl,
          nameChanged,
        },
      }));
    } catch (err) {
      setStatuses((s) => ({ ...s, [row.charId]: { kind: "error", message: (err as Error).message } }));
    }
  }

  async function runAll() {
    setRunning(true);
    for (const r of rows) {
      await runOne(r);
      await new Promise((res) => setTimeout(res, 100));
    }
    setRunning(false);
  }

  const summary = useMemo(() => {
    let ok = 0, skip = 0, err = 0, pending = 0;
    Object.values(statuses).forEach((s) => {
      if (s.kind === "ok") ok++;
      else if (s.kind === "skip") skip++;
      else if (s.kind === "error") err++;
      else if (s.kind === "pending") pending++;
    });
    return { ok, skip: skip + skipped.length, err, pending, total: rows.length };
  }, [statuses, rows.length, skipped.length]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
            🔄 파티 캐릭터 DB — 전투력 · 아이템레벨 일괄 갱신
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
          <span>대상 <b className="text-foreground">{summary.total}</b></span>
          <span>· 갱신 <b className="text-emerald-600 dark:text-emerald-300">{summary.ok}</b></span>
          <span>· 건너뜀 <b className="text-amber-600 dark:text-amber-300">{summary.skip}</b></span>
          <span>· 오류 <b className="text-rose-600 dark:text-rose-300">{summary.err}</b></span>
          {running && <span>· 진행 중 <b>{summary.pending}</b></span>}
        </div>

        <div className="max-h-[55vh] overflow-auto rounded border bg-card/40">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr>
                <th className="text-left px-2 py-1.5">상태</th>
                <th className="text-left px-2 py-1.5">플레이어</th>
                <th className="text-left px-2 py-1.5">캐릭터</th>
                <th className="text-right px-2 py-1.5">전투력</th>
                <th className="text-right px-2 py-1.5">아이템 Lv</th>
                <th className="text-left px-2 py-1.5">비고</th>
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && skipped.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">캐릭터 DB가 비어있습니다.</td></tr>
              )}
              {rows.map((r) => {
                const pl = players.find((x) => x.id === r.playerId);
                const c = pl?.characters.find((x) => x.id === r.charId);
                if (!c) return null;
                const j = jI(c.job);
                const st = statuses[r.charId] ?? { kind: "idle" };
                return (
                  <tr key={r.charId} className="border-t">
                    <td className="px-2 py-1">
                      {st.kind === "pending" && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      {st.kind === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />}
                      {st.kind === "skip" && <MinusCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />}
                      {st.kind === "error" && <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-300" />}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{r.playerName}</td>
                    <td className="px-2 py-1 font-bold" style={{ color: j.color }}>
                      {j.icon} {c.name}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {st.kind === "ok" && st.oldCp !== st.newCp
                        ? <span><span className="text-muted-foreground line-through">{pFmtN(st.oldCp ?? 0)}</span> → <b className="text-emerald-600 dark:text-emerald-300">{pFmtN(st.newCp ?? 0)}</b></span>
                        : pFmtN(c.cp ?? 0)}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {st.kind === "ok" && st.oldIlvl !== st.newIlvl
                        ? <span><span className="text-muted-foreground line-through">{st.oldIlvl}</span> → <b className="text-emerald-600 dark:text-emerald-300">{st.newIlvl}</b></span>
                        : (c.itemLevel ?? "-")}
                    </td>
                    <td className="px-2 py-1 text-[11px] text-muted-foreground truncate max-w-[220px]">
                      {st.kind === "ok" && st.nameChanged && (
                        <span className="text-amber-600 dark:text-amber-300">
                          ⚠️ {st.nameChanged.old} → {st.nameChanged.new}
                        </span>
                      )}
                      {st.kind === "error" && st.message}
                    </td>
                  </tr>
                );
              })}
              {skipped.map((s, i) => (
                <tr key={`skip-${i}`} className="border-t opacity-70">
                  <td className="px-2 py-1">
                    <MinusCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />
                  </td>
                  <td className="px-2 py-1 text-muted-foreground">{s.playerName}</td>
                  <td className="px-2 py-1">{s.charName}</td>
                  <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">-</td>
                  <td className="px-2 py-1 text-right tabular-nums text-muted-foreground">-</td>
                  <td className="px-2 py-1 text-[11px] text-amber-600 dark:text-amber-300">{s.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>닫기</Button>
          <Button onClick={runAll} disabled={running || rows.length === 0}>
            <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
            {running ? "갱신 중..." : "전체 갱신 시작"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
