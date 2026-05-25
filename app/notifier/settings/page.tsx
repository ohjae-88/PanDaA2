"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Bell, Plus, Pencil, Trash2 } from "lucide-react";
import { useNotifierStore } from "@/lib/notifier/store";
import { Button } from "@/components/ui/button";
import { playAlarm, ALARM_SOUNDS } from "@/lib/notifier/alarm";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { GroupEditDialog } from "@/components/notifier/group-edit-dialog";
import { TimeSyncCard } from "@/components/notifier/time-sync-card";
import { WeeklyResetCard } from "@/components/notifier/weekly-reset-card";
import { confirmDialog } from "@/lib/util/confirm";
import { NotifierEditDialog } from "@/components/notifier/edit-dialog";
import { cn } from "@/lib/utils";

export default function NotifierSettingsPage() {
  const settings = useNotifierStore((s) => s.settings);
  const updateSettings = useNotifierStore((s) => s.updateSettings);
  const items = useNotifierStore((s) => s.items);
  const groupDefs = useNotifierStore((s) => s.groupDefs ?? []);
  const removeGroup = useNotifierStore((s) => s.removeGroup);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [editGroupOpen, setEditGroupOpen] = useState(false);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [timeEditItemId, setTimeEditItemId] = useState<string | null>(null);

  function openGroupAdd() { setEditGroupId(null); setEditGroupOpen(true); }
  function openGroupEdit(id: string) { setEditGroupId(id); setEditGroupOpen(true); }

  async function handleGroupDelete(id: string, name: string) {
    if (!(await confirmDialog({ title: "그룹 삭제", description: `그룹 '${name}'을(를) 삭제하시겠습니까?\n(소속 항목은 보존)`, confirmText: "삭제", variant: "destructive" }))) return;
    removeGroup(id);
  }

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/notifier" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> 알리미
        </Link>
        <h1 className="text-2xl font-extrabold">⏰ 알리미 설정</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <TimeSyncCard />
        <WeeklyResetCard onOpenTimeEdit={(id) => setTimeEditItemId(id)} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 기본 합산 알림 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bell className="h-4 w-4 text-cat-notifier" /> 기본 합산 알림
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              여러 항목의 잔여 시간이 임계 분 이내일 때 <b>하나의 알림 창</b>으로 합쳐 알립니다.
              알림 폭주를 막고 한 눈에 임박 항목을 확인할 수 있습니다.
            </p>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <Switch
                checked={settings.combineEnabled ?? false}
                onCheckedChange={(v) => updateSettings({ combineEnabled: v })}
              />
              <span className="text-sm font-semibold">기본 합산 알림 사용</span>
            </label>
            <div className={cn("flex items-center gap-3", !settings.combineEnabled && "opacity-50")}>
              <Label className="text-xs text-muted-foreground w-24">합산 임계</Label>
              <Input
                type="number"
                min={0}
                className="w-24"
                value={settings.combineThresholdMin ?? 5}
                onChange={(e) => updateSettings({ combineThresholdMin: Math.max(0, Number(e.target.value) || 0) })}
                disabled={!settings.combineEnabled}
              />
              <span className="text-xs text-muted-foreground">분 이내</span>
            </div>
            <div className="text-[11px] text-muted-foreground italic pt-2 border-t">
              예: 5분 설정 시 — 잔여 5분 이내 항목이 2개 이상이면 합산 모달로 함께 표시.
            </div>
          </CardContent>
        </Card>

        {/* 직전 알림 — 기존 일괄 편집에도 있지만 여기서도 조정 가능 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">⏰ 직전 알림</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              알림이 켜진 모든 항목에 대해 등장 직전에 추가 알림을 보냅니다 (기존 분 전 알림과 별도).
            </p>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <Switch
                checked={settings.notifyAtZero ?? false}
                onCheckedChange={(v) => updateSettings({ notifyAtZero: v })}
              />
              <span className="text-sm font-semibold">직전 알림 사용</span>
            </label>
            <div className={cn("flex items-center gap-3", !settings.notifyAtZero && "opacity-50")}>
              <Label className="text-xs text-muted-foreground w-24">알림 시점</Label>
              <Input
                type="number"
                min={0}
                className="w-24"
                value={settings.notifyAtZeroSec ?? 0}
                onChange={(e) => updateSettings({ notifyAtZeroSec: Math.max(0, Number(e.target.value) || 0) })}
                disabled={!settings.notifyAtZero}
              />
              <span className="text-xs text-muted-foreground">초 전</span>
            </div>
          </CardContent>
        </Card>

        {/* 알림음 + 카드 강조 */}
        <Card>
          <CardHeader>
            <CardTitle>🔔 알림음 / 카드 강조</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              알람 발생 시 비프음 + 오버레이 카드에 노란 강조 펄스. 메인/오버레이 공통 설정.
            </p>
            <label className="flex items-center gap-3 py-2 cursor-pointer">
              <Switch
                checked={settings.soundEnabled !== false}
                onCheckedChange={(v) => updateSettings({ soundEnabled: v })}
              />
              <span className="text-sm font-semibold">알림음 사용</span>
            </label>
            <div className={cn("flex items-center gap-3", settings.soundEnabled === false && "opacity-50")}>
              <Label className="text-xs text-muted-foreground w-24">알림음</Label>
              <select
                value={settings.alarmSoundId ?? "beep"}
                onChange={(e) => updateSettings({ alarmSoundId: e.target.value })}
                disabled={settings.soundEnabled === false}
                className="flex-1 px-2 py-1 rounded border border-border bg-background text-sm"
              >
                {ALARM_SOUNDS.map((s) => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => playAlarm(settings.soundVolume ?? 0.6, settings.alarmSoundId ?? "beep")}
                disabled={settings.soundEnabled === false}
                className="border border-border"
                title="현재 선택된 알림음 미리듣기"
              >
                ▶ 미리듣기
              </Button>
            </div>
            <div className={cn("flex items-center gap-3", settings.soundEnabled === false && "opacity-50")}>
              <Label className="text-xs text-muted-foreground w-24">볼륨</Label>
              <input
                type="range"
                min={0} max={1} step={0.01}
                value={settings.soundVolume ?? 0.6}
                onChange={(e) => updateSettings({ soundVolume: Number(e.target.value) })}
                disabled={settings.soundEnabled === false}
                className="flex-1"
                style={{ accentColor: "#fbbf24" }}
              />
              <span className="text-xs tabular-nums w-10 text-right">
                {Math.round((settings.soundVolume ?? 0.6) * 100)}%
              </span>
            </div>
            <div className="flex items-center gap-3">
              <Label className="text-xs text-muted-foreground w-24">강조 지속</Label>
              <Input
                type="number"
                min={0}
                max={300}
                className="w-24"
                value={settings.alarmHighlightSec ?? 15}
                onChange={(e) => updateSettings({ alarmHighlightSec: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })}
              />
              <span className="text-xs text-muted-foreground">초 (0이면 강조 안 함)</span>
            </div>
          </CardContent>
        </Card>

        {/* 그룹 알림 — 그룹 정의 + 편집 */}
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>👥 그룹 알림</CardTitle>
            <Button size="sm" onClick={openGroupAdd}>
              <Plus className="h-4 w-4" /> 그룹 추가
            </Button>
          </CardHeader>
          <CardContent>
            <p className="text-xs text-muted-foreground mb-3">
              여러 항목을 그룹으로 묶고, 그룹 알림 시점에 그룹 내 <b>모든 항목의 잔여 시간을 하나의 알림</b>으로 받습니다.
              항목은 여러 그룹에 동시 소속 가능하며, 그룹 내 개별 알림 ON/OFF도 그룹 편집에서 설정할 수 있습니다.
            </p>
            {groupDefs.length === 0 ? (
              <div className="text-xs text-muted-foreground italic py-6 text-center border rounded">
                등록된 그룹이 없습니다. <b>＋ 그룹 추가</b> 버튼으로 생성하세요.
              </div>
            ) : (
              <div className="space-y-1.5">
                {groupDefs.map((g) => {
                  const count = items.filter((it) => it.groups?.includes(g.id)).length;
                  return (
                    <div
                      key={g.id}
                      className={cn(
                        "flex items-center gap-2 px-3 py-2 rounded border bg-card/40",
                        g.enabled && "border-cat-notifier/40 bg-cat-notifier/5"
                      )}
                    >
                      <Bell className={cn("h-3.5 w-3.5", g.enabled ? "text-cat-notifier" : "text-muted-foreground opacity-50")} />
                      <div className="flex-1 min-w-0">
                        <div className="font-bold text-sm truncate">{g.name}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {g.enabled ? `${g.beforeMin}분 전 합산 알림` : "알림 꺼짐"} · {count}개 항목
                        </div>
                      </div>
                      <Button variant="ghost" size="xs" onClick={() => openGroupEdit(g.id)}>
                        <Pencil className="h-3 w-3" /> 편집
                      </Button>
                      <Button variant="ghost" size="xs" onClick={() => handleGroupDelete(g.id, g.name)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <GroupEditDialog open={editGroupOpen} groupId={editGroupId} onClose={() => setEditGroupOpen(false)} />
      <NotifierEditDialog open={!!timeEditItemId} itemId={timeEditItemId} onClose={() => setTimeEditItemId(null)} />
    </div>
  );
}
