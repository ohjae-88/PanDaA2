"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, EyeOff, Eye } from "lucide-react";
import { useBarrackStore, computeOdMax } from "@/lib/barrack/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CharacterDialog } from "@/components/barrack/character-dialog";
import { fmtN } from "@/lib/barrack/time";
import { CLASSES } from "@/lib/barrack/constants";
import { cn } from "@/lib/utils";

const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

export default function CharactersPage() {
  const characters = useBarrackStore((s) => s.characters);
  const accounts = useBarrackStore((s) => s.accounts);
  const db = useBarrackStore((s) => s.dbSettings);
  const toggleHidden = useBarrackStore((s) => s.toggleCharHidden);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [q, setQ] = useState("");
  const [fAcc, setFAcc] = useState("");
  const [fClass, setFClass] = useState("");
  const [showHidden, setShowHidden] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const accMap = useMemo(
    () => Object.fromEntries(accounts.map((a) => [a.id, a])),
    [accounts]
  );

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    return characters.filter((c) => {
      if (!showHidden && c.hidden) return false;
      if (fAcc && c.accountId !== fAcc) return false;
      if (fClass && c.classId !== fClass) return false;
      if (ql) {
        const hay = `${c.name} ${c.server} ${c.race}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
  }, [characters, q, fAcc, fClass, showHidden]);

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">👤 캐릭터</h1>
          <p className="text-xs text-muted-foreground mt-1">전체 캐릭터 목록 및 관리</p>
        </div>
        <Button onClick={() => { setEditId(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4" /> 캐릭터 추가
        </Button>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Input className="w-[200px] h-8" placeholder="이름·서버·종족 검색" value={q} onChange={(e) => setQ(e.target.value)} />
        <Select value={fAcc || "_all"} onValueChange={(v) => setFAcc(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 계정</SelectItem>
            {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={fClass || "_all"} onValueChange={(v) => setFClass(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[140px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체 직업</SelectItem>
            {CLASSES.map((c) => <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} />
          숨김 표시
        </label>
        <span className="ml-auto text-muted-foreground">{filtered.length} / {characters.length}</span>
      </div>

      <div className="rounded-lg border bg-card overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-muted/40">
            <tr>
              <th className="text-left px-3 py-2">계정</th>
              <th className="text-left px-3 py-2">캐릭터</th>
              <th className="text-left px-3 py-2">직업</th>
              <th className="text-left px-3 py-2">서버</th>
              <th className="text-right px-3 py-2">Lv</th>
              <th className="text-right px-3 py-2">전투력</th>
              <th className="text-right px-3 py-2">아이템 Lv</th>
              <th className="text-right px-3 py-2">오드</th>
              <th className="px-3 py-2">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={9} className="text-center text-muted-foreground py-6">캐릭터 없음</td></tr>
            ) : filtered.map((c) => {
              const cls = CLASS_MAP[c.classId];
              const acc = accMap[c.accountId];
              return (
                <tr key={c.id} className={cn("border-t", c.hidden && "opacity-50")}>
                  <td className="px-3 py-2">{acc?.name ?? "-"}</td>
                  <td className="px-3 py-2 font-semibold" style={{ color: cls?.color }}>
                    {c.name}
                  </td>
                  <td className="px-3 py-2">{cls?.icon} {cls?.name}</td>
                  <td className="px-3 py-2 text-muted-foreground">{c.server || "-"}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{c.level}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtN(c.cp)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtN(c.itemLevel)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{fmtN(c.od)}/{fmtN(computeOdMax(c, accounts, db))}</td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="xs" onClick={() => { setEditId(c.id); setDialogOpen(true); }}>
                        <Pencil className="h-3 w-3" /> 수정
                      </Button>
                      <Button variant="ghost" size="xs" onClick={() => toggleHidden(c.id)}>
                        {c.hidden ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <CharacterDialog open={dialogOpen} charId={editId} onClose={() => setDialogOpen(false)} />
    </div>
  );
}
