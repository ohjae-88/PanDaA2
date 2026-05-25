"use client";

import { useEffect, useState } from "react";
import { RotateCcw, Save, Tag } from "lucide-react";
import { useBarrackStore } from "@/lib/barrack/store";
import { OD_CHARGE_HOURS } from "@/lib/barrack/constants";
import { Button } from "@/components/ui/button";
import type { DbSettings } from "@/lib/barrack/types";
import { ChargeHoursPills } from "@/components/barrack/charge-hours-pills";
import { KinaTiersEditor } from "@/components/barrack/kina-tiers-editor";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

type RaidKey = "expedition" | "transcend" | "sanctuary_ludra" | "sanctuary_bagot";

export default function DbSettingsPage() {
  const db = useBarrackStore((s) => s.dbSettings);
  const updateDb = useBarrackStore((s) => s.updateDb);
  const resetDb = useBarrackStore((s) => s.resetDb);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [draft, setDraft] = useState<DbSettings>(db);
  useEffect(() => { setDraft(db); }, [db]);

  function patch<K extends keyof DbSettings>(k: K, v: DbSettings[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function handleSave() {
    updateDb(draft);
    toast.success("저장되었습니다.");
  }
  async function handleReset() {
    if (!(await confirmDialog({ title: "DB 초기화", description: "DB 설정을 기본값으로 초기화하시겠습니까?", confirmText: "초기화", variant: "destructive" }))) return;
    resetDb();
  }

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold">⚙ DB 설정</h1>
          <p className="text-xs text-muted-foreground mt-1">
            게임 컨텐츠 기본값 — 수량 · 초기화 주기 · 자동 충전 · 키나 획득률
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" onClick={handleReset}>
            <RotateCcw className="h-4 w-4" /> 기본값
          </Button>
          <Button onClick={handleSave}>
            <Save className="h-4 w-4" /> 저장
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 기본 콘텐츠 설정 */}
        <DbCard icon="📅" title="기본 콘텐츠 설정" sub="일일던전 · 각성전 · 악몽 · 사명 — 수량 및 초기화 주기 설정">
          <DbTable headers={["", "수량", "초기화 주기"]}>
            <DbRow label="⚔ 일일던전">
              <NumInp value={draft.dungeon.weeklyMax} onChange={(v) => patch("dungeon", { ...draft.dungeon, weeklyMax: v })} />
              <CycleSel
                value={draft.dungeon.cycle}
                onChange={(v) => patch("dungeon", { ...draft.dungeon, cycle: v as "weekly" | "daily" })}
              />
            </DbRow>
            <DbRow label="💫 각성전">
              <NumInp value={draft.awakening.weeklyTickets} onChange={(v) => patch("awakening", { ...draft.awakening, weeklyTickets: v })} />
              <CycleSel
                value={draft.awakening.cycle}
                onChange={(v) => patch("awakening", { ...draft.awakening, cycle: v as "weekly" | "daily" })}
              />
            </DbRow>
            <DbRow label="👁 악몽 (적립)">
              <NumInp value={draft.nightmare.dailyGain} onChange={(v) => patch("nightmare", { ...draft.nightmare, dailyGain: v })} />
              <CycleSel
                value={draft.nightmare.cycle}
                onChange={(v) => patch("nightmare", { ...draft.nightmare, cycle: v as "daily" | "weekly" })}
              />
            </DbRow>
            <DbRow label={<span className="text-[11px] text-muted-foreground pl-3">최대 보유</span>}>
              <NumInp value={draft.nightmare.maxTickets} onChange={(v) => patch("nightmare", { ...draft.nightmare, maxTickets: v })} />
              <div />
            </DbRow>
            <DbRow label="📋 사명">
              <NumInp value={draft.mission.dailyMax} onChange={(v) => patch("mission", { ...draft.mission, dailyMax: v })} />
              <CycleSel
                value={draft.mission.cycle}
                onChange={(v) => patch("mission", { ...draft.mission, cycle: v as "daily" | "weekly" })}
              />
            </DbRow>
          </DbTable>
        </DbCard>

        {/* 오드·선택상자 — 기본 콘텐츠 우측 */}
        <DbCard
          icon="🛒"
          title="오드 · 선택상자"
          sub="서버별 및 캐릭터별 상점 아이템 수량·초기화 설정"
        >
          <div className="space-y-3">
            <DbSubSection label="📦 서버별">
              <DbTable headers={["", "최대 수량", "초기화 주기"]}>
                <DbRow label="🔄 변환오드">
                  <NumInp value={draft.shopOdConvert?.max ?? 16} onChange={(v) => patch("shopOdConvert", { ...(draft.shopOdConvert ?? { max: 16, resetVal: 0, cycle: "weekly" }), max: v })} />
                  <CycleSel
                    value={draft.shopOdConvert?.cycle ?? "weekly"}
                    onChange={(v) => patch("shopOdConvert", { ...(draft.shopOdConvert ?? { max: 16, resetVal: 0, cycle: "weekly" }), cycle: v as "weekly" | "daily" })}
                  />
                </DbRow>
                <DbRow label="💰 상점오드">
                  <NumInp value={draft.shopOd.max} onChange={(v) => patch("shopOd", { ...draft.shopOd, max: v })} />
                  <CycleSel
                    value={draft.shopOd.cycle}
                    onChange={(v) => patch("shopOd", { ...draft.shopOd, cycle: v as "weekly" | "daily" })}
                  />
                </DbRow>
                <DbRow label="🎁 선택상자">
                  <NumInp value={draft.shopBox.max} onChange={(v) => patch("shopBox", { ...draft.shopBox, max: v })} />
                  <CycleSel
                    value={draft.shopBox.cycle}
                    onChange={(v) => patch("shopBox", { ...draft.shopBox, cycle: v as "weekly" | "daily" })}
                  />
                </DbRow>
              </DbTable>
            </DbSubSection>
            <hr className="border-dashed" />
            <DbSubSection label="🧬 캐릭터별">
              <DbTable headers={["", "최대 수량", "초기화 주기"]}>
                <DbRow label="🔁 변환">
                  <NumInp value={draft.charConvert.max} onChange={(v) => patch("charConvert", { ...draft.charConvert, max: v })} />
                  <CycleSel
                    value={draft.charConvert.cycle}
                    onChange={(v) => patch("charConvert", { ...draft.charConvert, cycle: v as "weekly" | "daily" })}
                  />
                </DbRow>
                <DbRow label="🏪 상점">
                  <NumInp value={draft.charBuy.max} onChange={(v) => patch("charBuy", { ...draft.charBuy, max: v })} />
                  <CycleSel
                    value={draft.charBuy.cycle}
                    onChange={(v) => patch("charBuy", { ...draft.charBuy, cycle: v as "weekly" | "daily" })}
                  />
                </DbRow>
              </DbTable>
            </DbSubSection>
          </div>
        </DbCard>

        {/* 원정 */}
        <RaidCard
          icon="🗺"
          title="원정"
          sub="보상: 자동 충전 / 보스: 주간 초기화"
          tag={{ label: "주간 초기화", color: "amber" }}
          raidKey="expedition"
          draft={draft}
          patch={patch}
          withCharge
        />

        {/* 초월 */}
        <RaidCard
          icon="⚡"
          title="초월"
          sub="보상: 자동 충전 / 보스: 주간 초기화"
          tag={{ label: "주간 초기화", color: "amber" }}
          raidKey="transcend"
          draft={draft}
          patch={patch}
          withCharge
        />

        {/* 성역 (루드라) */}
        <RaidCard
          icon="🌟"
          title="성역 (루드라)"
          sub="보상·보스: 주간 초기화"
          tag={{ label: "주간 초기화", color: "amber" }}
          raidKey="sanctuary_ludra"
          draft={draft}
          patch={patch}
        />

        {/* 성역 (바고트) */}
        <RaidCard
          icon="🌙"
          title="성역 (바고트)"
          sub="보상·보스: 주간 초기화"
          tag={{ label: "주간 초기화", color: "amber" }}
          raidKey="sanctuary_bagot"
          draft={draft}
          patch={patch}
        />

        {/* 오드 자동충전 */}
        <DbCard
          icon="🔷"
          title="오드 자동충전"
          sub="KST 기준 자동 반영 · 시각/충전량 변경 가능"
          tag={{ label: "자동 충전", color: "blue" }}
        >
          <div className="space-y-3">
            <Field label="1회 충전량 (오드)">
              <NumInp value={draft.od.chargeAmount} onChange={(v) => patch("od", { ...draft.od, chargeAmount: v })} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="오드 한도 — 구독">
                <NumInp value={draft.odMaxSub ?? 840} onChange={(v) => patch("odMaxSub", v)} />
              </Field>
              <Field label="오드 한도 — 미구독">
                <NumInp value={draft.odMaxUnsub ?? 420} onChange={(v) => patch("odMaxUnsub", v)} />
              </Field>
            </div>
            <Field label="충전 시각 (KST) — 추가/제거 가능">
              <ChargeHoursPills
                hours={draft.od.chargeHours ?? OD_CHARGE_HOURS}
                onChange={(hrs) => patch("od", { ...draft.od, chargeHours: hrs })}
              />
            </Field>
          </div>
        </DbCard>

        {/* 키나 획득률 - 원정 */}
        <DbCard
          icon="🗺"
          title="키나 획득률 구간 — 원정"
          sub="원정 누적 보상 횟수 기준 · 구간/확률 자유 설정"
          tag={{ label: "누적 기준", color: "purple" }}
        >
          <KinaTiersEditor
            value={draft.kinaRates.expedition}
            onChange={(v) => patch("kinaRates", { ...draft.kinaRates, expedition: v })}
          />
        </DbCard>

        {/* 키나 획득률 - 초월 */}
        <DbCard
          icon="⚡"
          title="키나 획득률 구간 — 초월"
          sub="초월 누적 보상 횟수 기준 · 구간/확률 자유 설정"
          tag={{ label: "누적 기준", color: "purple" }}
        >
          <KinaTiersEditor
            value={draft.kinaRates.transcend}
            onChange={(v) => patch("kinaRates", { ...draft.kinaRates, transcend: v })}
          />
        </DbCard>
      </div>
    </div>
  );
}

