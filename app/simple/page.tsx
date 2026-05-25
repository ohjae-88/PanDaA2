"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Eye, EyeOff, Gift, Skull, Check } from "lucide-react";
import { useBarrackStore, computeOdMax, sortCharacters } from "@/lib/barrack/store";
import { useResetTick } from "@/components/barrack/use-reset-tick";
import { subscribeSecondTick } from "@/lib/util/global-tick";
import { CLASSES } from "@/lib/barrack/constants";
import { fmtN, formatToday, nextChargeMs, nextWeeklyResetMs, formatHMS } from "@/lib/barrack/time";
import { getKinaRateInfo } from "@/lib/barrack/kina";
import { cn } from "@/lib/utils";
import { charProfileUrl } from "@/lib/barrack/profile-url";
import type { Character, Account } from "@/lib/barrack/types";

const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

const RAID_DEF = [
  { key: "expedition", icon: "🗺", label: "원정" },
  { key: "transcend", icon: "⚡", label: "초월" },
  { key: "sanctuary_ludra", icon: "🌟", label: "성역(루)" },
  { key: "sanctuary_bagot", icon: "🌙", label: "성역(바)" },
] as const;

type RaidKey = (typeof RAID_DEF)[number]["key"];

function groupByServer(chars: Character[]): { server: string; chars: Character[] }[] {
  const map: Record<string, Character[]> = {};
  for (const c of chars) {
    const k = c.server || "";
    (map[k] ??= []).push(c);
  }
  return Object.entries(map)
    .sort(([a], [b]) => a.localeCompare(b, "ko"))
    .map(([server, chars]) => ({ server, chars }));
}

