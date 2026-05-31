"use client";

import { useEffect, useMemo, useState } from "react";
import { Download, Trash2, RefreshCw, Pencil, Check, X } from "lucide-react";
import { useBarrackStore } from "@/lib/barrack/store";
import { subscribeSecondTick } from "@/lib/util/global-tick";
import { CLASSES } from "@/lib/barrack/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RAID_NAME_KO,
  actionLabel,
  formatElapsed,
} from "@/lib/barrack/content-log";
import type { ContentChangeLog, RaidType } from "@/lib/barrack/types";

/** ts → datetime-local 문자열 */
function tsToLocal(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}
import { cn } from "@/lib/utils";
import { ContentHistoryChart } from "@/components/barrack/history-chart";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

type Row = {
  ts: number;
  log: ContentChangeLog;
  accId: string;
  accName: string;
  charId: string;
  charName: string;
  classIcon: string;
  classColor: string;
};

/** 절대 시간 포맷 — YYYY-MM-DD HH:MM:SS */
function fmtAbsTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

export default function HistoryPage() {
  const characters = useBarrackStore((s) => s.characters);
  const accounts = useBarrackStore((s) => s.accounts);
  const patch = useBarrackStore((s) => s.patchCharacter);
  const updateLog = useBarrackStore((s) => s.updateContentLog);
  const removeLog = useBarrackStore((s) => s.removeContentLog);

  // 편집 중인 행 — key: `${charId}-${ts}-${idx}`
  const [editKey, setEditKey] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState<ContentChangeLog & { tsStr: string }>({
    raidKey: "expedition", target: "both", delta: -1, ts: 0, tsStr: "",
  });

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // 경과 시간 갱신용 1초 tick — 글로벌 visibility-aware tick 공유
  const [, setTick] = useState(0);
  useEffect(() => subscribeSecondTick(() => setTick((t) => t + 1)), []);

  // 필터 상태
  const [filterAcc, setFilterAcc] = useState<string>("");
  const [filterChar, setFilterChar] = useState<string>("");
  const [filterRaid, setFilterRaid] = useState<string>("");
  const [filterAction, setFilterAction] = useState<string>(""); // "" / "both" / "boss" / "reward"
  const [filterDirection, setFilterDirection] = useState<string>(""); // "" / "minus" / "plus"
  const [query, setQuery] = useState("");

  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);

  // 모든 캐릭터 로그 합치고 ts 내림차순
  const rows: Row[] = useMemo(() => {
    const out: Row[] = [];
    for (const c of characters) {
      const acc = accMap[c.accountId];
      const cls = CLASS_MAP[c.classId];
      for (const log of c.contentChangeLog ?? []) {
        out.push({
          ts: log.ts,
          log,
          accId: c.accountId,
          accName: acc?.name ?? "-",
          charId: c.id,
          charName: c.name,
          classIcon: cls?.icon ?? "❓",
          classColor: cls?.color ?? "#666",
        });
      }
    }
    out.sort((a, b) => b.ts - a.ts);
    return out;
  }, [characters, accMap]);

  // 필터 적용
  const filtered = useMemo(() => {
    const ql = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (filterAcc && r.accId !== filterAcc) return false;
      if (filterChar && r.charId !== filterChar) return false;
      if (filterRaid && r.log.raidKey !== filterRaid) return false;
      if (filterAction && r.log.target !== filterAction) return false;
      if (filterDirection === "minus" && r.log.delta >= 0) return false;
      if (filterDirection === "plus" && r.log.delta < 0) return false;
      if (ql) {
        const hay = `${r.accName} ${r.charName} ${RAID_NAME_KO[r.log.raidKey] ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [rows, filterAcc, filterChar, filterRaid, filterAction, filterDirection, query]);

  // CSV 내보내기
  function handleExportCsv() {
    if (!filtered.length) { toast.warning("내보낼 기록이 없습니다."); return; }
    const header = ["시간", "계정", "캐릭터", "콘텐츠", "적용", "delta(부호)", "ts(epoch ms)"];
    const lines = [header.join(",")];
    for (const r of filtered) {
      const action = actionLabel(r.log);
      const sign = r.log.delta < 0 ? "사용/처치" : "환급";
      lines.push([
        `"${fmtAbsTime(r.ts)}"`,
        `"${r.accName.replace(/"/g, '""')}"`,
        `"${r.charName.replace(/"/g, '""')}"`,
        `"${RAID_NAME_KO[r.log.raidKey] ?? r.log.raidKey}"`,
        `"${action.replace(/"/g, '""')}"`,
        `"${sign}"`,
        String(r.ts),
      ].join(","));
    }
    const blob = new Blob(["﻿" + lines.join("\n")], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `barrack-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // JSON 내보내기
  function handleExportJson() {
    if (!filtered.length) { toast.warning("내보낼 기록이 없습니다."); return; }
    const payload = {
      _kind: "a2-barrack-history",
      exportedAt: new Date().toISOString(),
      count: filtered.length,
      rows: filtered.map((r) => ({
        ts: r.ts,
        time: fmtAbsTime(r.ts),
        accountId: r.accId,
        accountName: r.accName,
        characterId: r.charId,
        characterName: r.charName,
        raidKey: r.log.raidKey,
        raidName: RAID_NAME_KO[r.log.raidKey],
        target: r.log.target,
        delta: r.log.delta,
        action: actionLabel(r.log),
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `barrack-history-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // 전체 기록 삭제 (필터 무관)
  async function handleClearAll() {
    if (!(await confirmDialog({ title: "전체 기록 삭제", description: "모든 캐릭터의 콘텐츠 변경 기록을 삭제합니다.", confirmText: "삭제", variant: "destructive" }))) return;
    for (const c of characters) {
      if (c.contentChangeLog && c.contentChangeLog.length > 0) {
        patch(c.id, { contentChangeLog: [] });
      }
    }
  }

  function startEdit(key: string, log: ContentChangeLog) {
    setEditKey(key);
    setEditDraft({ ...log, tsStr: tsToLocal(log.ts) });
  }
  function saveEdit(charId: string, oldTs: number) {
    const ts = new Date(editDraft.tsStr).getTime();
    if (isNaN(ts)) { toast.error("날짜 형식 오류"); return; }
    updateLog(charId, oldTs, { raidKey: editDraft.raidKey, target: editDraft.target, delta: editDraft.delta, ts });
    setEditKey(null);
  }
  async function deleteRow(charId: string, ts: number) {
    if (!(await confirmDialog({ title: "기록 삭제", description: "이 기록 1건을 삭제합니다.", confirmText: "삭제", variant: "destructive" }))) return;
    removeLog(charId, ts);
  }

  // 필터된 행만 삭제
  async function handleClearFiltered() {
    if (!filtered.length) return;
    if (!(await confirmDialog({ title: "필터 기록 삭제", description: `현재 필터에 해당하는 ${filtered.length}건 기록을 삭제합니다.`, confirmText: "삭제", variant: "destructive" }))) return;
    // charId 별로 삭제할 ts 집합
    const byChar = new Map<string, Set<number>>();
    for (const r of filtered) {
      if (!byChar.has(r.charId)) byChar.set(r.charId, new Set());
      byChar.get(r.charId)!.add(r.ts);
    }
    for (const [cid, tsSet] of byChar) {
      const c = characters.find((x) => x.id === cid);
      if (!c) continue;
      const next = (c.contentChangeLog ?? []).filter((l) => !tsSet.has(l.ts));
      patch(cid, { contentChangeLog: next });
    }
  }

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  const charactersInFilteredAcc = filterAcc
    ? characters.filter((c) => c.accountId === filterAcc)
    : characters;

  return (
    <div className="space-y-4">
      <div className="flex items-end justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">📋 콘텐츠 변경 기록</h1>
          <p className="text-xs text-muted-foreground mt-1">
            배럭관리 모든 캐릭터의 콘텐츠(원정·초월·루드라·바고트) 변경 이력. 최신순 표시.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button size="sm" variant="ghost" onClick={handleExportCsv} disabled={!filtered.length}>
            <Download className="h-4 w-4" /> CSV
          </Button>
          <Button size="sm" variant="ghost" onClick={handleExportJson} disabled={!filtered.length}>
            <Download className="h-4 w-4" /> JSON
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearFiltered}
            disabled={!filtered.length}
            className="text-amber-500"
            title="현재 필터에 해당하는 기록만 삭제"
          >
            <Trash2 className="h-4 w-4" /> 필터 삭제
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={handleClearAll}
            className="text-destructive"
            title="모든 캐릭터의 모든 기록 삭제"
          >
            <Trash2 className="h-4 w-4" /> 전체 삭제
          </Button>
        </div>
      </div>

      {/* 진행 히스토리 차트 */}
      <ContentHistoryChart days={7} />

      {/* 필터 바 */}
      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Input
          className="w-[200px] h-8"
          placeholder="이름·콘텐츠·계정 검색"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select value={filterAcc || "_all"} onValueChange={(v) => { setFilterAcc(v === "_all" ? "" : v); setFilterChar(""); }}>
          <SelectTrigger className="w-[150px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 계정</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterChar || "_all"} onValueChange={(v) => setFilterChar(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[180px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 캐릭터</SelectItem>
            {charactersInFilteredAcc.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {CLASS_MAP[c.classId]?.icon ?? "❓"} {c.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterRaid || "_all"} onValueChange={(v) => setFilterRaid(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 콘텐츠</SelectItem>
            <SelectItem value="expedition">🗺 원정</SelectItem>
            <SelectItem value="transcend">⚡ 초월</SelectItem>
            <SelectItem value="sanctuary_ludra">✨ 루드라</SelectItem>
            <SelectItem value="sanctuary_bagot">🌙 바고트</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterAction || "_all"} onValueChange={(v) => setFilterAction(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 적용</SelectItem>
            <SelectItem value="both">1회 (보상+보스)</SelectItem>
            <SelectItem value="boss">보스/입장권</SelectItem>
            <SelectItem value="reward">보상</SelectItem>
          </SelectContent>
        </Select>
        <Select value={filterDirection || "_all"} onValueChange={(v) => setFilterDirection(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[110px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 부호</SelectItem>
            <SelectItem value="minus">사용/처치</SelectItem>
            <SelectItem value="plus">환급</SelectItem>
          </SelectContent>
        </Select>
        <span className="ml-auto text-muted-foreground">
          <RefreshCw className="h-3 w-3 inline-block mr-1 opacity-50" />
          {filtered.length} / {rows.length} 건
        </span>
      </div>

      {/* 데이터 시트 */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <div className="max-h-[calc(100vh-260px)] overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40 sticky top-0 z-10">
              <tr>
                <th className="text-left px-3 py-2 w-[170px]">시간</th>
                <th className="text-left px-3 py-2 w-[100px]">경과</th>
                <th className="text-left px-3 py-2 w-[110px]">계정</th>
                <th className="text-left px-3 py-2">캐릭터</th>
                <th className="text-left px-3 py-2 w-[90px]">콘텐츠</th>
                <th className="text-left px-3 py-2 w-[120px]">적용</th>
                <th className="px-2 py-2 w-[60px]"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr><td colSpan={7} className="text-center text-muted-foreground py-8">기록이 없습니다.</td></tr>
              ) : filtered.map((r, idx) => {
                const key = `${r.charId}-${r.ts}-${idx}`;
                const isEditing = editKey === key;
                const action = actionLabel(r.log);
                const isRefund = r.log.delta >= 0;
                if (isEditing) {
                  return (
                    <tr key={key} className="border-t bg-accent/10">
                      {/* 시간 편집 */}
                      <td className="px-2 py-1" colSpan={2}>
                        <input
                          type="datetime-local"
                          step="1"
                          className="w-full rounded border bg-background px-1.5 py-0.5 text-xs tabular-nums"
                          value={editDraft.tsStr}
                          onChange={(e) => setEditDraft((d) => ({ ...d, tsStr: e.target.value }))}
                        />
                      </td>
                      {/* 계정/캐릭터 (읽기전용) */}
                      <td className="px-3 py-1 text-muted-foreground">{r.accName}</td>
                      <td className="px-3 py-1 font-bold" style={{ color: r.classColor }}>{r.classIcon} {r.charName}</td>
                      {/* 콘텐츠 */}
                      <td className="px-2 py-1">
                        <select
                          className="w-full rounded border bg-background px-1 py-0.5 text-xs"
                          value={editDraft.raidKey}
                          onChange={(e) => setEditDraft((d) => ({ ...d, raidKey: e.target.value as ContentChangeLog["raidKey"] }))}
                        >
                          <option value="expedition">🗺 원정</option>
                          <option value="transcend">⚡ 초월</option>
                          <option value="sanctuary_ludra">✨ 루드라</option>
                          <option value="sanctuary_bagot">🌙 바고트</option>
                        </select>
                      </td>
                      {/* 적용 */}
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <select
                            className="flex-1 rounded border bg-background px-1 py-0.5 text-xs"
                            value={editDraft.target}
                            onChange={(e) => setEditDraft((d) => ({ ...d, target: e.target.value as ContentChangeLog["target"] }))}
                          >
                            <option value="both">1회(보상+보스)</option>
                            <option value="reward">보상</option>
                            <option value="boss">보스</option>
                          </select>
                          <select
                            className="w-[52px] rounded border bg-background px-1 py-0.5 text-xs"
                            value={editDraft.delta}
                            onChange={(e) => setEditDraft((d) => ({ ...d, delta: Number(e.target.value) }))}
                          >
                            <option value={-1}>사용</option>
                            <option value={1}>환급</option>
                          </select>
                        </div>
                      </td>
                      {/* 저장/취소 */}
                      <td className="px-2 py-1">
                        <div className="flex items-center gap-1">
                          <button onClick={() => saveEdit(r.charId, r.ts)} title="저장"
                            className="p-1 rounded hover:bg-emerald-500/20 text-emerald-500">
                            <Check className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => setEditKey(null)} title="취소"
                            className="p-1 rounded hover:bg-accent/20 text-muted-foreground">
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                }
                return (
                  <tr key={key} className="border-t hover:bg-accent/5 group">
                    <td className="px-3 py-1.5 tabular-nums text-muted-foreground">{fmtAbsTime(r.ts)}</td>
                    <td className="px-3 py-1.5 tabular-nums">{formatElapsed(Date.now() - r.ts)}</td>
                    <td className="px-3 py-1.5">{r.accName}</td>
                    <td className="px-3 py-1.5 font-bold" style={{ color: r.classColor }}>
                      {r.classIcon} {r.charName}
                    </td>
                    <td className="px-3 py-1.5">{RAID_NAME_KO[r.log.raidKey as RaidType] ?? r.log.raidKey}</td>
                    <td className={cn("px-3 py-1.5 font-bold", isRefund ? "text-emerald-500" : "text-rose-400")}>
                      {action}
                    </td>
                    <td className="px-2 py-1.5">
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => startEdit(key, r.log)} title="편집"
                          className="p-1 rounded hover:bg-accent/20 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button onClick={() => deleteRow(r.charId, r.ts)} title="삭제"
                          className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