// ── 공통 컴포넌트 ──

function DbCard({
  icon, title, sub, tag, children, className,
}: {
  icon: string; title: string; sub: string;
  tag?: { label: string; color: "amber" | "blue" | "purple" };
  children: React.ReactNode;
  className?: string;
}) {
  const tagCls = tag
    ? tag.color === "amber"
      ? "bg-amber-500/15 text-amber-300 border-amber-500/30"
      : tag.color === "blue"
      ? "bg-cat-barrack/15 text-cat-barrack border-cat-barrack/30"
      : "bg-cat-party/15 text-cat-party border-cat-party/30"
    : "";
  return (
    <div className={cn("relative rounded-lg border bg-card p-4 space-y-3", className)}>
      {tag && (
        <span className={cn("absolute right-3 top-3 text-[10px] font-bold border rounded-full px-2 py-0.5 flex items-center gap-1", tagCls)}>
          <Tag className="h-2.5 w-2.5" /> {tag.label}
        </span>
      )}
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="font-extrabold text-sm">{title}</div>
          <div className="text-[11px] text-muted-foreground mt-0.5">{sub}</div>
        </div>
      </div>
      <div className="pt-1">{children}</div>
    </div>
  );
}

function DbSubSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-[11px] font-bold text-muted-foreground mb-1.5">{label}</div>
      {children}
    </div>
  );
}