export default function SimplePage() {
  useResetTick();
  const characters = useBarrackStore((s) => s.characters);
  const accounts = useBarrackStore((s) => s.accounts);
  const db = useBarrackStore((s) => s.dbSettings);
  const characterOrder = useBarrackStore((s) => s.characterOrder);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  // 1초마다 타이머 갱신 — 글로벌 visibility-aware tick 공유
  const [, setNowTick] = useState(0);
  useEffect(() => subscribeSecondTick(() => setNowTick((n) => n + 1)), []);

  const [timerOpen, setTimerOpen] = useState(true);
  const [showReward, setShowReward] = useState(true);
  const [showBoss, setShowBoss] = useState(true);
  const [showDone, setShowDone] = useState(true);
  const [showHidden, setShowHidden] = useState(false);

  const sortedChars = useMemo(
    () => sortCharacters(characters, characterOrder),
    [characters, characterOrder]
  );
  const visibleChars = useMemo(
    () => sortedChars.filter((c) => showHidden ? true : !c.hidden),
    [sortedChars, showHidden]
  );

  // 전체 키나 합계
  const totalKina = useMemo(() => {
    let sum = 0;
    for (const a of accounts) {
      const svs = a.servers || {};
      for (const sd of Object.values(svs)) sum += sd?.kina || 0;
    }
    return sum;
  }, [accounts]);

  // 타이머 ms
  const odMs = nextChargeMs(db.od?.chargeHours || []);
  const expMs = nextChargeMs(db.expedition?.chargeHours || []);
  const traMs = nextChargeMs(db.transcend?.chargeHours || []);
  const nightmareMs = nextChargeMs([5]); // 매일 5KST
  const shugoMs = nextChargeMs([5]); // 매일 5KST
  const weeklyMs = nextWeeklyResetMs();

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  return (
    <div className="space-y-3">
      {/* 헤더 */}
      <div className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-extrabold">⚡ 심플 대시보드</h1>
            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-bold hover:bg-accent/10"
              title="상세 대시보드"
            >
              📕 상세
            </Link>
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            계정별 핵심 콘텐츠 현황 — 좌클릭 ▼ / 우클릭 ▲
          </p>
        </div>
        <div className="flex items-center gap-1.5 flex-wrap">
          <PillToggle on={showReward} onClick={() => setShowReward((v) => !v)} className="text-amber-400 border-amber-500/40 bg-amber-500/10">
            <Gift className="h-3 w-3" /> 보상
          </PillToggle>
          <PillToggle on={showBoss} onClick={() => setShowBoss((v) => !v)} className="text-rose-400 border-rose-500/40 bg-rose-500/10">
            <Skull className="h-3 w-3" /> 보스
          </PillToggle>
          <PillToggle on={showDone} onClick={() => setShowDone((v) => !v)} className="text-emerald-400 border-emerald-500/40 bg-emerald-500/10">
            <Check className="h-3 w-3" /> 완료
          </PillToggle>
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded border border-gold/40 bg-gold/10 text-gold-light text-xs font-bold">
            전체 키나
            <span className="text-gold-light font-extrabold tabular-nums">💰 {fmtN(totalKina)}</span>
          </div>
          <button
            onClick={() => setShowHidden((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-bold hover:bg-accent/10"
            title={showHidden ? "숨김 캐릭터 가리기" : "숨김 캐릭터 보이기"}
          >
            {showHidden ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
          </button>
        </div>
      </div>

      {/* 자동 충전 타이머 */}
      <div className="rounded-lg border bg-card overflow-hidden">
        <button
          onClick={() => setTimerOpen((v) => !v)}
          className="w-full flex items-center gap-2 px-3 py-1.5 bg-muted/20 hover:bg-muted/30"
        >
          <span className="text-xs font-extrabold flex-1 text-left">⏱ 자동 충전 타이머</span>
          <span className="text-xs text-muted-foreground">{timerOpen ? "▲ 접기" : "▼ 펼치기"}</span>
        </button>
        {timerOpen && (
          <div className="p-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2 text-xs">
            <TimerCell icon="🔷" label="오드 충전" ms={odMs} />
            <TimerCell icon="🗺" label="원정 보상" ms={expMs} />
            <TimerCell icon="⚡" label="초월 보상" ms={traMs} />
            <TimerCell icon="👁" label="악몽 적립" ms={nightmareMs} />
            <TimerCell icon="🐾" label="슈고 적립" ms={shugoMs} />
            <TimerCell icon="🔄" label="주간 초기화" ms={weeklyMs} />
          </div>
        )}
      </div>

      {/* 계정 블록 */}
      {accounts.length === 0 ? (
        <div className="text-center text-sm text-muted-foreground py-12 rounded-lg border bg-card">계정이 없습니다.</div>
      ) : (
        <div className="space-y-3">
          {accounts.map((acc) => {
            const accChars = visibleChars.filter((c) => c.accountId === acc.id);
            const groups = groupByServer(accChars);
            if (groups.length === 0) return null;
            return groups.map(({ server, chars }) => (
              <AccountServerBlock
                key={`${acc.id}::${server}`}
                acc={acc}
                server={server}
                chars={chars}
                showReward={showReward}
                showBoss={showBoss}
                showDone={showDone}
              />
            ));
          })}
        </div>
      )}

      <p className="text-[10px] text-muted-foreground text-right">{formatToday()}</p>
    </div>
  );
}

function PillToggle({ on, onClick, children, className }: { on: boolean; onClick: () => void; children: React.ReactNode; className?: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded border text-xs font-bold transition-all",
        on ? className : "border-border text-muted-foreground opacity-50"
      )}
    >
      {children}
    </button>
  );
}

function TimerCell({ icon, label, ms }: { icon: string; label: string; ms: number }) {
  return (
    <div className="flex items-center gap-2 rounded border bg-background/40 px-2 py-1.5">
      <span className="text-base">{icon}</span>
      <div className="flex-1 min-w-0">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="font-bold tabular-nums text-cat-arcana">{formatHMS(ms)}</div>
      </div>
    </div>
  );
}

function AccountServerBlock({
  acc, server, chars, showReward, showBoss, showDone,
}: {
  acc: Account;
  server: string;
  chars: Character[];
  showReward: boolean;
  showBoss: boolean;
  showDone: boolean;
}) {
  const sd = acc.servers?.[server];
  const db = useBarrackStore((s) => s.dbSettings);
  const patchServerData = useBarrackStore((s) => s.patchServerData);
  const adjustDungeon = useBarrackStore((s) => s.adjustDungeon);
  const adjustTicket = useBarrackStore((s) => s.adjustTicket);
  const setRewardTotal = useBarrackStore((s) => s.setRewardTotal);

  const dm = db.dungeon?.weeklyMax ?? 14;
  const dBase = sd?.dungeon?.base ?? dm;
  const dEx = sd?.dungeon?.extra ?? 0;
  const dCompleted = dm - dBase + dEx;
  const dDisplay = `${dCompleted}/${dm}`;

  const shopOd = sd?.shopOdBuy ?? 0;
  const shopOdMax = db.shopOd?.max ?? 16;
  const shopBox = sd?.shopBox ?? 0;
  const shopBoxMax = db.shopBox?.max ?? 7;
  const shugo = sd?.shugoTickets ?? 0;
  const invasion = sd?.invasionTickets ?? 0;

  const expRew = sd?.expRewardTotal ?? 0;
  const traRew = sd?.traRewardTotal ?? 0;
  const expInfo = getKinaRateInfo("expedition", expRew, db);
  const traInfo = getKinaRateInfo("transcend", traRew, db);

  return (
    <div className="rounded-lg border bg-card overflow-hidden">
      {/* 헤더 */}
      <div className="px-3 py-2 bg-muted/20 flex items-center gap-2 flex-wrap">
        <span className="text-sm font-extrabold">{acc.name}</span>
        {acc.subscribed && (
          <span className="text-[10px] font-bold text-cat-arcana bg-cat-arcana/10 border border-cat-arcana/30 px-1.5 rounded">
            구독
          </span>
        )}
        {server && (
          <span className="text-[11px] text-muted-foreground">{server}</span>
        )}
        <span className="text-[11px] text-muted-foreground">{chars.length}명</span>
        <span className="ml-auto inline-flex items-center gap-1 text-gold-light text-xs font-bold tabular-nums">
          💰 {fmtN(sd?.kina ?? 0)}
        </span>
      </div>

      {/* 카운터 */}
      <div className="px-3 py-2 flex items-center gap-3 flex-wrap border-b text-[11px]">
        <KinaPill icon="🗺" label="원정 누적" value={expRew} pct={expInfo.rate}
          onAdjust={(d) => setRewardTotal(acc.id, server, "expedition", Math.max(0, expRew + d))} />
        <KinaPill icon="⚡" label="초월 누적" value={traRew} pct={traInfo.rate}
          onAdjust={(d) => setRewardTotal(acc.id, server, "transcend", Math.max(0, traRew + d))} />
        <CounterPill icon="🛡" label="" value={`${shopOd}/${shopOdMax}`} done={shopOd >= shopOdMax}
          onClick={() => patchServerData(acc.id, server, { shopOdBuy: Math.min(shopOdMax, shopOd + 1) })}
          onRightClick={() => patchServerData(acc.id, server, { shopOdBuy: Math.max(0, shopOd - 1) })} />
        <CounterPill icon="🎁" label="" value={`${shopBox}/${shopBoxMax}`} done={shopBox >= shopBoxMax}
          onClick={() => patchServerData(acc.id, server, { shopBox: Math.min(shopBoxMax, shopBox + 1) })}
          onRightClick={() => patchServerData(acc.id, server, { shopBox: Math.max(0, shopBox - 1) })} />
        <CounterPill icon="⚔" label="" value={dDisplay} done={dBase <= 0}
          onClick={() => adjustDungeon(acc.id, server, -1)}
          onRightClick={() => adjustDungeon(acc.id, server, +1)} />
        <CounterPill icon="🐾" label="" value={String(shugo)} done={shugo <= 0}
          onClick={() => adjustTicket(acc.id, server, "shugo", -1)}
          onRightClick={() => adjustTicket(acc.id, server, "shugo", +1)} />
        <CounterPill icon="🌙" label="" value={String(invasion)} done={invasion <= 0}
          onClick={() => adjustTicket(acc.id, server, "invasion", -1)}
          onRightClick={() => adjustTicket(acc.id, server, "invasion", +1)} />
      </div>

      {/* 캐릭터 테이블 */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/10 text-[10px] text-muted-foreground">
            <tr>
              <th className="text-left px-2 py-1.5">캐릭터</th>
              <th className="text-center px-2 py-1.5">CP<br/>IL</th>
              <th className="text-center px-2 py-1.5">🔷 오드</th>
              {RAID_DEF.map((r) => (
                <th key={r.key} className="text-center px-2 py-1.5">{r.icon} {r.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {chars.map((c) => (
              <CharRow key={c.id} char={c} showReward={showReward} showBoss={showBoss} showDone={showDone} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KinaPill({ icon, label, value, pct, onAdjust }: {
  icon: string; label: string; value: number; pct: number; onAdjust: (d: -1 | 1) => void;
}) {
  const pctClass = pct >= 100 ? "text-emerald-400" : pct >= 80 ? "text-amber-400" : pct >= 60 ? "text-rose-400" : "text-slate-400";
  return (
    <button
      onClick={(e) => { e.preventDefault(); onAdjust(-1); }}
      onContextMenu={(e) => { e.preventDefault(); onAdjust(+1); }}
      className="inline-flex items-center gap-1.5 px-2 py-1 rounded border hover:bg-accent/10"
      title="좌:-1 / 우:+1"
    >
      <span>{icon}</span>
      <span className="text-muted-foreground">{label}</span>
      <span className="font-extrabold tabular-nums">{value}</span>
      <span className={cn("font-bold tabular-nums", pctClass)}>{pct}%</span>
    </button>
  );
}

function CounterPill({ icon, label, value, done, onClick, onRightClick }: {
  icon: string; label: string; value: string; done?: boolean; onClick: () => void; onRightClick: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.preventDefault(); onClick(); }}
      onContextMenu={(e) => { e.preventDefault(); onRightClick(); }}
      className={cn(
        "inline-flex items-center gap-1 px-2 py-1 rounded border hover:bg-accent/10",
        done && "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
      )}
      title="좌:-1 / 우:+1"
    >
      <span>{icon}</span>
      {label && <span className="text-muted-foreground">{label}</span>}
      <span className="font-extrabold tabular-nums">{value}</span>
    </button>
  );
}

function CharRow({ char: c, showReward, showBoss, showDone }: { char: Character; showReward: boolean; showBoss: boolean; showDone: boolean }) {
  const accounts = useBarrackStore((s) => s.accounts);
  const db = useBarrackStore((s) => s.dbSettings);
  const doRaid = useBarrackStore((s) => s.doRaid);
  const cls = CLASS_MAP[c.classId];
  const odMax = computeOdMax(c, accounts, db);
  const odTotal = (c.od || 0) + (c.odExtra || 0);
  const runs = Math.floor(odTotal / 80);
  const odPct = odMax > 0 ? Math.min(100, Math.round(((c.od || 0) / odMax) * 100)) : 0;
  const odLow = odPct < 25;
  const odFull = odPct >= 100;
  const profileUrl = charProfileUrl(c, db);

  return (
    <tr className="border-t hover:bg-accent/5">
      {/* 캐릭터 */}
      <td className="px-2 py-1.5">
        <div className="flex items-center gap-1.5">
          <span className="w-1 h-7 rounded" style={{ background: cls?.color }} />
          <div className="flex flex-col items-center gap-0.5 min-w-[40px]">
            {profileUrl ? (
              <a href={profileUrl} target="_blank" rel="noopener noreferrer" className="text-base" title="아툴사이트" onClick={(e) => e.stopPropagation()} style={{ color: cls?.color }}>
                {cls?.icon ?? "?"}
              </a>
            ) : (
              <span className="text-base" style={{ color: cls?.color }}>{cls?.icon ?? "?"}</span>
            )}
            <span className="text-[9px] font-bold" style={{ color: cls?.color }}>{cls?.name ?? ""}</span>
          </div>
          <span className="font-bold truncate">{c.name}</span>
        </div>
      </td>
      {/* CP/IL */}
      <td className="px-2 py-1.5 text-center">
        <div className="font-extrabold tabular-nums text-gold-light">{fmtN(c.cp || 0)}</div>
        <div className="text-[10px] text-muted-foreground tabular-nums">{c.itemLevel || "-"}</div>
      </td>
      {/* 오드 */}
      <td className="px-2 py-1.5">
        <div className="flex flex-col items-center min-w-[100px]">
          <div className="w-full h-1 rounded bg-muted/30 overflow-hidden">
            <div
              className={cn("h-full transition-all", odFull ? "bg-emerald-400" : odLow ? "bg-rose-400" : "bg-cat-arcana")}
              style={{ width: `${odPct}%` }}
            />
          </div>
          <div className="flex items-baseline gap-1 tabular-nums">
            <span className={cn("font-extrabold", odLow && "text-rose-400")}>{fmtN(c.od || 0)}</span>
            {(c.odExtra || 0) > 0 && <span className="text-emerald-400 text-[10px]">+{fmtN(c.odExtra || 0)}</span>}
            <span className="text-[10px] text-muted-foreground">{runs}회분</span>
          </div>
        </div>
      </td>
      {/* 레이드 */}
      {RAID_DEF.map((r) => (
        <RaidCell key={r.key} char={c} raidKey={r.key} doRaid={doRaid} showReward={showReward} showBoss={showBoss} showDone={showDone} />
      ))}
    </tr>
  );
}

function RaidCell({
  char: c, raidKey, doRaid, showReward, showBoss, showDone,
}: {
  char: Character;
  raidKey: RaidKey;
  doRaid: (charId: string, raidKey: RaidKey, target: "reward" | "boss" | "both", delta: -1 | 1) => void;
  showReward: boolean;
  showBoss: boolean;
  showDone: boolean;
}) {
  const ct = c[raidKey];
  if (c.hiddenContents?.[raidKey]) {
    return <td className="px-1 py-1.5 text-center text-muted-foreground/50">[ − ]</td>;
  }
  if (!ct) {
    return <td className="px-1 py-1.5 text-center text-muted-foreground">-</td>;
  }
  const rv = ct.reward;
  const bv = ct.boss;
  const rEx = ct.rewardExtra || 0;
  const bEx = ct.bossExtra || 0;
  const rB = ct.rewardBase || 0;
  const bB = ct.bossBase || 0;
  const rDone = rv + rEx <= 0;
  const bDone = bv + bEx <= 0;

  if (!showDone && rDone && bDone) {
    return <td className="px-1 py-1.5 text-center text-muted-foreground/50 text-[10px]">완료</td>;
  }

  return (
    <td className="px-1 py-1.5 text-center">
      <div className="flex items-center justify-center gap-0.5">
        {showReward && (
          <RaidBox
            label="reward"
            value={rv}
            extra={rEx}
            base={rB}
            done={rDone}
            color="amber"
            onClick={() => doRaid(c.id, raidKey, "reward", -1)}
            onRightClick={() => doRaid(c.id, raidKey, "reward", +1)}
            title={`보상 ${rv}/${rB}`}
          />
        )}
        {showBoss && (
          <RaidBox
            label="boss"
            value={bv}
            extra={bEx}
            base={bB}
            done={bDone}
            color="rose"
            onClick={() => doRaid(c.id, raidKey, "boss", -1)}
            onRightClick={() => doRaid(c.id, raidKey, "boss", +1)}
            title={`보스 ${bv}/${bB}`}
          />
        )}
      </div>
    </td>
  );
}

function RaidBox({
  value, extra, base, done, color, onClick, onRightClick, title,
}: {
  label: string;
  value: number;
  extra: number;
  base: number;
  done: boolean;
  color: "amber" | "rose";
  onClick: () => void;
  onRightClick: () => void;
  title: string;
}) {
  const cls = done
    ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
    : value < base
    ? color === "amber"
      ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
      : "bg-rose-500/20 text-rose-300 border-rose-500/40"
    : "bg-background/40 text-muted-foreground border-border";
  return (
    <button
      onClick={(e) => { e.preventDefault(); onClick(); }}
      onContextMenu={(e) => { e.preventDefault(); onRightClick(); }}
      className={cn("min-w-[36px] px-1.5 py-0.5 rounded border text-xs font-extrabold tabular-nums leading-tight", cls)}
      title={`${title} (좌:-1 / 우:+1)`}
    >
      {value}
      {extra > 0 && <sup className="text-[9px] text-cat-arcana ml-0.5">+{extra}</sup>}
    </button>
  );
}
