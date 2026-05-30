"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { useNotifierStore } from "@/lib/notifier/store";
import { newNotifierId } from "@/lib/notifier/id";
import type { NotifierItem, SpecificTime } from "@/lib/notifier/types";
import { toast } from "@/lib/util/toast";

type Props = {
  open: boolean;
  itemId: string | null;
  onClose: () => void;
};

const EMPTY: NotifierItem = {
  id: "",
  type: "",
  tier: 1,
  name: "",
  area: "",
  cycleType: "cooldown",
  cycleMinutes: 60,
  specificTimes: [],
  lastSpawnTs: null,
  notifyEnabled: false,
  notifyBeforeMin: 5,
};

const DAY_LABELS = ["일", "월", "화", "수", "목", "금", "토"];

export function NotifierEditDialog({ open, itemId, onClose }: Props) {
  const items = useNotifierStore((s) => s.items);
  const upsert = useNotifierStore((s) => s.upsertItem);

  const editing = itemId ? items.find((x) => x.id === itemId) : null;
  const [draft, setDraft] = useState<NotifierItem>(EMPTY);

  useEffect(() => {
    if (open) setDraft(editing ? { ...editing, specificTimes: [...editing.specificTimes] } : EMPTY);
  }, [open, editing]);

  function patch<K extends keyof NotifierItem>(k: K, v: NotifierItem[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function setSpecific(i: number, patchFn: (t: SpecificTime) => SpecificTime) {
    setDraft((d) => ({
      ...d,
      specificTimes: d.specificTimes.map((t, idx) => (idx === i ? patchFn(t) : t)),
    }));
  }

  function addSpecific() {
    setDraft((d) => ({ ...d, specificTimes: [...d.specificTimes, { day: -1, hour: 21, minute: 0 }] }));
  }
  function removeSpecific(i: number) {
    setDraft((d) => ({ ...d, specificTimes: d.specificTimes.filter((_, idx) => idx !== i) }));
  }

  function handleSave() {
    if (!draft.name.trim()) {
      toast.error("보스명을 입력하세요.");
      return;
    }
    const ocrName = draft.ocrName?.trim();
    const final: NotifierItem = {
      ...draft,
      name: draft.name.trim(),
      ocrName: ocrName ? ocrName : undefined,
      type: draft.type.trim(),
      area: draft.area.trim(),
      tier: Number(draft.tier) || 1,
      cycleMinutes: Number(draft.cycleMinutes) || 60,
      notifyBeforeMin: Math.max(0, Number(draft.notifyBeforeMin) || 0),
      id: draft.id || newNotifierId(),
    };
    upsert(final);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{itemId ? "✎ 알리미 항목 편집" : "＋ 알리미 항목 추가"}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">구분</Label>
            <Input value={draft.type} onChange={(e) => patch("type", e.target.value)} placeholder="천족, 어비스 등" />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">티어</Label>
            <Input type="number" min={1} max={5} value={draft.tier} onChange={(e) => patch("tier", Number(e.target.value) || 1)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">보스명</Label>
            <Input value={draft.name} onChange={(e) => patch("name", e.target.value)} />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">OCR 매칭 이름 (화면 동기화용 · 비우면 보스명 사용)</Label>
            <Input
              value={draft.ocrName ?? ""}
              onChange={(e) => patch("ocrName", e.target.value)}
              placeholder={draft.name || "게임 화면 표기명"}
            />
          </div>
          <div className="space-y-1 col-span-2">
            <Label className="text-xs text-muted-foreground">지역</Label>
            <Input value={draft.area} onChange={(e) => patch("area", e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">젠주기 방식</Label>
            <Select value={draft.cycleType} onValueChange={(v) => patch("cycleType", v as NotifierItem["cycleType"])}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="cooldown">젠쿨타임</SelectItem>
                <SelectItem value="specific">특정시간</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {draft.cycleType === "cooldown" && (
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">쿨타임(분)</Label>
              <Input type="number" min={1} value={draft.cycleMinutes} onChange={(e) => patch("cycleMinutes", Number(e.target.value) || 1)} />
            </div>
          )}
        </div>

        {draft.cycleType === "specific" && (
          <div className="space-y-2 border-t pt-3">
            <div className="text-xs font-bold text-muted-foreground">특정 시간 목록 (요일 + 시각)</div>
            {draft.specificTimes.length === 0 && (
              <div className="text-xs text-muted-foreground italic py-1">시간이 없습니다. 아래 버튼으로 추가하세요.</div>
            )}
            {draft.specificTimes.map((t, i) => {
              const hourly = t.day === -2;
              return (
                <div key={i} className="flex items-center gap-2 text-sm">
                  <Select
                    value={String(t.day)}
                    onValueChange={(v) => {
                      const nv = Number(v);
                      setSpecific(i, (cur) => ({ ...cur, day: nv, hour: nv === -2 ? 0 : cur.hour }));
                    }}
                  >
                    <SelectTrigger className="w-[110px]"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="-1">매일</SelectItem>
                      <SelectItem value="-2">매시간</SelectItem>
                      {DAY_LABELS.map((d, j) => <SelectItem key={j} value={String(j)}>{d}요일</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {hourly ? (
                    <span className="text-xs text-muted-foreground">매 시</span>
                  ) : (
                    <>
                      <Input type="number" min={0} max={23} className="w-[60px] text-center" value={t.hour}
                        onChange={(e) => setSpecific(i, (cur) => ({ ...cur, hour: Number(e.target.value) || 0 }))} />
                      <span>:</span>
                    </>
                  )}
                  <Input type="number" min={0} max={59} className="w-[60px] text-center" value={t.minute}
                    onChange={(e) => setSpecific(i, (cur) => ({ ...cur, minute: Number(e.target.value) || 0 }))} />
                  <span className="text-xs text-muted-foreground">분</span>
                  <Button variant="ghost" size="xs" onClick={() => removeSpecific(i)} aria-label="삭제">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              );
            })}
            <Button variant="ghost" size="sm" onClick={addSpecific}>＋ 시간 추가</Button>
          </div>
        )}

        <div className="flex items-center gap-3 border-t pt-3 text-sm">
          <label className="flex items-center gap-2 cursor-pointer">
            <Checkbox checked={draft.notifyEnabled} onCheckedChange={(v) => patch("notifyEnabled", !!v)} />
            <span>알림 활성</span>
          </label>
          <span className="text-muted-foreground">·</span>
          <Label className="text-xs">알림 시점</Label>
          <Input type="number" min={0} className="w-[64px] text-center" value={draft.notifyBeforeMin}
            onChange={(e) => patch("notifyBeforeMin", Number(e.target.value) || 0)} />
          <span className="text-xs text-muted-foreground">분 전</span>
        </div>

        <DialogFooter>
          <Button onClick={handleSave}>{itemId ? "저장" : "추가"}</Button>
          <Button variant="ghost" onClick={onClose}>취소</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
