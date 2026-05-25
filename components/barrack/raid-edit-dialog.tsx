"use client";

import { useEffect, useState } from "react";
import { Sword } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useBarrackStore } from "@/lib/barrack/store";
import type { Character } from "@/lib/barrack/types";

type RaidKey = "expedition" | "transcend" | "sanctuary_ludra" | "sanctuary_bagot";

const TITLES: Record<RaidKey, string> = {
  expedition: "원정",
  transcend: "초월",
  sanctuary_ludra: "성역 루드라",
  sanctuary_bagot: "성역 바고트",
};

function isSanctuary(k: RaidKey) {
  return k === "sanctuary_ludra" || k === "sanctuary_bagot";
}

export type RaidEditSection = "accumulated" | "reward" | "boss" | "all";

type Props = {
  open: boolean;
  charId: string | null;
  raidKey: RaidKey;
  /** 표시할 섹션 — 누적/보상/보스 단일 또는 'all' (기본). 단일 지정 시 해당 섹션만 노출. */
  section?: RaidEditSection;
  onClose: () => void;
};

export function RaidEditDialog({ open, charId, raidKey, section = "all", onClose }: Props) {
  const characters = useBarrackStore((s) => s.characters);
  const patch = useBarrackStore((s) => s.patchCharacter);
  const accounts = useBarrackStore((s) => s.accounts);
  const db = useBarrackStore((s) => s.dbSettings);
  const setRewardTotal = useBarrackStore((s) => s.setRewardTotal);
  const char = charId ? characters.find((c) => c.id === charId) : null;

  // DB 기본 수량 — 보상/보스 max는 DB에서 가져옴 (사용자 편집 불가)
  const raidCfg = db[raidKey] as { rewardMax?: number; bossMax?: number } | undefined;
  const dbRewardMax = raidCfg?.rewardMax ?? 0;
  const dbBossMax = raidCfg?.bossMax ?? 0;

  // 누적 — expedition/transcend만 (서버 단위)
  const hasAccumulated = raidKey === "expedition" || raidKey === "transcend";
  const accumulatedField: "expRewardTotal" | "traRewardTotal" | null =
    raidKey === "expedition" ? "expRewardTotal" :
    raidKey === "transcend" ? "traRewardTotal" : null;
  const serverData = char && accumulatedField
    ? accounts.find((a) => a.id === char.accountId)?.servers?.[char.server || ""]
    : null;
  const currentAccumulated = serverData && accumulatedField
    ? ((serverData as Record<string, unknown>)[accumulatedField] as number | undefined) ?? 0
    : 0;

  // 입력 — 잔여 + 추가 수량 + 누적
  const [rewardCur, setRewardCur] = useState("0");
  const [rewardExtra, setRewardExtra] = useState("0");
  const [bossCur, setBossCur] = useState("0");
  const [bossExtra, setBossExtra] = useState("0");
  const [accumulated, setAccumulated] = useState("0");

  useEffect(() => {
    if (!open || !char) return;
    const r = char[raidKey];
    if (!r) return;
    setRewardCur(String(r.reward ?? 0));
    setRewardExtra(String(r.rewardExtra ?? 0));
    setBossCur(String(r.boss ?? 0));
    setBossExtra(String(r.bossExtra ?? 0));
    setAccumulated(String(currentAccumulated));
  }, [open, char, raidKey, currentAccumulated]);

  if (!char) return null;
  const bossLabel = isSanctuary(raidKey) ? "입장권" : "보스";

  function save() {
    if (!char) return;
    const r = char[raidKey];
    if (!r) return;
    const num = (s: string) => Math.max(0, Math.floor(Number(s) || 0));
    // section별 부분 패치 — section='all' 또는 해당 섹션일 때만 필드 갱신
    const next = {
      ...r,
      rewardBase: dbRewardMax,
      bossBase: dbBossMax,
    };
    if (section === "all" || section === "reward") {
      next.reward = Math.min(dbRewardMax, num(rewardCur));
      next.rewardExtra = num(rewardExtra);
    }
    if (section === "all" || section === "boss") {
      next.boss = Math.min(dbBossMax, num(bossCur));
      next.bossExtra = num(bossExtra);
    }
    patch(char.id, { [raidKey]: next } as Partial<Character>);
    // 누적 갱신 — expedition/transcend + section이 accumulated/all일 때만
    if (hasAccumulated && accumulatedField && (section === "all" || section === "accumulated")) {
      const acc = num(accumulated);
      const type = raidKey === "expedition" ? "expedition" as const : "transcend" as const;
      setRewardTotal(char.accountId, char.server || "", type, acc);
    }
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-[280px] p-3 gap-2">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-1.5 text-sm">
            <Sword className="h-3.5 w-3.5" /> {TITLES[raidKey]} 잔여 수정
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {/* 캐릭터명 카드 */}
          <div className="rounded border bg-cat-barrack/10 border-cat-barrack/40 px-2 py-1">
            <div className="text-[9px] text-muted-foreground">캐릭터</div>
            <div className="font-extrabold text-sm text-cat-barrack truncate">{char.name}</div>
          </div>
          {hasAccumulated && (section === "all" || section === "accumulated") && (
            <div className="rounded border bg-card/40 p-2 space-y-1.5">
              <div className="text-[11px] font-extrabold text-muted-foreground">📈 누적 (서버 단위)</div>
              <Row label="누적 횟수" value={accumulated} setValue={setAccumulated} />
            </div>
          )}
          {(section === "all" || section === "reward") && (
            <div className="rounded border bg-card/40 p-2 space-y-1.5">
              <div className="text-[11px] font-extrabold text-muted-foreground">🎁 보상</div>
              <Row label="잔여" value={rewardCur} setValue={setRewardCur} max={dbRewardMax} />
              <Row label="추가 수량" value={rewardExtra} setValue={setRewardExtra} />
            </div>
          )}
          {(section === "all" || section === "boss") && (
            <div className="rounded border bg-card/40 p-2 space-y-1.5">
              <div className="text-[11px] font-extrabold text-muted-foreground">
                {isSanctuary(raidKey) ? "🎫" : "💀"} {bossLabel}
              </div>
              <Row label="잔여" value={bossCur} setValue={setBossCur} max={dbBossMax} />
              <Row label="추가 수량" value={bossExtra} setValue={setBossExtra} />
            </div>
          )}
        </div>
        <div className="flex gap-2 pt-1">
          <Button size="sm" onClick={save} className="flex-[7] h-8">저장</Button>
          <Button size="sm" variant="ghost" onClick={onClose} className="flex-[3] h-8 border">취소</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, setValue, max }: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  max?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <Label className="text-[11px] w-16 text-muted-foreground flex-shrink-0">{label}</Label>
      <Input
        type="number"
        min={0}
        max={max}
        className="flex-1 h-8 text-right tabular-nums text-sm"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </div>
  );
}
