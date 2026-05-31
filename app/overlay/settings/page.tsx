"use client";

import Link from "next/link";
import { ArrowLeft, Settings, Bell, Sword, Users, Sparkles, Info, Plus, ChevronDown, Pencil, Trash2 } from "lucide-react";
import {
  useOverlayStore,
  type ColorAlpha,
  type BorderStyle,
  type CardStyle,
  type Hms,
} from "@/lib/overlay/store";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { CollapsibleSection } from "@/components/ui/collapsible-section";
import { useEffect, useRef, useState } from "react";
import { useNotifierStore } from "@/lib/notifier/store";
import { useActiveAlarms, playAlarm, ALARM_SOUNDS } from "@/lib/notifier/alarm";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/util/confirm";

export default function OverlaySettingsPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/overlay"
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> 오버레이
        </Link>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Settings className="h-5 w-5 text-amber-400" /> ⚙ 오버레이 통합 설정
        </h1>
      </div>

      <p className="text-[11px] text-muted-foreground italic">
        모든 변경은 즉시 반영됩니다. 카테고리별 접기/펼치기로 정리하세요.
      </p>

      <CommonSection />
      <NotifierSection />
      <BarrackSection />
      <PartySection />
      <ArcanaSection />
    </div>
  );
}

/* ============================================================
   공통 설정
   ============================================================ */
