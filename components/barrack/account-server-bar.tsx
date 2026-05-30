"use client";

import { useState } from "react";
import { Pencil, Trash2, ChevronDown, ChevronUp, Info, ArrowUp, ArrowDown } from "lucide-react";
import type { Account, Character } from "@/lib/barrack/types";
import { useBarrackStore } from "@/lib/barrack/store";
import { Button } from "@/components/ui/button";
import { getKinaRateInfo, kinaRateColorClass } from "@/lib/barrack/kina";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { confirmDialog } from "@/lib/util/confirm";

type Props = {
  acc: Account;
  server: string;
  chars: Character[];
  onEditAcc: (id: string) => void;
  /** 계정 순서 이동 — 제공되면 ▲▼ 버튼 노출 (전체뷰 + 계정 첫 그룹에서만) */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
};

export function AccountServerBar({ acc, server, chars, onEditAcc, onMoveUp, onMoveDown }: Props) {
  const sd = acc.servers?.[server];
  const db = useBarrackStore((s) => s.dbSettings);
  const patchServerData = useBarrackStore((s) => s.patchServerData);
  const removeAccount = useBarrackStore((s) => s.removeAccount);
  const adjustServerMission = useBarrackStore((s) => s.adjustServerMission);
  const adjustDungeon = useBarrackStore((s) => s.adjustDungeon);
  const adjustTicket = useBarrackStore((s) => s.adjustTicket);

  const [ticketOpen, setTicketOpen] = useState(false);

  // 서버 단위 카운터
  const mMax = db.mission?.dailyMax ?? 5;
  const mLeft = Math.min(sd?.missionDone ?? mMax, mMax);
  const dm = db.dungeon?.weeklyMax ?? 14;
  const dBase = sd?.dungeon?.base ?? dm;
  const dEx = sd?.dungeon?.extra ?? 0;
  const dDisplay = dEx > 0 ? `${dBase}+${dEx}/${dm}` : `${dBase}/${dm}`;

  function patchShopOd(v: number) {
    patchServerData(acc.id, server, { shopOdBuy: Math.max(0, v) });
  }
  function patchShopOdConvert(v: number) {
    patchServerData(acc.id, server, { shopOdConvert: Math.max(0, v) });
  }
  function patchShopBox(v: number) {
    patchServerData(acc.id, server, { shopBox: Math.max(0, v) });
  }
  async function handleDelete() {
    if (!(await confirmDialog({ title: "계정 삭제", description: `'${acc.name}'과 소속 캐릭터를 모두 삭제합니다.`, confirmText: "삭제", variant: "destructive" }))) return;
    removeAccount(acc.id);
  }

  // 좌클릭 -1, 우클릭 +1 (서버바 카운터 공통)
  function makeBtn(handler: (d: -1 | 1) => void) {
    return {
      onClick: (e: React.MouseEvent) => { e.stopPropagation(); handler(-1); },
      onContextMenu: (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); handler(+1); },
    };
  }

  return (
    <div className="rounded-md border bg-muted/20 p-3">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="font-extrabold text-sm">{acc.name}</span>
        {acc.subscribed && (
          <span className="text-[10px] font-bold text-cat-arcana bg-cat-arcana/10 border border-cat-arcana/30 px-1.5 rounded">
            구독
          </span>
        )}
        {server && (
          <span className="text-[11px] text-muted-foreground border-l pl-2">
            {server}
          </span>
        )}
        <span className="text-[11px] text-muted-foreground">{chars.length}명</span>

        <div className="ml-auto flex items-center gap-1">
          {(onMoveUp || onMoveDown) && (
            <div className="flex items-center gap-0.5 mr-1">
              <Button variant="ghost" size="xs" onClick={onMoveUp} disabled={!onMoveUp} title="위로 이동">
                <ArrowUp className="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="xs" onClick={onMoveDown} disabled={!onMoveDown} title="아래로 이동">
                <ArrowDown className="h-3 w-3" />
              </Button>
            </div>
          )}
          <button
            onClick={() => setTicketOpen((v) => !v)}
            className="text-[11px] font-bold text-muted-foreground hover:text-foreground border rounded px-2 py-0.5 inline-flex items-center gap-1"
            title={ticketOpen ? "티켓 행 접기" : "티켓 행 펼치기"}
          >
            {ticketOpen ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            {ticketOpen ? "접기" : "티켓"}
          </button>
          <Button variant="ghost" size="xs" onClick={() => onEditAcc(acc.id)} title="계정 수정">
            <Pencil className="h-3 w-3" />
          </Button>
          <Button variant="ghost" size="xs" onClick={handleDelete} title="계정 삭제">
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* 누적 통계 — 원정/초월 누적 (키나 획득률 연동) + 상점/선택상자 */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2.5 text-[11px]">
        <KinaTotalCell
          icon="🗺"
          label="원정 누적"
          accId={acc.id}
          server={server}
          type="expedition"
          value={sd?.expRewardTotal ?? 0}
        />
        <KinaTotalCell
          icon="⚡"
          label="초월 누적"
          accId={acc.id}
          server={server}
          type="transcend"
          value={sd?.traRewardTotal ?? 0}
        />
        <ShopCell icon="🔄" label="변환 오드" value={sd?.shopOdConvert ?? 0} max={db.shopOdConvert?.max ?? 16} onChange={patchShopOdConvert} accent="violet" />
        <ShopCell icon="💰" label="상점 오드" value={sd?.shopOdBuy ?? 0} max={db.shopOd.max} onChange={patchShopOd} accent="gold" />
        <ShopCell icon="🎁" label="선택상자" value={sd?.shopBox ?? 0} max={db.shopBox.max} onChange={patchShopBox} accent="violet" />
      </div>

      {/* 티켓 행 — 사명/일던/슈고/침공 */}
      {ticketOpen && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2 text-[11px]">
          <TicketCell
            label="📋 사명"
            value={`${mLeft}/${mMax}`}
            done={mLeft <= 0}
            started={mLeft < mMax}
            handlers={makeBtn((d) => adjustServerMission(acc.id, server, d))}
          />
          <TicketCell
            label="⚔ 일던"
            value={dDisplay}
            done={dBase <= 0 && dEx <= 0}
            started={dBase < dm}
            handlers={makeBtn((d) => adjustDungeon(acc.id, server, d))}
          />
          <TicketCell
            label="🐾 슈고"
            value={String(sd?.shugoTickets ?? 0)}
            done={(sd?.shugoTickets ?? 0) <= 0}
            handlers={makeBtn((d) => adjustTicket(acc.id, server, "shugo", d))}
          />
          <TicketCell
            label="🛡 침공"
            value={String(sd?.invasionTickets ?? 0)}
            done={(sd?.invasionTickets ?? 0) <= 0}
            handlers={makeBtn((d) => adjustTicket(acc.id, server, "invasion", d))}
          />
        </div>
      )}
    </div>
  );
}

