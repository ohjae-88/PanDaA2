"use client";

import { useMemo } from "react";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useSkillStore } from "@/lib/arcana/skill-store";
import {
  ARCANA_KO,
  ARCANA_ORDER,
  STAT_LABEL,
} from "@/lib/arcana/constants";
import { resolveSlotCard, summarizeCardSkillPools } from "@/lib/arcana/compute";
import type { ArcanaBuild } from "@/lib/arcana/types";
import { cn } from "@/lib/utils";

/** V4.0.9 renderCardDistrib / renderCardDistribPanel 포팅 —
 *  6슬롯 카드별 투자 총량(스킬+스텟) + 가용 풀 표시. */
export function CardDistribPanel({ build, jobId }: { build: ArcanaBuild; jobId: string }) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  const skills = useSkillStore((s) => s.skills);

  const rows = useMemo(() => {
    return ARCANA_ORDER.map((slotKey) => {
      const entry = build.slots[slotKey];
      const r = resolveSlotCard(entry, arcana, owned);
      return { slotKey, ...r };
    });
  }, [build, arcana, owned]);

  return (
    <div className="rounded-lg border bg-card p-3 space-y-2">
      <div className="text-xs font-extrabold text-muted-foreground">📊 카드별 분배</div>
      <div className="overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-muted/30">
            <tr>
              <th className="text-left px-2 py-1 w-[80px]">슬롯</th>
              <th className="text-left px-2 py-1">카드</th>
              <th className="text-right px-2 py-1 w-[60px]">Lv</th>
              <th className="text-right px-2 py-1 w-[110px]">⚡ 스킬</th>
              <th className="text-right px-2 py-1 w-[110px]">📈 스텟</th>
              <th className="text-left px-2 py-1">투자 항목</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const slotLabel = ARCANA_KO[r.slotKey] || r.slotKey;
              if (!r.master) {
                return (
                  <tr key={r.slotKey} className="border-t opacity-60">
                    <td className="px-2 py-1 font-bold">{slotLabel}</td>
                    <td colSpan={5} className="px-2 py-1 text-muted-foreground italic">— 비어있음 —</td>
                  </tr>
                );
              }
              const m = r.master;
              const policy = m.levelUp || { skillPoint: 0, statPoint: 0 };
              const lv = r.level || 0;
              const skillPool = lv * (policy.skillPoint || 0);
              const statPool = lv * (policy.statPoint || 0);
              const usedSkill = Object.values(r.gains.skills || {}).reduce((n, v) => n + (Number(v) || 0), 0);
              const usedStat = Object.values(r.gains.stats || {}).reduce((n, v) => n + (Number(v) || 0), 0);
              const remainingSkill = skillPool - usedSkill;
              const remainingStat = statPool - usedStat;

              // 투자 항목 — 스킬명 + 점수
              const skillEntries = Object.entries(r.gains.skills || {}).filter(([, v]) => v > 0);
              const statEntries = Object.entries(r.gains.stats || {}).filter(([, v]) => v > 0);
              const items: React.ReactNode[] = [];
              const supportedPool = summarizeCardSkillPools(m, jobId, skills);
              for (const [sid, v] of skillEntries) {
                const sk = supportedPool.find((x) => x.id === sid) ?? skills.find((x) => x.id === sid);
                if (!sk) continue;
                items.push(
                  <span key={"sk_" + sid} className="inline-flex items-center gap-1 px-1 py-0.5 rounded border border-cat-arcana/30 bg-cat-arcana/5 text-[10px]">
                    ⚡ {sk.name} <b className="text-cat-arcana">+{v}</b>
                  </span>
                );
              }
              for (const [k, v] of statEntries) {
                items.push(
                  <span key={"st_" + k} className="inline-flex items-center gap-1 px-1 py-0.5 rounded border border-cat-arcana/30 bg-cat-arcana/5 text-[10px]">
                    📈 {STAT_LABEL[k] || k} <b className="text-cat-arcana">+{v}</b>
                  </span>
                );
              }

              return (
                <tr key={r.slotKey} className="border-t">
                  <td className="px-2 py-1 font-bold">{slotLabel}</td>
                  <td className="px-2 py-1">
                    <div className="flex items-center gap-1.5">
                      {m.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.icon} alt="" className="w-6 h-6 rounded" loading="lazy" />
                      ) : (
                        <span className="w-6 h-6 flex items-center justify-center bg-muted/40 rounded text-xs">🃏</span>
                      )}
                      <span className="truncate">{m.name}</span>
                    </div>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums">{lv}/{m.maxLv}</td>
                  <td className={cn("px-2 py-1 text-right tabular-nums", remainingSkill < 0 && "text-rose-400")}>
                    {usedSkill}/{skillPool}
                    <span className="text-[9px] text-muted-foreground ml-1">({remainingSkill})</span>
                  </td>
                  <td className={cn("px-2 py-1 text-right tabular-nums", remainingStat < 0 && "text-rose-400")}>
                    {usedStat}/{statPool}
                    <span className="text-[9px] text-muted-foreground ml-1">({remainingStat})</span>
                  </td>
                  <td className="px-2 py-1">
                    {items.length === 0 ? (
                      <span className="text-[10px] text-muted-foreground italic">분배 없음</span>
                    ) : (
                      <div className="flex flex-wrap gap-1">{items}</div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
