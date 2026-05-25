"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { ARCANA_ORDER, SETS } from "@/lib/arcana/constants";
import { ArcanaRow } from "./arcana-row";
import { ArcanaSkillPickerDialog } from "./arcana-skill-picker";
import { cn } from "@/lib/utils";
import type { ArcanaCard } from "@/lib/arcana/types";
import { confirmDialog } from "@/lib/util/confirm";

type ClipboardState = {
  sourceCardId: string;
  sourceName: string;
  skillsByJob: Record<string, string[]>;
};

/** V4.0.9 renderArcanaDbEditor 포팅 — 세트별 그룹 카드 + 미분류 */
export function ArcanaDbEditor() {
  const cards = useArcanaStore((s) => s.cards);
  const patchCard = useArcanaStore((s) => s.patchCard);
  const resetSeed = useArcanaStore((s) => s.resetSeed);

  const [expandedSets, setExpandedSets] = useState<Record<string, boolean>>({});
  const [clipboard, setClipboard] = useState<ClipboardState | null>(null);
  const [pickerCardId, setPickerCardId] = useState<string | null>(null);

  const bySet = useMemo(() => {
    const m: Record<string, ArcanaCard[]> = {};
    for (const s of SETS) m[s.code] = [];
    for (const c of cards) {
      if (m[c.setKey]) m[c.setKey].push(c);
    }
    return m;
  }, [cards]);

  const aliens = useMemo(
    () => cards.filter((c) => !SETS.find((s) => s.code === c.setKey)),
    [cards]
  );

  function toggleSet(code: string) {
    setExpandedSets((s) => ({ ...s, [code]: !s[code] }));
  }

  function handleCopy(card: ArcanaCard) {
    setClipboard({
      sourceCardId: card.id,
      sourceName: card.name,
      skillsByJob: JSON.parse(JSON.stringify(card.skillsByJob || {})),
    });
  }
  async function handlePaste(card: ArcanaCard) {
    if (!clipboard) return;
    if (!(await confirmDialog({
      title: "스킬 설정 덮어쓰기",
      description: `'${card.name}' 의 기존 적용 스킬을 '${clipboard.sourceName}' 의 설정으로 대체할까요?\n(기존 데이터는 사라집니다)`,
      confirmText: "덮어쓰기",
      variant: "destructive",
    }))) return;
    patchCard(card.id, { skillsByJob: JSON.parse(JSON.stringify(clipboard.skillsByJob || {})) });
  }

  return (
    <div className="space-y-3">
      {/* 툴바 */}
      <div className="flex items-center gap-2 flex-wrap p-2 rounded border border-cat-arcana/30 bg-cat-arcana/5">
        <span className="text-xs text-muted-foreground">아르카나 카드 마스터 — 42장 (7세트 × 6슬롯)</span>
        {clipboard && (
          <span className="text-[11px] text-cat-arcana">
            📋 클립보드: <b>{clipboard.sourceName}</b>
            <button
              onClick={() => setClipboard(null)}
              className="ml-1 opacity-60 hover:opacity-100 hover:text-destructive"
              title="클립보드 비우기"
            >✕</button>
          </span>
        )}
        <span className="flex-1" />
        <Button
          size="sm"
          variant="ghost"
          onClick={async () => {
            if (!(await confirmDialog({
              title: "카드 DB 초기화",
              description: "아르카나 카드 DB를 시드 기본값으로 초기화합니다.\n사용자 편집 내용이 사라집니다.",
              confirmText: "초기화",
              variant: "destructive",
            }))) return;
            resetSeed();
          }}
          className="text-amber-500 border border-amber-500/40"
          title="모든 카드를 시드 기본값으로 초기화"
        >
          시드 리셋
        </Button>
      </div>

      {/* 세트별 그룹 */}
      {SETS.map((set) => {
        const list = bySet[set.code] || [];
        const expanded = !!expandedSets[set.code];
        // 슬롯 순서대로 정렬 (Grail → Libra) + 그 외 잔여
        const sorted = ARCANA_ORDER
          .map((sc) => list.find((c) => c.slot === sc))
          .filter((c): c is ArcanaCard => !!c);
        const extras = list.filter((c) => !ARCANA_ORDER.includes(c.slot as never));
        const ordered = [...sorted, ...extras];

        return (
          <div key={set.code} className={cn("rounded-lg border bg-card overflow-hidden", expanded && "border-cat-arcana/50")}>
            <button
              onClick={() => toggleSet(set.code)}
              className="w-full flex items-center gap-2 px-3 py-2 bg-cat-arcana/10 hover:bg-cat-arcana/20 transition-colors"
            >
              <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-cat-arcana/30 text-cat-arcana tabular-nums">
                {set.season}
              </span>
              <span className="text-base font-extrabold flex-1 text-left">{set.name}</span>
              <span className="text-xs text-muted-foreground">{list.length}장</span>
              <span className="text-xs">{expanded ? "▲" : "▼"}</span>
            </button>
            {expanded && (
              <div className="p-2 space-y-1.5">
                {ordered.length === 0 ? (
                  <div className="text-center text-xs text-muted-foreground italic py-3">카드 없음</div>
                ) : (
                  ordered.map((c) => (
                    <ArcanaRow
                      key={c.id}
                      card={c}
                      clipboard={clipboard}
                      onCopySkills={handleCopy}
                      onPasteSkills={handlePaste}
                      onOpenSkillPicker={(id) => setPickerCardId(id)}
                    />
                  ))
                )}
              </div>
            )}
          </div>
        );
      })}

      {/* 미분류 카드 */}
      {aliens.length > 0 && (
        <div className="rounded-lg border bg-card overflow-hidden">
          <div className="flex items-center gap-2 px-3 py-2 bg-muted/30">
            <span className="text-base font-extrabold flex-1">(미분류 세트)</span>
            <span className="text-xs text-muted-foreground">{aliens.length}장</span>
          </div>
          <div className="p-2 space-y-1.5">
            {aliens.map((c) => (
              <ArcanaRow
                key={c.id}
                card={c}
                clipboard={clipboard}
                onCopySkills={handleCopy}
                onPasteSkills={handlePaste}
                onOpenSkillPicker={(id) => setPickerCardId(id)}
              />
            ))}
          </div>
        </div>
      )}

      <ArcanaSkillPickerDialog
        open={!!pickerCardId}
        cardId={pickerCardId}
        onClose={() => setPickerCardId(null)}
      />
    </div>
  );
}
