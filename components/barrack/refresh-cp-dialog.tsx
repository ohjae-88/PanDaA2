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
import { useBarrackStore } from "@/lib/barrack/store";
import { fetchCharacterFullInfo } from "@/lib/barrack/equip-api";
import { getServerId } from "@/lib/barrack/profile-url";
import { CLASSES } from "@/lib/barrack/constants";
import { fmtN } from "@/lib/barrack/time";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onClose: () => void };

type Status =
  | { kind: "idle" }
  | { kind: "pending" }
  | { kind: "ok"; oldCp?: number; newCp?: number; oldIlvl?: number; newIlvl?: number; nameChanged?: { old: string; new: string } }
  | { kind: "skip"; reason: string }
  | { kind: "error"; message: string };

const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

export function RefreshCpDialog({ open, onClose }: Props) {
  const characters = useBarrackStore((s) => s.characters);
  const accounts = useBarrackStore((s) => s.accounts);
  const db = useBarrackStore((s) => s.dbSettings);
  const patch = useBarrackStore((s) => s.patchCharacter);

  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [running, setRunning] = useState(false);

  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);
  const targets = useMemo(() => characters.filter((c) => !c.hidden), [characters]);

  useEffect(() => {
    if (!open) return;
    const init: Record<string, Status> = {};
    targets.forEach((c) => { init[c.id] = { kind: "idle" }; });
    setStatuses(init);
  }, [open, targets]);

  async function runOne(charId: string) {
    const c = characters.find((x) => x.id === charId);
    if (!c) return;
    const cid = c.characterId || c.cid;
    const srvId = getServerId(c.server, c.race, db);
    if (!cid) { setStatuses((s) => ({ ...s, [charId]: { kind: "skip", reason: "캐릭터 ID 미등록" } })); return; }
    if (!srvId) { setStatuses((s) => ({ ...s, [charId]: { kind: "skip", reason: "서버 ID 미설정" } })); return; }
    setStatuses((s) => ({ ...s, [charId]: { kind: "pending" } }));
    try {
      // /api/character/info 엔드포인트 사용 — character-dialog의 [불러오기]와 동일 경로.
      // cp는 ÷1000 적용된 천 단위 값으로 정규화되어 캐릭터 저장값과 단위 일치.
      const info = await fetchCharacterFullInfo(cid, srvId);
      const oldCp = c.cp ?? 0;
      const oldIlvl = c.itemLevel ?? 0;
      const oldName = c.name;
      const update: Partial<typeof c> = {};
      if (info.cp !== undefined && info.cp !== oldCp) update.cp = info.cp;
      if (info.itemLevel !== undefined && info.itemLevel !== oldIlvl) update.itemLevel = info.itemLevel;
      if (info.level !== undefined && info.level !== c.level) update.level = info.level;
      let nameChanged: { old: string; new: string } | undefined;
      if (info.name && info.name !== oldName) {
        update.name = info.name;
        nameChanged = { old: oldName, new: info.name };
      }
      if (Object.keys(update).length) patch(charId, update);
      setStatuses((s) => ({
        ...s,
        [charId]: {
          kind: "ok",
          oldCp, newCp: info.cp ?? oldCp,
          oldIlvl, newIlvl: info.itemLevel ?? oldIlvl,
          nameChanged,
        },
      }));
    } catch (err) {
      setStatuses((s) => ({ ...s, [charId]: { kind: "error", message: (err as Error).message } }));
    }
  }

  async function runAll() {
    setRunning(true);
    // 순차 실행 (서버 부하 분산)
    for (const c of targets) {
      await runOne(c.id);
      // 작은 인터벌
      await new Promise((r) => setTimeout(r, 100));
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
    return { ok, skip, err, pending, total: targets.length };
  }, [statuses, targets]);

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
            🔄 전투력 · 아이템레벨 일괄 업데이트
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>전체 <b className="text-foreground">{summary.total}</b></span>
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
                <th className="text-left px-2 py-1.5">계정</th>
                <th className="text-left px-2 py-1.5">캐릭터</th>
                <th className="text-right px-2 py-1.5">전투력</th>
                <th className="text-right px-2 py-1.5">아이템 Lv</th>
                <th className="text-left px-2 py-1.5">비고</th>
              </tr>
            </thead>
            <tbody>
              {targets.map((c) => {
                const cls = CLASS_MAP[c.classId];
                const st = statuses[c.id] ?? { kind: "idle" };
                return (
                  <tr key={c.id} className="border-t">
                    <td className="px-2 py-1">
                      {st.kind === "pending" && <RefreshCw className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
                      {st.kind === "ok" && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-300" />}
                      {st.kind === "skip" && <MinusCircle className="h-3.5 w-3.5 text-amber-600 dark:text-amber-300" />}
                      {st.kind === "error" && <AlertCircle className="h-3.5 w-3.5 text-rose-600 dark:text-rose-300" />}
                    </td>
                    <td className="px-2 py-1 text-muted-foreground">{accMap[c.accountId]?.name ?? "-"}</td>
                    <td className="px-2 py-1 font-bold" style={{ color: cls?.color }}>
                      {cls?.icon} {c.name}
                    </td>
                    <td className="px-2 py-1 text-right tabular-nums">
                      {st.kind === "ok" && st.oldCp !== st.newCp
                        ? <span><span className="text-muted-foreground line-through">{fmtN(st.oldCp)}</span> → <b className="text-emerald-600 dark:text-emerald-300">{fmtN(st.newCp)}</b></span>
                        : fmtN(c.cp)}
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
                      {st.kind === "skip" && st.reason}
                      {st.kind === "error" && st.message}
                    </td>
                  </tr>
                );
              })}
              {targets.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted-foreground py-6">표시할 캐릭터가 없습니다.</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={running}>닫기</Button>
          <Button onClick={runAll} disabled={running || targets.length === 0}>
            <RefreshCw className={cn("h-4 w-4", running && "animate-spin")} />
            {running ? "갱신 중..." : "전체 갱신 시작"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