function DbTable({ headers, children }: { headers: React.ReactNode[]; children: React.ReactNode }) {
  return (
    <div className="grid gap-x-3 gap-y-1.5 text-xs" style={{ gridTemplateColumns: `1.4fr 1fr 1fr` }}>
      {headers.map((h, i) => (
        <div key={i} className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">{h}</div>
      ))}
      {children}
    </div>
  );
}

function DbRow({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <>
      <div className="font-semibold flex items-center">{label}</div>
      {children}
    </>
  );
}

function NumInp({ value, onChange, min = 0 }: { value: number; onChange: (n: number) => void; min?: number }) {
  return (
    <input
      type="number"
      min={min}
      value={value}
      onChange={(e) => onChange(Number(e.target.value) || 0)}
      className="h-7 w-full px-2 border rounded bg-background tabular-nums text-xs"
    />
  );
}

function CycleSel({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-7 w-full px-2 border rounded bg-background text-xs"
    >
      <option value="weekly">주간</option>
      <option value="daily">일간</option>
    </select>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-[11px] font-bold text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}

function RaidCard({
  icon, title, sub, tag, raidKey, draft, patch, withCharge,
}: {
  icon: string; title: string; sub: string;
  tag?: { label: string; color: "amber" | "blue" | "purple" };
  raidKey: RaidKey;
  draft: DbSettings;
  patch: <K extends keyof DbSettings>(k: K, v: DbSettings[K]) => void;
  withCharge?: boolean;
}) {
  const r = draft[raidKey] as any;
  return (
    <DbCard icon={icon} title={title} sub={sub} tag={tag}>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <Field label="보상 최대">
          <NumInp value={r.rewardMax} onChange={(v) => patch(raidKey, { ...r, rewardMax: v })} min={1} />
        </Field>
        <Field label="보스 최대">
          <NumInp value={r.bossMax} onChange={(v) => patch(raidKey, { ...r, bossMax: v })} min={1} />
        </Field>
        <Field label="오드 (구독)">
          <NumInp value={r.odSub} onChange={(v) => patch(raidKey, { ...r, odSub: v })} />
        </Field>
        <Field label="오드 (미구독)">
          <NumInp value={r.odUnsub} onChange={(v) => patch(raidKey, { ...r, odUnsub: v })} />
        </Field>
        {withCharge && (
          <>
            <Field label="1회 충전 수량">
              <NumInp value={r.rewardChargeAmount ?? 1} onChange={(v) => patch(raidKey, { ...r, rewardChargeAmount: v })} />
            </Field>
            <div />
            <div className="col-span-2">
              <Field label="충전 시각 (KST) — 추가/제거 가능">
                <ChargeHoursPills
                  hours={r.chargeHours ?? []}
                  onChange={(hrs) => patch(raidKey, { ...r, chargeHours: hrs })}
                />
              </Field>
            </div>
          </>
        )}
      </div>
    </DbCard>
  );
}
