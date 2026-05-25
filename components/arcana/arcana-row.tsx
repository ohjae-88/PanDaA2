"use client";

import { useState } from "react";
import { Pencil, Trash2, Clipboard, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import {
  ARCANA_KO,
  ARCANA_STAT_KEYS,
  BASE_STAT_VALUE,
  GRADES,
  GRADE_KO,
  STAT_LABEL,
  SET_LEVELUP_POLICY,
  arcanaIconUrl,
} from "@/lib/arcana/constants";
import { cn } from "@/lib/utils";
import type { ArcanaCard } from "@/lib/arcana/types";
import { totalSkillsByJobCount } from "./arcana-skill-picker";
import { confirmDialog } from "@/lib/util/confirm";

type ClipboardState = {
  sourceCardId: string;
  sourceName: string;
  skillsByJob: Record<string, string[]>;
};

type Props = {
  card: ArcanaCard;
  clipboard: ClipboardState | null;
  onCopySkills: (card: ArcanaCard) => void;
  onPasteSkills: (card: ArcanaCard) => void;
  onOpenSkillPicker: (cardId: string) => void;
};

/** V4.0.9 renderArcanaRow 포팅 — 단일 카드 행 */
export function ArcanaRow({ card, clipboard, onCopySkills, onPasteSkills, onOpenSkillPicker }: Props) {
  const patch = useArcanaStore((s) => s.patchCard);
  const remove = useArcanaStore((s) => s.removeCard);
  const [editingMeta, setEditingMeta] = useState(false);

  const totalSkills = totalSkillsByJobCount(card);
  const statsKeys = Object.keys(card.stats || {});
  const available = ARCANA_STAT_KEYS.filter((k) => !(k in (card.stats || {})));

  function addStat(key: string) {
    if (!key) return;
    patch(card.id, { stats: { ...(card.stats || {}), [key]: BASE_STAT_VALUE } });
  }
  function setStatVal(key: string, val: number) {
    patch(card.id, { stats: { ...(card.stats || {}), [key]: val } });
  }
  function removeStat(key: string) {
    const next = { ...(card.stats || {}) };
    delete next[key];
    patch(card.id, { stats: next });
  }
  function setGrade(g: string) {
    const patches: Partial<ArcanaCard> = { grade: g };
    // 아이콘 자동 갱신 (Icon_Arcana_Card_* 패턴일 때만)
    if (card.icon && card.icon.includes("Icon_Arcana_Card_")) {
      patches.icon = arcanaIconUrl(card.slot, g, card.setKey);
    }
    patch(card.id, patches);
  }
  function setLevelUp(key: "skillPoint" | "statPoint", val: number) {
    const lv = { ...(card.levelUp || { skillPoint: 0, statPoint: 0 }), [key]: val };
    patch(card.id, { levelUp: lv });
  }
  async function handleDelete() {
    if (!(await confirmDialog({
      title: "카드 삭제",
      description: `'${card.name}' 카드를 삭제하시겠습니까?`,
      confirmText: "삭제",
      variant: "destructive",
    }))) return;
    remove(card.id);
  }

  const isClipSelf = !!clipboard && clipboard.sourceCardId === card.id;

  return (
    <div className="border rounded bg-card/50 px-2 py-2">
      <div className="flex items-center gap-2 flex-wrap">
        {/* 아이콘 */}
        {card.icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.icon}
            alt=""
            className="w-10 h-10 rounded flex-shrink-0"
            loading="lazy"
            onError={(e) => { (e.currentTarget as HTMLImageElement).style.opacity = "0.2"; }}
          />
        ) : (
          <div className="w-10 h-10 rounded flex items-center justify-center bg-muted/40 flex-shrink-0">🃏</div>
        )}

        {/* 슬롯명 */}
        <span className="font-extrabold text-sm w-14">{ARCANA_KO[card.slot] || card.slot}</span>

        {/* 등급 */}
        <select
          value={card.grade}
          onChange={(e) => setGrade(e.target.value)}
          className="px-1 py-0.5 rounded border bg-background text-xs"
        >
          {GRADES.map((g) => <option key={g} value={g}>{GRADE_KO[g]}</option>)}
        </select>

        {/* 스텟 칩 */}
        <div className="flex items-center gap-1 flex-wrap flex-1 min-w-0">
          {statsKeys.length === 0 && (
            <span className="text-[10px] text-muted-foreground italic">스텟 없음</span>
          )}
          {statsKeys.map((k) => (
            <div key={k} className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-cat-arcana/30 bg-cat-arcana/5 text-xs">
              <span className="font-bold text-cat-arcana">{STAT_LABEL[k] || k}</span>
              <Input
                type="number"
                min={0}
                max={9999}
                value={card.stats[k]}
                onChange={(e) => setStatVal(k, parseInt(e.target.value) || 0)}
                className="h-6 w-14 text-xs px-1 tabular-nums"
              />
              <button
                onClick={() => removeStat(k)}
                className="text-muted-foreground hover:text-destructive"
                title={`${STAT_LABEL[k] || k} 제거`}
              >✕</button>
            </div>
          ))}
          {available.length > 0 && (
            <select
              value=""
              onChange={(e) => { addStat(e.target.value); e.target.value = ""; }}
              className="px-1 py-0.5 rounded border bg-background text-xs"
            >
              <option value="">＋ 스텟 추가</option>
              {available.map((k) => <option key={k} value={k}>{STAT_LABEL[k] || k}</option>)}
            </select>
          )}
        </div>

        {/* 레벨업 미니칩 */}
        <span
          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded border text-[10px] tabular-nums"
          title={`1레벨업당 추가: 스킬포인트 +${card.levelUp.skillPoint || 0}, 스텟포인트 +${card.levelUp.statPoint || 0}`}
        >
          Lv+ <b>⚡+{card.levelUp.skillPoint || 0}</b> <b>📈+{card.levelUp.statPoint || 0}</b>
        </span>

        {/* 적용 스킬 편집 */}
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onOpenSkillPicker(card.id)}
          className="border border-cat-arcana/40 text-cat-arcana"
        >
          🃏 적용 스킬 ({totalSkills})
        </Button>

        {/* 클립보드 — 복사 */}
        <Button
          size="xs"
          variant="ghost"
          onClick={() => onCopySkills(card)}
          className="text-muted-foreground"
          title="이 카드의 직업별 적용 스킬을 클립보드에 복사"
        >
          <Clipboard className="h-3 w-3" />
        </Button>

        {/* 클립보드 — 붙여넣기 (있을 때만) */}
        {clipboard && (
          <Button
            size="xs"
            variant="ghost"
            onClick={() => onPasteSkills(card)}
            className={cn(
              "border",
              isClipSelf ? "border-amber-500/40 text-amber-500" : "border-cat-arcana/40 text-cat-arcana"
            )}
            title={isClipSelf
              ? "복사 출처와 동일한 카드 — 자기 자신으로 덮어쓰기"
              : `'${clipboard.sourceName}' 의 적용 스킬로 대체 붙여넣기`}
          >
            <ClipboardPaste className="h-3 w-3" /> 붙여넣기
          </Button>
        )}

        {/* 메타 편집 토글 */}
        <Button
          size="xs"
          variant="ghost"
          onClick={() => setEditingMeta((v) => !v)}
          title="카드명 / 아이콘URL / ID / 레벨업 포인트 편집"
        >
          {editingMeta ? "✕" : <Pencil className="h-3 w-3" />}
        </Button>

        {/* 삭제 */}
        <Button
          size="xs"
          variant="ghost"
          onClick={handleDelete}
          className="text-destructive"
          title="카드 삭제"
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>

      {/* 메타 편집 영역 */}
      {editingMeta && (
        <div className="mt-2 pt-2 border-t border-cat-arcana/20 grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">카드명</div>
            <Input
              value={card.name}
              onChange={(e) => patch(card.id, { name: e.target.value })}
              className="h-7"
            />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">아이콘 URL</div>
            <Input
              value={card.icon}
              onChange={(e) => patch(card.id, { icon: e.target.value })}
              className="h-7"
            />
          </div>
          <div>
            <div className="text-[10px] text-muted-foreground mb-0.5">카드 ID</div>
            <Input
              value={card.id}
              onChange={(e) => patch(card.id, { id: e.target.value })}
              className="h-7"
            />
          </div>
          <div className="flex items-center gap-2">
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground mb-0.5">스킬+ /Lv</div>
              <Input
                type="number"
                min={0} max={99}
                value={card.levelUp.skillPoint || 0}
                onChange={(e) => setLevelUp("skillPoint", parseInt(e.target.value) || 0)}
                className="h-7 w-20 tabular-nums"
              />
            </div>
            <div className="flex-1">
              <div className="text-[10px] text-muted-foreground mb-0.5">스텟+ /Lv</div>
              <Input
                type="number"
                min={0} max={99}
                value={card.levelUp.statPoint || 0}
                onChange={(e) => setLevelUp("statPoint", parseInt(e.target.value) || 0)}
                className="h-7 w-20 tabular-nums"
              />
            </div>
            <Button
              size="xs"
              variant="ghost"
              onClick={() => {
                const policy = SET_LEVELUP_POLICY[card.setKey] || { skillPoint: 0, statPoint: 0 };
                patch(card.id, { levelUp: { ...policy } });
              }}
              className="text-[10px]"
              title="세트 기본 정책으로 복원"
            >
              ↺ 세트 기본
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