function CommonSection() {
  // 단축키 — HotkeyEditor 내부에서 store 직접 구독
  const scale = useOverlayStore((s) => s.scale);
  const setScale = useOverlayStore((s) => s.setScale);
  const textScale = useOverlayStore((s) => s.textScale);
  const setTextScale = useOverlayStore((s) => s.setTextScale);
  const visual = useOverlayStore((s) => s.visual);
  const patchVisual = useOverlayStore((s) => s.patchVisual);

  return (
    <CollapsibleSection title="🌐 통합 (모든 오버레이 공통)" defaultOpen accent="text-amber-400">
      <div className="space-y-4">
        <CollapsibleSection title="축소 모드 — 배율" defaultOpen={false}>
          <p className="text-[11px] text-muted-foreground italic">
            상단 헤더는 영향받지 않음. 본문(알림 카드, 배럭 카드 등)만 비례 확대/축소. 확장 모드에는 적용 안 됨.
          </p>
          <div className="flex items-center gap-3">
            <Label className="text-xs w-28">전체 배율</Label>
            <input
              type="range" min={0.5} max={2.0} step={0.01}
              value={scale}
              onChange={(e) => setScale(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs tabular-nums w-12">{Math.round(scale * 100)}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground italic pl-32">
            윈도우 크기 + 본문 콘텐츠 함께 비례 확장. 스크롤 없음.
          </p>
          <div className="flex items-center gap-3">
            <Label className="text-xs w-28">텍스트 배율</Label>
            <input
              type="range" min={0.7} max={1.5} step={0.05}
              value={textScale}
              onChange={(e) => setTextScale(Number(e.target.value))}
              className="flex-1"
            />
            <span className="text-xs tabular-nums w-12">{Math.round(textScale * 100)}%</span>
          </div>
          <p className="text-[10px] text-muted-foreground italic pl-32">
            본문 텍스트만 추가로 비례 조정 (윈도우 크기 영향 없음).
          </p>
        </CollapsibleSection>

        <Section subtitle="오버레이 창">
          <BorderEditor
            label="창 테두리"
            value={visual.windowBorder}
            onChange={(v) => patchVisual({ windowBorder: v })}
          />
          <ColorAlphaEditor
            label="창 배경"
            value={visual.windowBg}
            onChange={(v) => patchVisual({ windowBg: v })}
          />
        </Section>

        <Section subtitle="상단 상태바">
          <ColorAlphaEditor
            label="상태바 배경"
            value={visual.header.bg}
            onChange={(bg) => patchVisual({ header: { ...visual.header, bg } })}
          />
          <ColorAlphaEditor
            label="버튼 색상"
            value={visual.header.buttonColor}
            onChange={(buttonColor) => patchVisual({ header: { ...visual.header, buttonColor } })}
          />
          <div className="flex items-center gap-3">
            <Label className="text-xs w-28">버튼 배율</Label>
            <input
              type="range"
              min={0.7} max={1.5} step={0.05}
              value={visual.header.buttonScale}
              onChange={(e) => patchVisual({ header: { ...visual.header, buttonScale: Number(e.target.value) } })}
              className="flex-1"
              style={{ accentColor: "#fbbf24" }}
            />
            <input
              type="number"
              min={70} max={150} step={5}
              value={Math.round(visual.header.buttonScale * 100)}
              onChange={(e) =>
                patchVisual({
                  header: {
                    ...visual.header,
                    buttonScale: Math.max(0.7, Math.min(1.5, (Number(e.target.value) || 100) / 100)),
                  },
                })
              }
              className="w-16 px-1 py-0.5 text-right tabular-nums rounded border bg-background text-xs"
            />
            <span className="text-xs text-muted-foreground">%</span>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            상태바 아이콘/패딩에 비례 적용. 70% ~ 150%
          </p>
        </Section>

        <CollapsibleSection title="단축키" defaultOpen={false}>
          <HotkeyEditor />
        </CollapsibleSection>
      </div>
    </CollapsibleSection>
  );
}

/* ============================================================
   알리미
   ============================================================ */
function NotifierSection() {
  const cfg = useOverlayStore((s) => s.notifier);
  const patch = useOverlayStore((s) => s.patchNotifier);
  const card = useOverlayStore((s) => s.visual.notifierCard);
  const patchVisual = useOverlayStore((s) => s.patchVisual);
  const notifierSettings = useNotifierStore((s) => s.settings);
  const updateNotifierSettings = useNotifierStore((s) => s.updateSettings);
  const upsertItem = useNotifierStore((s) => s.upsertItem);
  const removeItem = useNotifierStore((s) => s.removeItem);
  const [testRunning, setTestRunning] = useState(false);

  async function runTest() {
    if (testRunning) return;
    setTestRunning(true);
    const testId = `__alarm_test_${Date.now()}`;
    const now = Date.now();
    // cycleMinutes=1, lastSpawnTs = now - 57000 → nextSpawn = lastSpawnTs + 60000 = now + 3000
    // notifyBeforeMin=1 → threshold 60s, rem 3s < 60s → tick이 즉시 발화
    upsertItem({
      id: testId,
      type: "테스트",
      tier: 1,
      name: "🔔 알람 테스트",
      area: "테스트",
      cycleType: "cooldown",
      cycleMinutes: 1,
      specificTimes: [],
      lastSpawnTs: now - 57_000,
      notifyEnabled: true,
      notifyBeforeMin: 1,
      important: true,
    });
    // 약 3초 후 알람 발화. 6초 후 정리.
    window.setTimeout(() => {
      removeItem(testId);
      useActiveAlarms.getState().clear(testId);
      setTestRunning(false);
    }, 6_000);
  }

  const patchExpanded = (next: CardStyle) =>
    patchVisual({ notifierCard: { ...card, expanded: next } });
  const patchCollapsed = (next: CardStyle) =>
    patchVisual({ notifierCard: { ...card, collapsed: next } });

  return (
    <CollapsibleSection
      title={<><Bell className="inline h-3.5 w-3.5 mr-1 text-cat-notifier" /> 알리미 오버레이</>}
      accent="text-cat-notifier"
    >
      <div className="space-y-3">
        <Section subtitle="알람 (메인 설정과 공유)">
          <div className="flex items-center gap-3">
            <Switch
              checked={notifierSettings.soundEnabled !== false}
              onCheckedChange={(v) => updateNotifierSettings({ soundEnabled: v })}
            />
            <span className="text-sm font-semibold">알림음 사용</span>
            <Button
              size="xs"
              variant="ghost"
              onClick={runTest}
              disabled={testRunning}
              className="ml-auto border border-cat-notifier/40 bg-cat-notifier/10 text-cat-notifier hover:bg-cat-notifier/20"
              title="테스트 알림 항목을 잠시 추가하고 3초 뒤 알람을 발화 — 6초 뒤 자동 정리"
            >
              {testRunning ? "테스트 진행 중…" : "🔔 테스트"}
            </Button>
          </div>
          <div className={cn("flex items-center gap-2", notifierSettings.soundEnabled === false && "opacity-50")}>
            <Label className="text-xs w-20 text-muted-foreground">알림음</Label>
            <select
              value={notifierSettings.alarmSoundId ?? "beep"}
              onChange={(e) => updateNotifierSettings({ alarmSoundId: e.target.value })}
              disabled={notifierSettings.soundEnabled === false}
              className="flex-1 px-2 py-1 rounded border border-border bg-background text-xs"
            >
              {ALARM_SOUNDS.map((s) => (
                <option key={s.id} value={s.id}>{s.label}</option>
              ))}
            </select>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => playAlarm(notifierSettings.soundVolume ?? 0.6, notifierSettings.alarmSoundId ?? "beep")}
              disabled={notifierSettings.soundEnabled === false}
              className="border border-border"
              title="현재 선택된 알림음 미리듣기"
            >
              ▶ 미리듣기
            </Button>
          </div>
          <div className={cn("flex items-center gap-2", notifierSettings.soundEnabled === false && "opacity-50")}>
            <Label className="text-xs w-20 text-muted-foreground">볼륨</Label>
            <input
              type="range"
              min={0} max={1} step={0.01}
              value={notifierSettings.soundVolume ?? 0.6}
              onChange={(e) => updateNotifierSettings({ soundVolume: Number(e.target.value) })}
              disabled={notifierSettings.soundEnabled === false}
              className="flex-1"
              style={{ accentColor: "#a78bfa" }}
            />
            <span className="text-xs tabular-nums w-10 text-right">
              {Math.round((notifierSettings.soundVolume ?? 0.6) * 100)}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-20 text-muted-foreground">강조 지속</Label>
            <Input
              type="number"
              min={0} max={300}
              className="w-24"
              value={notifierSettings.alarmHighlightSec ?? 15}
              onChange={(e) => updateNotifierSettings({ alarmHighlightSec: Math.max(0, Math.min(300, Number(e.target.value) || 0)) })}
            />
            <span className="text-xs text-muted-foreground">초 (0이면 강조 안 함)</span>
          </div>
          <p className="text-[10px] text-muted-foreground italic">
            테스트 버튼: 알림 리스트에 임시 항목 추가 → 3초 뒤 알람 발화 → 6초 뒤 정리 (테스트 전 상태 복귀)
          </p>
        </Section>

        <Section subtitle="공통">
          <SwitchRow
            label="상단 서버 시계 (KST)"
            checked={cfg.showClock}
            onChange={(v) => patch({ showClock: v })}
          />
          {cfg.showClock && (
            <div className="pl-4 space-y-2 border-l-2 border-cat-notifier/30">
              <SwitchRow
                label="시계 중앙 정렬"
                checked={cfg.clock.centerAlign}
                onChange={(v) => patch({ clock: { ...cfg.clock, centerAlign: v } })}
                hint="끄면 우측 정렬"
              />
              <SwitchRow
                label="24시간제"
                checked={cfg.clock.hour24}
                onChange={(v) => patch({ clock: { ...cfg.clock, hour24: v } })}
                hint="끄면 12시간 + AM/PM"
              />
              <div className="flex items-center gap-2 text-xs">
                <Label className="w-24 text-muted-foreground">표시 형식</Label>
                <Input
                  type="text"
                  className="flex-1 max-w-[260px]"
                  value={cfg.clock.format}
                  onChange={(e) => patch({ clock: { ...cfg.clock, format: e.target.value } })}
                  placeholder="MM/DD (ddd) HH:mm:ss"
                />
              </div>
              <div className="flex flex-wrap gap-1">
                {[
                  { label: "기본", v: "MM/DD (ddd) HH:mm:ss" },
                  { label: "시간만", v: "HH:mm:ss" },
                  { label: "AM/PM", v: "hh:mm:ss A" },
                  { label: "연/월/일", v: "YYYY/MM/DD HH:mm" },
                  { label: "요일+시간", v: "(ddd) HH:mm" },
                ].map((p) => (
                  <button
                    key={p.label}
                    onClick={() => patch({ clock: { ...cfg.clock, format: p.v } })}
                    className="text-[10px] px-2 py-0.5 rounded border border-border hover:bg-accent/10"
                    title={p.v}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground italic">
                토큰: <b>YYYY YY MM DD ddd HH hh mm ss A a</b> (대소문자 구분)
              </p>
            </div>
          )}
          <SwitchRow
            label="알람 켜진 항목만"
            checked={cfg.onlyAlarmOn}
            onChange={(v) => patch({ onlyAlarmOn: v })}
          />
          <SwitchRow
            label="그룹 묶음 표시"
            checked={cfg.groupBundles}
            onChange={(v) => patch({ groupBundles: v })}
          />
          <HmsEditor
            label="강조 임계"
            value={cfg.highlightThreshold}
            onChange={(v) => patch({ highlightThreshold: v })}
            hint="이 시간 이하 잔여 항목 빨강 표시"
          />
          <HmsEditor
            label="초과 표시 시간"
            value={cfg.overdue.showDuration}
            onChange={(v) => patch({ overdue: { ...cfg.overdue, showDuration: v } })}
            hint="예정 시각이 지난 항목을 이 시간만큼 화면에 유지 (0이면 즉시 숨김)"
          />
          <div className="flex items-center gap-2 text-xs">
            <span className="w-24 text-muted-foreground">초과 강조 색상</span>
            <input
              type="color"
              value={cfg.overdue.color}
              onChange={(e) => patch({ overdue: { ...cfg.overdue, color: e.target.value } })}
              className="h-7 w-12 rounded border border-border bg-background cursor-pointer"
            />
            <input
              type="text"
              value={cfg.overdue.color}
              onChange={(e) => patch({ overdue: { ...cfg.overdue, color: e.target.value } })}
              className="w-24 px-2 py-1 rounded border border-border bg-background tabular-nums"
              placeholder="#420000"
            />
            <span className="text-muted-foreground italic">기본 #420000</span>
          </div>
        </Section>

        <CollapsibleSection title="확장 모드" defaultOpen={false}>
          <NumberRow
            label="최대 항목 수"
            value={cfg.expanded.maxItems}
            min={1} max={50}
            onChange={(v) => patch({ expanded: { ...cfg.expanded, maxItems: v } })}
          />
          <CardStyleEditor card={card.expanded} onChange={patchExpanded} />
        </CollapsibleSection>

        <CollapsibleSection title="축소 모드" defaultOpen={false}>
          <SwitchRow
            label="알리미 표시"
            checked={cfg.collapsed.enabled}
            onChange={(v) => patch({ collapsed: { ...cfg.collapsed, enabled: v } })}
          />
          <NumberRow
            label="최대 항목 수"
            value={cfg.collapsed.maxItems}
            min={1} max={20}
            onChange={(v) => patch({ collapsed: { ...cfg.collapsed, maxItems: v } })}
          />
          <SwitchRow
            label="+N개 더 카드 표시"
            checked={cfg.collapsed.showMoreCard}
            onChange={(v) => patch({ collapsed: { ...cfg.collapsed, showMoreCard: v } })}
            hint="초과 항목 안내 카드. 클릭 시 확장 모드로 전환."
          />
          <CardStyleEditor card={card.collapsed} onChange={patchCollapsed} />
        </CollapsibleSection>
      </div>
    </CollapsibleSection>
  );
}

/* ============================================================
   배럭
   ============================================================ */
function BarrackSection() {
  const cfg = useOverlayStore((s) => s.barrack);
  const patch = useOverlayStore((s) => s.patchBarrack);
  const card = useOverlayStore((s) => s.visual.barrackCard);
  const patchVisual = useOverlayStore((s) => s.patchVisual);

  const patchExpanded = (next: CardStyle) =>
    patchVisual({ barrackCard: { ...card, expanded: next } });
  const patchCollapsed = (next: CardStyle) =>
    patchVisual({ barrackCard: { ...card, collapsed: next } });

  return (
    <CollapsibleSection
      title={<><Sword className="inline h-3.5 w-3.5 mr-1 text-cat-barrack" /> 배럭 오버레이</>}
      accent="text-cat-barrack"
    >
      <div className="space-y-3">
        <CollapsibleSection title="확장 모드" defaultOpen={false}>
          <p className="text-[11px] text-muted-foreground italic">현재 추가 옵션 없음.</p>
          <CardStyleEditor card={card.expanded} onChange={patchExpanded} />
        </CollapsibleSection>

        <CollapsibleSection title="축소 모드" defaultOpen={false}>
          <SwitchRow
            label="배럭 표시"
            checked={cfg.collapsed.enabled}
            onChange={(v) => patch({ collapsed: { ...cfg.collapsed, enabled: v } })}
          />
          <NumberRow
            label="표시 캐릭터 수"
            value={cfg.collapsed.maxChars}
            min={1} max={10}
            onChange={(v) => patch({ collapsed: { ...cfg.collapsed, maxChars: v } })}
          />
          <SwitchRow
            label="최근 기록 카드 표시"
            checked={cfg.collapsed.showRecentLog ?? true}
            onChange={(v) => patch({ collapsed: { ...cfg.collapsed, showRecentLog: v } })}
          />
          <CardStyleEditor card={card.collapsed} onChange={patchCollapsed} />
        </CollapsibleSection>
      </div>
    </CollapsibleSection>
  );
}

/* ============================================================
   파티 / 아르카나 — 추후 구현 placeholder
   ============================================================ */
function PartySection() {
  return (
    <CollapsibleSection
      title={<><Users className="inline h-3.5 w-3.5 mr-1 text-cat-party" /> 파티 오버레이</>}
      accent="text-cat-party"
    >
      <p className="text-[11px] text-muted-foreground italic">추후 구현 예정.</p>
    </CollapsibleSection>
  );
}

function ArcanaSection() {
  return (
    <CollapsibleSection
      title={<><Sparkles className="inline h-3.5 w-3.5 mr-1 text-cat-arcana" /> 아르카나 오버레이</>}
      accent="text-cat-arcana"
    >
      <p className="text-[11px] text-muted-foreground italic">추후 구현 예정.</p>
    </CollapsibleSection>
  );
}

/* ============================================================
   재사용 컴포넌트
   ============================================================ */
function Section({ subtitle, children }: { subtitle: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <h4 className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">{subtitle}</h4>
      <div className="space-y-3 pl-2 border-l-2 border-border/30">{children}</div>
    </div>
  );
}

function SwitchRow({ label, checked, onChange, hint }: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  hint?: string;
}) {
  return (
    <div>
      <label className="flex items-center gap-3 cursor-pointer">
        <Switch checked={checked} onCheckedChange={onChange} />
        <span className="text-sm">{label}</span>
      </label>
      {hint && <p className="text-[10px] text-muted-foreground italic pl-12">{hint}</p>}
    </div>
  );
}

function NumberRow({ label, value, min, max, onChange }: {
  label: string; value: number; min: number; max: number; onChange: (v: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <Label className="text-xs w-28">{label}</Label>
      <Input
        type="number"
        min={min}
        max={max}
        className="w-24"
        value={value}
        onChange={(e) => onChange(Math.max(min, Math.min(max, Number(e.target.value) || min)))}
      />
    </div>
  );
}

function HmsEditor({ label, value, onChange, hint }: {
  label: string; value: Hms; onChange: (v: Hms) => void; hint?: string;
}) {
  return (
    <div>
      <div className="flex items-center gap-2">
        <Label className="text-xs w-28">{label}</Label>
        <Input
          type="number" min={0} max={99} className="w-16"
          value={value.h}
          onChange={(e) => onChange({ ...value, h: Math.max(0, Math.min(99, Number(e.target.value) || 0)) })}
        />
        <span className="text-xs text-muted-foreground">시</span>
        <Input
          type="number" min={0} max={59} className="w-16"
          value={value.m}
          onChange={(e) => onChange({ ...value, m: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })}
        />
        <span className="text-xs text-muted-foreground">분</span>
        <Input
          type="number" min={0} max={59} className="w-16"
          value={value.s}
          onChange={(e) => onChange({ ...value, s: Math.max(0, Math.min(59, Number(e.target.value) || 0)) })}
        />
        <span className="text-xs text-muted-foreground">초</span>
      </div>
      {hint && <p className="text-[10px] text-muted-foreground italic pl-32 mt-1">{hint}</p>}
    </div>
  );
}

function ColorAlphaEditor({ label, value, onChange }: {
  label: string; value: ColorAlpha; onChange: (v: ColorAlpha) => void;
}) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <Label className="text-xs w-28">{label}</Label>
      <input
        type="color"
        value={value.color || "#0a0c12"}
        onChange={(e) => onChange({ ...value, color: e.target.value })}
        className="w-10 h-8 rounded border cursor-pointer"
      />
      <Input
        type="text"
        className="w-24"
        value={value.color}
        onChange={(e) => onChange({ ...value, color: e.target.value })}
        placeholder="#0a0c12"
      />
      <span className="text-[10px] text-muted-foreground">투명도</span>
      <input
        type="range"
        min={0} max={1} step={0.05}
        value={value.alpha}
        onChange={(e) => onChange({ ...value, alpha: Number(e.target.value) })}
        className="flex-1 min-w-[80px]"
      />
      <span className="text-xs tabular-nums w-12">{Math.round(value.alpha * 100)}%</span>
    </div>
  );
}

function CardStyleEditor({ card, onChange }: {
  card: CardStyle;
  onChange: (next: CardStyle) => void;
}) {
  return (
    <Section subtitle="카드 스타일">
      <BorderEditor
        label="카드 테두리"
        value={card.border}
        onChange={(v) => onChange({ ...card, border: v })}
      />
      <ColorAlphaEditor
        label="카드 배경"
        value={card.bg}
        onChange={(v) => onChange({ ...card, bg: v })}
      />
    </Section>
  );
}

function BorderEditor({ label, value, onChange }: {
  label: string; value: BorderStyle; onChange: (v: BorderStyle) => void;
}) {
  return (
    <div className="space-y-2">
      <ColorAlphaEditor
        label={label}
        value={{ color: value.color, alpha: value.alpha }}
        onChange={(v) => onChange({ ...value, ...v })}
      />
      <div className="flex items-center gap-2 pl-32">
        <span className="text-[10px] text-muted-foreground">두께</span>
        <input
          type="range" min={0} max={6} step={1}
          value={value.width}
          onChange={(e) => onChange({ ...value, width: Number(e.target.value) })}
          className="flex-1 min-w-[80px]"
        />
        <span className="text-xs tabular-nums w-12">{value.width}px</span>
      </div>
    </div>
  );
}

/* ============================================================
   통합 단축키 에디터 — 명령 catalog + 단축키 캡처 + N 매개 + 추가 + 목록
   ============================================================ */
type HotkeyCmdMeta = {
  id: string;
  label: string;
  /** N번째 매개 필요 여부 (true 시 N input 노출) */
  needsN?: boolean;
  /** N 최대값 (기본 10) */
  maxN?: number;
};

/** 단축키 명령 catalog — 사용자가 추가 가능한 모든 명령.
 *  legacy passthrough/headerHidden 포함 (단일 인스턴스 권장).
 *  needsN=true 명령은 N별 다중 바인딩 가능. */
const HOTKEY_COMMANDS: HotkeyCmdMeta[] = [
  { id: "passthrough",          label: "[오버레이] 클릭 통과 토글" },
  { id: "headerHidden",         label: "[오버레이] 상태바 표시 토글" },
  { id: "overlayToggle",        label: "[오버레이] ON/OFF 토글" },
  { id: "overlayCenter",        label: "[오버레이] 창 위치 초기화 (화면 중앙)" },
  { id: "overlayScaleUp",       label: "[오버레이(현재 모드)] 배율 +" },
  { id: "overlayScaleDown",     label: "[오버레이(현재 모드)] 배율 -" },
  { id: "overlayOpacityUp",     label: "[오버레이(현재 모드)] 투명도 +" },
  { id: "overlayOpacityDown",   label: "[오버레이(현재 모드)] 투명도 -" },
  { id: "mainCenter",           label: "[메인 프로그램] 창 위치 초기화 (화면 중앙)" },
  { id: "collapsedModeToggle",  label: "[오버레이-축소] 일반 / 파티 모드 전환" },
  { id: "notifierDbRefresh",    label: "[오버레이-축소] 알리미 DB 새로고침" },
  { id: "notifierMuteN",        label: "[오버레이-축소] 알리미 [N]번째 항목 잡음 처리", needsN: true, maxN: 20 },
  { id: "barrackContentNext",   label: "[오버레이-축소] 배럭관리 컨텐츠 다음 페이지" },
  { id: "barrackContentPrev",   label: "[오버레이-축소] 배럭관리 컨텐츠 이전 페이지" },
  { id: "barrackCharDoneN",     label: "[오버레이-축소] 배럭관리 [N]번째 캐릭터 '1회' 완료 (기타 페이지 제외)", needsN: true, maxN: 10 },
  { id: "barrackCharBossN",     label: "[오버레이-축소] 배럭관리 [N]번째 캐릭터 '보스 처치' (기타 페이지 제외)", needsN: true, maxN: 10 },
];

/** 기본 단축키 — 첫 마운트 시 customHotkeys 비어있으면 시드 */
const DEFAULT_HOTKEYS: { cmd: string; combo: string }[] = [
  { cmd: "overlayScaleUp",     combo: "Ctrl+WheelUp" },
  { cmd: "overlayScaleDown",   combo: "Ctrl+WheelDown" },
  { cmd: "overlayOpacityUp",   combo: "Alt+WheelUp" },
  { cmd: "overlayOpacityDown", combo: "Alt+WheelDown" },
];

function uidHotkey(): string {
  return "hk_" + Date.now().toString(36) + "_" + Math.random().toString(36).slice(2, 7);
}

function HotkeyEditor() {
  const customHotkeys = useOverlayStore((s) => s.customHotkeys);
  const upsertCustomHotkey = useOverlayStore((s) => s.upsertCustomHotkey);
  const removeCustomHotkey = useOverlayStore((s) => s.removeCustomHotkey);
  // legacy 필드 sync — passthrough/headerHidden 바인딩 시 Rust용 필드도 동기화
  const setPassthroughHotkey = useOverlayStore((s) => s.setPassthroughHotkey);
  const setHeaderHiddenHotkey = useOverlayStore((s) => s.setHeaderHiddenHotkey);

  useEffect(() => {
    // customHotkeys → legacy 필드 동기화 (enabled 한정)
    const pass = customHotkeys.find((b) => b.cmd === "passthrough" && b.enabled);
    setPassthroughHotkey(pass?.combo ?? "");
    const hh = customHotkeys.find((b) => b.cmd === "headerHidden" && b.enabled);
    setHeaderHiddenHotkey(hh?.combo ?? "");
  }, [customHotkeys, setPassthroughHotkey, setHeaderHiddenHotkey]);

  // 기본 단축키 시드 — 첫 마운트 시 해당 명령 미존재면 추가
  const seedRef = useRef(false);
  useEffect(() => {
    if (seedRef.current) return;
    seedRef.current = true;
    for (const def of DEFAULT_HOTKEYS) {
      const exists = customHotkeys.some((b) => b.cmd === def.cmd);
      if (!exists) {
        upsertCustomHotkey({
          id: uidHotkey(),
          cmd: def.cmd,
          combo: def.combo,
          enabled: true,
        });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  // 편집 행 state
  const [selectedCmd, setSelectedCmd] = useState<string>(HOTKEY_COMMANDS[0].id);
  const [draftN, setDraftN] = useState<number>(1);
  const [recording, setRecording] = useState(false);
  const [draftCombo, setDraftCombo] = useState<string>("");
  // 수정 모드 — id 있으면 기존 entry 업데이트
  const [editingId, setEditingId] = useState<string | null>(null);

  const selectedMeta = HOTKEY_COMMANDS.find((c) => c.id === selectedCmd) ?? HOTKEY_COMMANDS[0];

  // 캡처 — recording 시 keydown / mousedown / wheel → draftCombo
  useEffect(() => {
    if (!recording) return;
    const startTs = Date.now();
    const MOUSE_BTN_NAME: Record<number, string> = {
      0: "MouseLeft",
      1: "MouseMiddle",
      2: "MouseRight",
      3: "MouseBack",
      4: "MouseForward",
    };
    function buildMods(e: KeyboardEvent | MouseEvent | WheelEvent): string[] {
      const parts: string[] = [];
      if (e.ctrlKey) parts.push("Ctrl");
      if (e.altKey) parts.push("Alt");
      if (e.shiftKey) parts.push("Shift");
      if (e.metaKey) parts.push("Meta");
      return parts;
    }
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      if (e.key === "Escape") {
        setRecording(false);
        return;
      }
      if (["Control", "Alt", "Shift", "Meta"].includes(e.key)) return;
      const parts = buildMods(e);
      let mainKey = e.key;
      if (mainKey.length === 1) mainKey = mainKey.toUpperCase();
      if (mainKey === "Dead" || mainKey === "Unidentified") {
        if (e.code === "Backquote") mainKey = "`";
      }
      parts.push(mainKey);
      setDraftCombo(parts.join("+"));
      setRecording(false);
    };
    const onMouse = (e: MouseEvent) => {
      // recording 시작 클릭(단축키 설정 버튼 클릭) 무시 — 150ms grace
      if (Date.now() - startTs < 150) return;
      e.preventDefault();
      e.stopPropagation();
      const name = MOUSE_BTN_NAME[e.button];
      if (!name) return;
      const parts = buildMods(e);
      parts.push(name);
      setDraftCombo(parts.join("+"));
      setRecording(false);
    };
    const onWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 1) return;
      e.preventDefault();
      e.stopPropagation();
      const parts = buildMods(e);
      parts.push(e.deltaY < 0 ? "WheelUp" : "WheelDown");
      setDraftCombo(parts.join("+"));
      setRecording(false);
    };
    const onContextMenu = (e: MouseEvent) => {
      // 오른쪽 클릭 캡처 시 OS 컨텍스트 메뉴 차단
      e.preventDefault();
    };
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("mousedown", onMouse, true);
    window.addEventListener("contextmenu", onContextMenu, true);
    window.addEventListener("wheel", onWheel, { capture: true, passive: false });
    return () => {
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("mousedown", onMouse, true);
      window.removeEventListener("contextmenu", onContextMenu, true);
      window.removeEventListener("wheel", onWheel, true);
    };
  }, [recording]);

  function resetDraft() {
    setDraftCombo("");
    setDraftN(1);
    setEditingId(null);
    setRecording(false);
  }

  // 추가 / 수정 적용
  function handleAdd() {
    if (!draftCombo) return;
    const meta = selectedMeta;
    const id = editingId ?? uidHotkey();
    upsertCustomHotkey({
      id,
      cmd: meta.id,
      n: meta.needsN ? Math.max(1, Math.min(meta.maxN ?? 10, draftN)) : undefined,
      combo: draftCombo,
      enabled: true,
    });
    resetDraft();
  }

  function handleListToggle(b: { id: string; enabled: boolean; cmd: string; combo: string; n?: number }, on: boolean) {
    upsertCustomHotkey({ ...b, enabled: on });
  }
  function handleListEdit(b: { id: string; cmd: string; combo: string; n?: number }) {
    setSelectedCmd(b.cmd);
    setDraftN(b.n ?? 1);
    setDraftCombo(b.combo);
    setEditingId(b.id);
    setRecording(true);
  }
  async function handleListDelete(id: string) {
    if (!(await confirmDialog({ title: "단축키 삭제", description: "이 단축키를 삭제하시겠습니까?", confirmText: "삭제", variant: "destructive" }))) return;
    removeCustomHotkey(id);
    if (editingId === id) resetDraft();
  }

  function metaFor(cmdId: string): HotkeyCmdMeta | undefined {
    return HOTKEY_COMMANDS.find((c) => c.id === cmdId);
  }

  return (
    <div className="space-y-3">
      {/* 상단 안내 */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground pb-2 border-b border-border/40">
        <Info className="h-3.5 w-3.5" />
        <span>이 창에서는 단축키가 작동하지 않아요.</span>
      </div>

      {/* 편집 행: 명령 / [N] / 단축키 / [추가] */}
      <div className={cn(
        "grid gap-x-3 gap-y-1 items-end",
        selectedMeta.needsN ? "grid-cols-[1fr_auto_auto_auto]" : "grid-cols-[1fr_auto_auto]"
      )}>
        <div><Label className="text-xs text-muted-foreground">명령</Label></div>
        {selectedMeta.needsN && (
          <div><Label className="text-xs text-muted-foreground">N</Label></div>
        )}
        <div><Label className="text-xs text-muted-foreground">단축키</Label></div>
        <div />

        {/* 명령 dropdown */}
        <div className="relative">
          <select
            value={selectedCmd}
            onChange={(e) => { setSelectedCmd(e.target.value); setRecording(false); setDraftCombo(""); setDraftN(1); setEditingId(null); }}
            className="w-full h-9 px-3 pr-8 rounded border bg-background text-sm appearance-none"
          >
            {HOTKEY_COMMANDS.map((c) => (
              <option key={c.id} value={c.id}>{c.label}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-2.5 h-4 w-4 pointer-events-none text-muted-foreground" />
        </div>

        {/* N input — needsN 명령에만 */}
        {selectedMeta.needsN && (
          <Input
            type="number"
            min={1}
            max={selectedMeta.maxN ?? 10}
            value={draftN}
            onChange={(e) => setDraftN(Math.max(1, Math.min(selectedMeta.maxN ?? 10, Number(e.target.value) || 1)))}
            className="w-16 h-9 text-center tabular-nums"
          />
        )}

        {/* 단축키 카드 */}
        <div
          className={cn(
            "flex items-center gap-2 rounded border px-2 py-1 transition-colors min-w-[260px]",
            recording
              ? "border-rose-500 bg-rose-500/10 ring-2 ring-rose-500/40"
              : "border-border bg-background"
          )}
        >
          <input
            type="text"
            readOnly
            value={recording ? "키 입력 대기 중... (ESC 취소)" : (draftCombo || "설정된 단축키 없음")}
            className={cn(
              "flex-1 bg-transparent text-sm tabular-nums focus:outline-none",
              !draftCombo && !recording && "text-muted-foreground italic",
              recording && "text-rose-300 italic"
            )}
          />
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setRecording((v) => !v)}
            className={cn(
              "h-7 px-2 text-xs border",
              recording
                ? "border-rose-500 text-rose-300 bg-rose-500/15 hover:bg-rose-500/25"
                : "border-border"
            )}
          >
            {recording ? "취소" : "단축키 설정..."}
          </Button>
        </div>

        {/* 추가 / 수정 적용 */}
        <Button
          size="sm"
          onClick={handleAdd}
          disabled={!draftCombo}
          className="h-9 bg-indigo-500/30 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-500/40 disabled:opacity-50"
          title={editingId ? "수정 적용" : "단축키 등록"}
        >
          <Plus className="h-3.5 w-3.5" /> {editingId ? "수정 적용" : "추가"}
        </Button>
      </div>

      {editingId && (
        <div className="flex items-center gap-2 text-[11px] text-amber-400">
          <span>✎ 수정 중 — 변경 후 [수정 적용] 클릭, 또는</span>
          <Button size="sm" variant="ghost" onClick={resetDraft} className="h-6 px-2 text-[11px] border">취소</Button>
        </div>
      )}

      {/* 단축키 목록 */}
      <div className="space-y-1.5 pt-2">
        <h5 className="text-sm font-extrabold">단축키 목록</h5>
        {customHotkeys.length === 0 ? (
          <div className="text-[11px] text-muted-foreground italic px-3 py-2 rounded border border-dashed">
            등록된 단축키가 없습니다. 위에서 명령 + 단축키 선택 후 [추가] 클릭.
          </div>
        ) : (
          customHotkeys.map((b) => (
            <HotkeyListRow
              key={b.id}
              label={metaFor(b.cmd)?.label ?? `(미정의 명령: ${b.cmd})`}
              n={b.n}
              combo={b.combo}
              enabled={b.enabled}
              onToggle={(on) => handleListToggle(b, on)}
              onEdit={() => handleListEdit(b)}
              onDelete={() => handleListDelete(b.id)}
            />
          ))
        )}
      </div>
    </div>
  );
}

/** 단축키 목록 행 — 라벨 + N뱃지 + 키 칩 + 활성 스위치 + 수정/삭제 */
function HotkeyListRow({
  label, n, combo, enabled, onToggle, onEdit, onDelete,
}: {
  label: string;
  n?: number;
  combo: string;
  enabled: boolean;
  onToggle: (on: boolean) => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const keys = combo.split("+").filter(Boolean);
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 rounded border bg-background/40 px-3 py-2",
        !enabled && "opacity-50"
      )}
    >
      <span className="text-sm flex-1">
        {label}
        {typeof n === "number" && (
          <span className="ml-1.5 inline-flex items-center px-1.5 py-0 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 text-[10px] font-extrabold tabular-nums">
            N={n}
          </span>
        )}
      </span>
      <div className="flex items-center gap-1">
        {keys.length > 0 ? (
          keys.map((k, i) => (
            <kbd
              key={i}
              className="inline-flex items-center justify-center min-w-[28px] px-1.5 py-0.5 rounded border bg-muted/60 text-[10px] font-bold tracking-wide uppercase"
            >
              {k}
            </kbd>
          ))
        ) : (
          <span className="text-[11px] italic text-muted-foreground">미설정</span>
        )}
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
      <Button
        size="sm"
        variant="ghost"
        onClick={onEdit}
        className="h-7 w-7 p-0 border border-border"
        title="단축키 수정"
      >
        <Pencil className="h-3.5 w-3.5" />
      </Button>
      <Button
        size="sm"
        variant="ghost"
        onClick={onDelete}
        className="h-7 w-7 p-0 border border-border text-destructive hover:bg-destructive/10 hover:border-destructive"
        title="삭제"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
