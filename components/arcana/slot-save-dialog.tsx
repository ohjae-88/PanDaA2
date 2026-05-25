"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useArcanaStore } from "@/lib/arcana/arcana-store";
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { resolveSlotCard } from "@/lib/arcana/compute";
import { ARCANA_KO } from "@/lib/arcana/constants";
import { confirmDialog } from "@/lib/util/confirm";

type Props = {
  open: boolean;
  buildId: string;
  slotKey: string;
  charId: string | null;
  onClose: () => void;
};

/** V4.0.9 openSlotSaveModal 포팅 — 현재 슬롯 상태를 보유/계획 카드로 저장.
 *  - 수정 : 원본 owned 카드에 덮어쓰기 (slot이 owned 참조 시만 활성)
 *  - 신규 보유 : 새 owned 카드 생성 (level ≥ 1)
 *  - 계획 : 새 계획 카드 생성 (level = 0)
 *  저장 후 슬롯을 새/기존 ownedCardId로 리셋. */
export function SlotSaveDialog({ open, buildId, slotKey, charId, onClose }: Props) {
  const arcana = useArcanaStore((s) => s.cards);
  const owned = useOwnedStore((s) => s.ownedCards);
  const addOwned = useOwnedStore((s) => s.addOwned);
  const patchOwned = useOwnedStore((s) => s.patchOwned);
  const build = useArcanaBuildStore((s) => s.builds.find((b) => b.id === buildId)) || null;
  const patchSlot = useArcanaBuildStore((s) => s.patchSlot);

  if (!build) return null;
  const entry = build.slots[slotKey];
  const r = resolveSlotCard(entry, arcana, owned);
  if (!r.master) return null;

  // 원본 owned 카드 (수정 대상) — slot이 owned 참조 시만
  const targetOwned = r.source === "owned" && entry?.ownedCardId
    ? owned.find((o) => o.id === entry.ownedCardId) || null
    : null;

  /** 현재 슬롯 effective 상태 — 저장에 사용 */
  function snapshot() {
    return {
      masterId: r.master!.id,
      level: r.level || 0,
      gains: {
        stats: { ...(r.gains.stats || {}) },
        skills: { ...(r.gains.skills || {}) },
      },
      enabledSkills: [...(r.enabledSkills || [])],
    };
  }

  async function doModify() {
    if (!targetOwned) return;
    const isPlan = (targetOwned.level || 0) === 0;
    if (!(await confirmDialog({ title: "원본 카드 덮어쓰기", description: `원본 ${isPlan ? "계획" : "보유"} 카드에 현재 슬롯 상태를 덮어씁니다.`, confirmText: "덮어쓰기" }))) return;
    const snap = snapshot();
    patchOwned(targetOwned.id, {
      level: snap.level,
      gains: snap.gains,
      enabledSkills: snap.enabledSkills,
    });
    // 슬롯을 해당 owned 참조로 리셋 — entry-only 분배 클리어
    patchSlot(buildId, slotKey, {
      ownedCardId: targetOwned.id,
      masterId: null,
      level: 0,
      gains: { stats: {}, skills: {} },
      enabledSkills: [],
    });
    onClose();
  }

  function doSaveAs(kind: "owned" | "plan") {
    const snap = snapshot();
    const newCard = addOwned({
      masterId: snap.masterId,
      level: kind === "plan" ? 0 : Math.max(1, snap.level),
      charId: charId ?? null,
      gains: snap.gains,
      enabledSkills: snap.enabledSkills,
      note: "",
    });
    patchSlot(buildId, slotKey, {
      ownedCardId: newCard.id,
      masterId: null,
      level: 0,
      gains: { stats: {}, skills: {} },
      enabledSkills: [],
    });
    onClose();
  }

  const slotName = ARCANA_KO[slotKey] || slotKey;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md p-4 gap-3">
        <DialogHeader>
          <DialogTitle>💾 슬롯 저장 — {slotName}</DialogTitle>
        </DialogHeader>
        <div className="text-xs text-muted-foreground">
          대상: <b>{r.master.name}</b> (Lv.{r.level})
        </div>
        <div className="flex flex-col gap-2">
          {/* 수정 — 원본 덮어쓰기 */}
          <button
            onClick={doModify}
            disabled={!targetOwned}
            className="w-full text-left rounded border border-cat-arcana/40 bg-cat-arcana/10 hover:bg-cat-arcana/20 disabled:opacity-40 disabled:hover:bg-cat-arcana/10 px-3 py-2 transition-colors"
            title={targetOwned
              ? "원본 카드의 레벨/옵션/분배를 현재 슬롯 상태로 덮어씁니다."
              : "이 슬롯은 보유/계획 카드에서 분리된 상태가 아닙니다."}
          >
            <div className="font-extrabold text-sm text-cat-arcana">
              ✎ 수정 — 원본 카드에 덮어쓰기
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {targetOwned
                ? `원본 ${(targetOwned.level || 0) === 0 ? "계획" : "보유"} 카드에 덮어씁니다.`
                : "덮어쓸 원본 없음 — 임의 모드 슬롯은 신규 저장만 가능합니다."}
            </div>
          </button>

          {/* 신규 보유 */}
          <button
            onClick={() => doSaveAs("owned")}
            className="w-full text-left rounded border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-3 py-2 transition-colors"
            title="현재 슬롯 상태를 새 보유 카드로 저장합니다."
          >
            <div className="font-extrabold text-sm text-emerald-400">
              📚 신규 보유 — 새 보유 카드로 저장
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              새 카드 생성 후 슬롯을 새 카드 참조로 변경합니다.
            </div>
          </button>

          {/* 계획 */}
          <button
            onClick={() => doSaveAs("plan")}
            className="w-full text-left rounded border border-border bg-background/40 hover:bg-accent/10 px-3 py-2 transition-colors"
            title="현재 슬롯 상태를 새 계획 카드(Lv.0)로 저장합니다."
          >
            <div className="font-extrabold text-sm text-foreground">
              📋 계획 — 새 계획 카드로 저장
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              미보유 계획 카드 (Lv.0) 생성. 옵션/분배만 보존.
            </div>
          </button>
        </div>
        <div className="flex justify-end gap-2 pt-2 border-t border-border">
          <button
            onClick={onClose}
            className="px-3 py-1.5 rounded border text-xs font-bold hover:bg-accent/15"
          >
            취소
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
