"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Calendar, Clock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useNotifierStore } from "@/lib/notifier/store";
import { serverNow } from "@/lib/notifier/time-sync";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

/** 알리미 DB 항목 이름 — 특정시간 편집 대상 (어비스 4종) */
const SPECIFIC_ITEM_NAMES = [
  { key: "artifact",  label: "어비스 — 아티팩트",                  match: "아티팩트" },
  { key: "executor",  label: "집행자 — 아그로 / 타마사 / 카이라",    match: "집행자 아그로,타마사,카이라" },
  { key: "midboss",   label: "마라카 / 드라모스 / 듀칼",            match: "마라카, 드라모스, 듀칼" },
  { key: "nakhma",    label: "수호신장 나흐마",                    match: "수호신장 나흐마" },
];

type Props = {
  onOpenTimeEdit: (itemId: string) => void;
};

export function WeeklyResetCard({ onOpenTimeEdit }: Props) {
  const items = useNotifierStore((s) => s.items);
  const setLastSpawnTs = useNotifierStore((s) => s.setLastSpawnTs);
  const [resetTs, setResetTs] = useState<string>("");
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => { setHydrated(true); }, []);
  useEffect(() => {
    if (!hydrated) return;
    // 기본값 — 현재 시각 (KST 형식 YYYY-MM-DDTHH:mm)
    const d = new Date(serverNow() + 9 * 3600 * 1000);
    const pad = (n: number) => String(n).padStart(2, "0");
    const local = `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
    setResetTs(local);
  }, [hydrated]);

  // 특정시간 편집 대상 항목 매칭
  const specificItems = SPECIFIC_ITEM_NAMES.map((s) => {
    const it = items.find((x) => x.name === s.match);
    return { ...s, item: it };
  });

  async function handleServerReset() {
    if (!resetTs) {
      toast.error("서버 점검 완료 시간을 입력하세요.");
      return;
    }
    // input value는 KST 로컬 시간 (YYYY-MM-DDTHH:mm) — UTC ms로 변환
    const m = resetTs.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/);
    if (!m) { toast.error("시간 형식이 올바르지 않습니다."); return; }
    const [, y, mo, da, h, mi] = m;
    // KST = UTC+9 → UTC ms = Date.UTC(y,m-1,d,h-9,mi)
    const utcMs = Date.UTC(Number(y), Number(mo) - 1, Number(da), Number(h) - 9, Number(mi), 0);
    const cooldownItems = items.filter((it) => it.cycleType === "cooldown");
    if (!cooldownItems.length) {
      toast.warning("쿨타임 보스가 없습니다.");
      return;
    }
    if (!(await confirmDialog({ title: "쿨타임 보스 일괄 처리", description: `서버 점검 완료 시간을 기준으로 쿨타임 보스 ${cooldownItems.length}개를 모두 잡음 처리합니다.`, confirmText: "처리" }))) return;
    cooldownItems.forEach((it) => {
      setLastSpawnTs(it.id, utcMs);
    });
    toast.success(`${cooldownItems.length}개 항목 처리 완료`);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RotateCcw className="h-4 w-4 text-cat-notifier" /> 주간 초기화
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 서버 Reset */}
        <div className="space-y-2">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <Calendar className="h-3 w-3" /> 서버 Reset
          </Label>
          <p className="text-[11px] text-muted-foreground italic">
            점검 완료 시간 입력 → 쿨타임 보스(어비스 카이라, 보스 항목 등) 전체 잡음 처리.
            입력 시각 기준으로 쿨타임 재시작.
          </p>
          <div className="flex items-center gap-2">
            <Input
              type="datetime-local"
              value={resetTs}
              onChange={(e) => setResetTs(e.target.value)}
              className="flex-1 max-w-[220px]"
              suppressHydrationWarning
            />
            <Button size="sm" onClick={handleServerReset}>
              <RotateCcw className="h-3.5 w-3.5" /> 서버 Reset
            </Button>
          </div>
        </div>

        {/* 특정시간 — 어비스 보스 4종 */}
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs font-semibold flex items-center gap-1">
            <Clock className="h-3 w-3" /> 특정 시간 입력
          </Label>
          <p className="text-[11px] text-muted-foreground italic">
            요일·시각 기반 항목의 등장 시간 편집. 각 버튼 클릭으로 입력창 열림.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {specificItems.map((s) => (
              <Button
                key={s.key}
                size="sm"
                variant="ghost"
                disabled={!s.item}
                onClick={() => s.item && onOpenTimeEdit(s.item.id)}
                className="border border-cat-notifier/30 bg-cat-notifier/5 hover:bg-cat-notifier/15 justify-start text-left"
                title={s.item ? `${s.item.name} — 특정시간 편집` : "알리미 DB에 항목 없음"}
              >
                <Clock className="h-3 w-3 flex-shrink-0" />
                <span className="truncate">{s.label}</span>
                {s.item && (
                  <span className="ml-auto text-[10px] tabular-nums opacity-70">
                    {(s.item.specificTimes ?? []).length}개
                  </span>
                )}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