function KinaTotalCell({
  icon, label, accId, server, type, value,
}: {
  icon: string; label: string; accId: string; server: string;
  type: "expedition" | "transcend"; value: number;
}) {
  const db = useBarrackStore((s) => s.dbSettings);
  const setRewardTotal = useBarrackStore((s) => s.setRewardTotal);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(String(value));

  const info = getKinaRateInfo(type, value, db);
  const colorCls = kinaRateColorClass(info.rate);
  const tiers = db.kinaRates?.[type]?.tiers ?? [];
  const fallback = db.kinaRates?.[type]?.fallbackRate ?? 20;

  // 진행률 — 현재 구간 시작점 ~ nextThreshold 사이 위치
  let progressPct = 0;
  if (info.nextThreshold !== null) {
    const tierIdx = tiers.findIndex((t) => t.rate === info.rate);
    const lo = tierIdx <= 0 ? 0 : tiers[tierIdx - 1].threshold;
    const range = info.nextThreshold - lo;
    progressPct = range > 0 ? Math.min(100, Math.max(0, ((value - lo) / range) * 100)) : 0;
  } else {
    progressPct = 100;
  }

  function commit() {
    const n = parseInt(draft, 10);
    if (!isNaN(n) && n >= 0) setRewardTotal(accId, server, type, n);
    setEditing(false);
  }

  // 진행 바 색상 — rate에 맞춰
  const barColor =
    info.rate >= 100 ? "from-emerald-500 to-emerald-400"
    : info.rate >= 80 ? "from-amber-500 to-amber-400"
    : info.rate >= 60 ? "from-rose-500 to-rose-400"
    : "from-slate-500 to-slate-400";

  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button, input")) return;
    setRewardTotal(accId, server, type, value + 1);
  }

  return (
    <div
      onClick={handleCardClick}
      className={cn("rounded-lg border-2 px-2.5 py-1.5 transition-all hover:scale-[1.01] cursor-pointer", colorCls)}
      title="카드 클릭 시 +1"
    >
      {/* 가로 한 행: [아이콘 라벨] [N회] [N%] [정보] */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-base flex-shrink-0">{icon}</span>
          <span className="text-[11px] font-bold opacity-90 truncate">{label}</span>
        </div>
        <div className="flex items-baseline gap-1.5 tabular-nums leading-none flex-shrink-0">
          {editing ? (
            <input
              autoFocus
              type="number"
              min={0}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={commit}
              onKeyDown={(e) => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }}
              className="w-16 px-1 border rounded bg-background tabular-nums text-base font-extrabold"
            />
          ) : (
            <button
              onClick={() => { setDraft(String(value)); setEditing(true); }}
              className="text-lg font-extrabold tabular-nums hover:underline leading-none"
              title="클릭하여 누적 횟수 수정"
            >
              {value}<span className="text-[10px] font-normal opacity-60 ml-0.5">회</span>
            </button>
          )}
          <span className="text-lg font-extrabold tabular-nums leading-none">
            {info.rate}<span className="text-xs opacity-70">%</span>
          </span>
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <button className="opacity-60 hover:opacity-100 transition-opacity flex-shrink-0" aria-label="키나 획득률 구간">
              <Info className="h-3 w-3" />
            </button>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            <div className="font-bold mb-1">{label} — 키나 획득률</div>
            <table className="text-[11px]">
              <tbody>
                {tiers.map((t, i) => {
                  const lo = i === 0 ? 1 : (tiers[i - 1].threshold + 1);
                  const active = value >= lo && value <= t.threshold;
                  return (
                    <tr key={i} className={active ? "text-gold-light font-bold" : ""}>
                      <td className="pr-2">{lo}~{t.threshold}회</td>
                      <td className="font-bold">{t.rate}%</td>
                    </tr>
                  );
                })}
                <tr className={value > (tiers[tiers.length - 1]?.threshold ?? 0) ? "text-gold-light font-bold" : ""}>
                  <td className="pr-2">{(tiers[tiers.length - 1]?.threshold ?? 0) + 1}회 ~</td>
                  <td className="font-bold">{fallback}%</td>
                </tr>
              </tbody>
            </table>
          </TooltipContent>
        </Tooltip>
      </div>
      {/* 진행 바 + 다음 안내 한 행 */}
      <div className="flex items-center gap-2 mt-1">
        <div className="flex-1 h-1 rounded bg-background/50 overflow-hidden">
          <div className={cn("h-full bg-gradient-to-r transition-all", barColor)} style={{ width: `${progressPct}%` }} />
        </div>
        <div className="text-[9px] opacity-70 leading-tight tabular-nums flex-shrink-0">
          {info.remaining !== null && info.nextRate !== null
            ? <>{info.nextRate}%까지 {info.remaining}회</>
            : <span className="font-bold">최종</span>}
        </div>
      </div>
    </div>
  );
}

