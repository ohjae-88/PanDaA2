"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBarrackStore } from "@/lib/barrack/store";
import { CLASSES } from "@/lib/barrack/constants";
import { cn } from "@/lib/utils";

type Props = { open: boolean; onClose: () => void };

const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

export function CorridorBulkDialog({ open, onClose }: Props) {
  const characters = useBarrackStore((s) => s.characters);
  const accounts = useBarrackStore((s) => s.accounts);
  const applyBulk = useBarrackStore((s) => s.applyCorridorBulk);

  const [race, setRace] = useState<string>("");
  const [server, setServer] = useState<string>("");
  const [lower, setLower] = useState(0);
  const [middle, setMiddle] = useState(0);

  useEffect(() => {
    if (!open) return;
    setRace("");
    setServer("");
    setLower(0);
    setMiddle(0);
  }, [open]);

  // 종족별 서버 옵션
  const serverOptions = useMemo(() => {
    const set = new Set<string>();
    characters.forEach((c) => {
      if (race && c.race !== race) return;
      if (c.server) set.add(c.server);
    });
    return [...set].sort((a, b) => a.localeCompare(b, "ko"));
  }, [characters, race]);

  // 적용 대상
  const targets = useMemo(
    () =>
      characters.filter(
        (c) => (!race || c.race === race) && (!server || c.server === server)
      ),
    [characters, race, server]
  );
  const accMap = useMemo(() => Object.fromEntries(accounts.map((a) => [a.id, a])), [accounts]);

  function clamp(n: number) {
    return Math.max(0, Math.min(3, n | 0));
  }

  async function handleApply() {
    if (!targets.length) {
      toast.warning("조건에 맞는 캐릭터가 없습니다.");
      return;
    }
    if (!(await confirmDialog({ title: "회랑 일괄 적용", description: `${targets.length}명에게 회랑(하층:${lower} / 중층:${middle})을 일괄 적용합니다.`, confirmText: "적용" }))) return;
    applyBulk(targets.map((t) => t.id), lower, middle);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>🏛 회랑 결과 입력 (일괄 설정)</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground -mt-2">
          선택한 종족·서버의 캐릭터에 회랑 단계(하층/중층 0~3)를 일괄 적용합니다.
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">종족 (필터)</Label>
            <Select value={race || "_all"} onValueChange={(v) => setRace(v === "_all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                <SelectItem value="천족">천족</SelectItem>
                <SelectItem value="마족">마족</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">서버 (필터)</Label>
            <Select value={server || "_all"} onValueChange={(v) => setServer(v === "_all" ? "" : v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_all">전체</SelectItem>
                {serverOptions.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 pt-2 border-t">
          <StageSelect label="하층 (단계)" value={lower} onChange={(v) => setLower(clamp(v))} />
          <StageSelect label="중층 (단계)" value={middle} onChange={(v) => setMiddle(clamp(v))} />
        </div>

        <div className="rounded-lg border bg-card/40 p-3">
          <div className="text-xs font-bold mb-1.5">
            적용 대상 <span className="text-gold-light tabular-nums">{targets.length}</span>명
          </div>
          {targets.length === 0 ? (
            <div className="text-xs text-muted-foreground italic">조건에 맞는 캐릭터가 없습니다.</div>
          ) : (
            <div className="max-h-[180px] overflow-auto flex flex-col gap-0.5 text-xs">
              {targets.map((c) => {
                const cls = CLASS_MAP[c.classId];
                const acc = accMap[c.accountId];
                return (
                  <div key={c.id} className="flex items-center gap-2">
                    <span className="text-base">{cls?.icon}</span>
                    <span className="font-bold" style={{ color: cls?.color }}>{c.name}</span>
                    <span className="text-muted-foreground text-[11px]">
                      {acc?.name} · {c.race} · {c.server || "-"}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleApply}>적용</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function StageSelect({ label, value, onChange }: { label: string; value: number; onChange: (n: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      <div className="flex gap-1">
        {[0, 1, 2, 3].map((n) => (
          <button
            key={n}
            onClick={() => onChange(n)}
            className={cn(
              "flex-1 py-2 rounded border text-sm font-bold transition-colors",
              n === value
                ? "bg-gold/20 border-gold/50 text-gold-light"
                : "bg-card border-border text-muted-foreground hover:bg-accent/10"
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </div>
  );
}
