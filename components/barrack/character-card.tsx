"use client";

import { useState } from "react";
import { Pencil, EyeOff, Eye, Shirt, Search } from "lucide-react";
import type { Character } from "@/lib/barrack/types";
import { useBarrackStore, computeOdMax } from "@/lib/barrack/store";
import { CLASSES } from "@/lib/barrack/constants";
import { fmtN } from "@/lib/barrack/time";
import { charProfileUrl } from "@/lib/barrack/profile-url";
import { cn } from "@/lib/utils";
import {
  RaidBox, ShopBox, CorridorBox, NightmareBox, AwakeningBox, HiddenPlaceholder,
} from "./content-boxes";

const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

type Props = {
  char: Character;
  onEdit: (id: string) => void;
  onCorridor?: (id: string) => void;
  onOdEdit?: (id: string) => void;
  onEquip?: (id: string) => void;
  draggable?: boolean;
  onDragStart?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDragOver?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  onDrop?: (e: React.DragEvent<HTMLDivElement>, id: string) => void;
  isDragging?: boolean;
  isDragOver?: boolean;
};

export function CharacterCard({
  char, onEdit, onCorridor, onOdEdit, onEquip,
  draggable, onDragStart, onDragOver, onDrop, isDragging, isDragOver,
}: Props) {
  const patch = useBarrackStore((s) => s.patchCharacter);
  const toggleHidden = useBarrackStore((s) => s.toggleCharHidden);
  const db = useBarrackStore((s) => s.dbSettings);
  const accounts = useBarrackStore((s) => s.accounts);
  const [quickEdit, setQuickEdit] = useState<null | "cp" | "ilvl">(null);
  const [quickValue, setQuickValue] = useState("");

  const cls = CLASS_MAP[char.classId] || { icon: "❓", name: "?", color: "#666" };
  const profileUrl = charProfileUrl(char, db);
  const cidPresent = !!(char.characterId || char.cid);
  const od = char.od || 0;
  const odMax = computeOdMax(char, accounts, db);
  const odEx = char.odExtra || 0;
  const total = od + odEx;
  const runs = Math.floor(total / 80);
  const pBase = Math.min(100, Math.round((od / odMax) * 100));
  const pExtra = odEx > 0 ? Math.min(100, Math.round((odEx / odMax) * 100)) : 0;
  const baseFillCls = pBase >= 100 ? "bg-emerald-400" : pBase < 25 ? "bg-rose-400" : "bg-cat-barrack";

  function startQuickEdit(field: "cp" | "ilvl", e: React.MouseEvent) {
    e.stopPropagation();
    setQuickEdit(field);
    setQuickValue(String(field === "cp" ? (char.cp ?? 0) : (char.itemLevel ?? 0)));
  }
  function commitQuickEdit() {
    if (!quickEdit) return;
    const n = Number(quickValue);
    if (!isNaN(n) && n >= 0) {
      if (quickEdit === "cp") patch(char.id, { cp: n });
      else patch(char.id, { itemLevel: n });
    }
    setQuickEdit(null);
  }

  return (
    <div
      draggable={draggable}
      onDragStart={(e) => onDragStart?.(e, char.id)}
      onDragOver={(e) => onDragOver?.(e, char.id)}
      onDrop={(e) => onDrop?.(e, char.id)}
      className={cn(
        "grid border rounded-lg bg-card overflow-hidden transition-colors hover:bg-card/80",
        draggable && "cursor-grab active:cursor-grabbing",
        char.hidden && "opacity-50",
        isDragging && "opacity-40",
        isDragOver && "outline-2 outline-dashed outline-accent -outline-offset-2"
      )}
      style={{
        borderLeftColor: cls.color,
        borderLeftWidth: 4,
        // 캐릭명/OD 셀은 화면이 가로로 넓어질 때 최대 +50%까지 비례 확장.
        // 좁은 화면에서는 기본 220px/180px 유지. clamp(min, 비례, max).
        gridTemplateColumns: "clamp(220px, 18%, 330px) clamp(180px, 15%, 270px) minmax(0, 1fr) 72px",
      }}
    >
      {/* 좌측: 직업 아이콘 + 이름 + 전투력 */}
      <div className="flex items-center gap-3 px-3 py-3 border-r">
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="text-3xl flex-shrink-0 hover:brightness-125 transition-all"
            style={{ color: cls.color }}
            title={`aion2tool.com에서 ${char.name} 프로필 보기`}
          >
            {cls.icon}
          </a>
        ) : (
          <div className="text-3xl flex-shrink-0" style={{ color: cls.color }}>
            {cls.icon}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 min-w-0">
            {onEquip && (
              <button
                onClick={(e) => { e.stopPropagation(); onEquip(char.id); }}
                className="opacity-60 hover:opacity-100 hover:text-cat-arcana flex-shrink-0"
                title="장비 · 스킬 보기"
                style={{ color: cls.color }}
              >
                <Search className="h-4 w-4" />
              </button>
            )}
            <button
              className="font-extrabold text-lg hover:underline truncate text-left min-w-0 flex-1"
              onClick={() => onEdit(char.id)}
              style={{ color: cls.color }}
              title={char.name}
            >
              {char.name}
            </button>
          </div>
          <div className="flex flex-col gap-0.5 mt-1">
            {quickEdit === "cp" ? (
              <input
                autoFocus
                type="number"
                value={quickValue}
                onChange={(e) => setQuickValue(e.target.value)}
                onBlur={commitQuickEdit}
                onKeyDown={(e) => { if (e.key === "Enter") commitQuickEdit(); if (e.key === "Escape") setQuickEdit(null); }}
                className="w-24 px-1 border rounded bg-background tabular-nums text-base font-bold"
              />
            ) : (
              <button
                className="text-yellow-300 font-extrabold text-base tabular-nums hover:brightness-125 transition-all text-left"
                onClick={(e) => startQuickEdit("cp", e)}
                title="클릭하여 전투력 수정"
              >
                ⚔ {fmtN(char.cp)}
              </button>
            )}
            {quickEdit === "ilvl" ? (
              <input
                autoFocus
                type="number"
                value={quickValue}
                onChange={(e) => setQuickValue(e.target.value)}
                onBlur={commitQuickEdit}
                onKeyDown={(e) => { if (e.key === "Enter") commitQuickEdit(); if (e.key === "Escape") setQuickEdit(null); }}
                className="w-20 px-1 border rounded bg-background tabular-nums text-sm"
              />
            ) : (
              <button
                className="text-muted-foreground text-sm tabular-nums hover:text-foreground transition-colors text-left"
                onClick={(e) => startQuickEdit("ilvl", e)}
                title="클릭하여 아이템레벨 수정"
              >
                📦 {char.itemLevel || "-"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 중간: 배지 + 오드 바 (V4.0.9 동일 구조) */}
      <div className="flex flex-col gap-2 px-3 py-3 border-r min-w-0">
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border" style={{ color: cls.color, borderColor: `${cls.color}50`, background: `${cls.color}15` }}>
            {cls.icon} {cls.name}
          </span>
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border bg-muted/30 text-muted-foreground">
            Lv.{char.level}
          </span>
          {char.passes?.length > 0 && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded border border-gold/40 text-gold-light bg-gold/10" title={char.passes.join(", ")}>
              🎫 {char.passes.length}
            </span>
          )}
        </div>
        {/* OD 영역 (클릭 시 OD 수정 모달) */}
        <button
          type="button"
          onClick={() => onOdEdit?.(char.id)}
          title="클릭하여 오드 수정"
          className="flex flex-col gap-1 text-left rounded hover:bg-accent/5 -mx-1 px-1 py-0.5 transition-colors"
        >
          {/* 🔷 기본 오드 */}
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-muted-foreground">🔷 기본 오드</span>
            <span className="tabular-nums">
              <span className="font-bold text-cat-barrack">{fmtN(od)}</span>
              <span className="text-muted-foreground">/{fmtN(odMax)}</span>
              <span className="text-muted-foreground"> ({pBase}%)</span>
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className={cn("h-full transition-all", baseFillCls)} style={{ width: `${pBase}%` }} />
          </div>
          {/* 🔶 추가 오드 */}
          <div className="flex items-center justify-between text-[10px] mt-0.5">
            <span className="text-muted-foreground">🔶 추가 오드</span>
            <span className="tabular-nums">
              <span className="font-bold text-amber-400">{fmtN(odEx)}</span>
            </span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div className="h-full bg-amber-400 transition-all" style={{ width: `${pExtra}%` }} />
          </div>
          {/* ⚡ 총 오드 */}
          <div className="flex items-center justify-between text-xs mt-1 pt-1 border-t border-dotted">
            <span className="text-muted-foreground font-bold">⚡ 총 오드</span>
            <span className="tabular-nums">
              <span className="font-extrabold text-gold-light text-sm">{fmtN(total)}</span>
              <span className="text-muted-foreground text-[11px]"> ({runs}회분)</span>
            </span>
          </div>
        </button>
      </div>

      {/* 콘텐츠 그리드 — 8개 박스 1행 가로 배치 */}
      <div className="grid grid-cols-8 gap-1 p-1.5 min-w-0">
        {(["expedition", "transcend", "sanctuary_ludra", "sanctuary_bagot"] as const).map((rt) =>
          char.hiddenContents?.[rt]
            ? <HiddenPlaceholder key={rt} />
            : <RaidBox key={rt} char={char} raidKey={rt} />
        )}
        {char.hiddenContents?.shop      ? <HiddenPlaceholder /> : <ShopBox char={char} />}
        {char.hiddenContents?.corridor  ? <HiddenPlaceholder /> : <CorridorBox char={char} onEdit={() => onCorridor?.(char.id)} />}
        {char.hiddenContents?.nightmare ? <HiddenPlaceholder /> : <NightmareBox char={char} />}
        {char.hiddenContents?.awakening ? <HiddenPlaceholder /> : <AwakeningBox char={char} />}
      </div>

      {/* 우측: 세로 액션 버튼 (장비 / 수정 / 숨기기) */}
      <div className="flex flex-col border-l">
        {cidPresent && onEquip ? (
          <button
            onClick={() => onEquip(char.id)}
            className="flex-1 px-2 text-[11px] font-bold text-muted-foreground hover:text-cat-arcana hover:bg-cat-arcana/10 border-b transition-colors flex items-center justify-center gap-1"
            title="장비 · 스킬 정보 보기"
          >
            <Shirt className="h-3 w-3" /> 장비
          </button>
        ) : (
          <span
            className="flex-1 px-2 text-[11px] font-bold text-muted-foreground border-b flex items-center justify-center gap-1 opacity-40"
            title="캐릭터 ID 미등록 — 수정에서 입력"
          >
            [ - ]
          </span>
        )}
        <button
          onClick={() => onEdit(char.id)}
          className="flex-1 px-2 text-[11px] font-bold text-muted-foreground hover:text-gold hover:bg-gold/5 border-b transition-colors flex items-center justify-center gap-1"
          title="수정"
        >
          <Pencil className="h-3 w-3" /> 수정
        </button>
        <button
          onClick={() => toggleHidden(char.id)}
          className="flex-1 px-2 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-accent/10 transition-colors flex items-center justify-center gap-1"
          title={char.hidden ? "표시" : "숨기기"}
        >
          {char.hidden ? <><Eye className="h-3 w-3" /> 보이기</> : <><EyeOff className="h-3 w-3" /> 숨기기</>}
        </button>
      </div>
    </div>
  );
}