function ShopCell({
  icon, label, value, max, onChange, accent = "gold",
}: {
  icon: string;
  label: string;
  value: number;
  max: number;
  onChange: (v: number) => void;
  accent?: "gold" | "violet";
}) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  const done = max > 0 && value >= max;
  const accentCls =
    accent === "violet"
      ? "border-violet-400/40 bg-violet-500/5 hover:bg-violet-500/10 [&_.acc]:text-violet-300"
      : "border-gold/40 bg-gold/5 hover:bg-gold/10 [&_.acc]:text-gold-light";
  const barCls =
    accent === "violet"
      ? "from-violet-500 to-violet-400"
      : "from-gold to-amber-300";
  function handleCardClick(e: React.MouseEvent) {
    if ((e.target as HTMLElement).closest("button, input")) return;
    onChange(Math.min(max, value + 1));
  }
  return (
    <div
      onClick={handleCardClick}
      className={cn("rounded-lg border-2 px-2.5 py-1.5 transition-all hover:scale-[1.01] cursor-pointer", accentCls, done && "opacity-90 ring-1 ring-emerald-500/40")}
      title="카드 클릭 시 +1"
    >
      {/* 가로 한 행: [아이콘 라벨] [숫자/최대] [-/+] [완료] */}
      <div className="flex items-center gap-2">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          <span className="text-base flex-shrink-0">{icon}</span>
          <span className="text-[11px] font-bold opacity-90 text-muted-foreground truncate">{label}</span>
        </div>
        <div className="flex items-baseline gap-0.5 leading-none tabular-nums flex-shrink-0">
          <input
            type="number"
            min={0}
            max={max}
            value={value}
            onChange={(e) => onChange(Math.max(0, Math.min(max, Number(e.target.value) || 0)))}
            className="acc w-10 text-right tabular-nums bg-transparent text-lg font-extrabold focus:outline-none focus:border-b focus:border-current"
          />
          <span className="text-xs opacity-60">/{max}</span>
        </div>
        <div className="flex items-center gap-0.5 flex-shrink-0">
          <button
            className="w-5 h-5 rounded border border-current/40 hover:bg-current/10 text-xs font-bold leading-none disabled:opacity-30"
            onClick={() => onChange(Math.max(0, value - 1))}
            disabled={value <= 0}
            title="-1"
          >−</button>
          <button
            className="w-5 h-5 rounded border border-current/40 hover:bg-current/10 text-xs font-bold leading-none disabled:opacity-30"
            onClick={() => onChange(Math.min(max, value + 1))}
            disabled={value >= max}
            title="+1"
          >+</button>
        </div>
        {done && <span className="text-[9px] font-extrabold text-emerald-400 flex-shrink-0">✓</span>}
      </div>
      <div className="mt-1 h-1 rounded bg-background/50 overflow-hidden">
        <div className={cn("h-full bg-gradient-to-r transition-all", barCls)} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function TicketCell({
  label, value, done, started, handlers,
}: { label: string; value: string; done?: boolean; started?: boolean; handlers: { onClick: (e: React.MouseEvent) => void; onContextMenu: (e: React.MouseEvent) => void } }) {
  return (
    <div className="rounded border bg-background/60 px-2 py-1.5 flex items-center justify-between gap-2">
      <button
        {...handlers}
        className={cn(
          "text-[11px] font-bold px-2 py-0.5 rounded border transition-colors min-w-[60px]",
          done ? "bg-emerald-500/20 border-emerald-500/40 text-emerald-300" :
          started ? "bg-gold/10 border-gold/30 text-gold-light" : "bg-card hover:bg-accent/10"
        )}
        title="좌:-1 / 우:+1"
      >
        {label}
      </button>
      <span className={cn(
        "tabular-nums font-bold",
        done ? "text-emerald-300" :
        started ? "text-gold-light" : ""
      )}>
        {value}
      </span>
    </div>
  );
}
