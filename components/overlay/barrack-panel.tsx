"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ChevronLeft, ChevronRight, ChevronDown, Zap, Shirt, ExternalLink,
  Gift, Skull, RotateCw, Sword as SwordIcon, TrendingUp,
} from "lucide-react";
import { useBarrackStore, computeOdMax } from "@/lib/barrack/store";
import { useOverlayStore } from "@/lib/overlay/store";
import { openEquipWindow } from "@/lib/overlay/equip-window";
import { CLASSES } from "@/lib/barrack/constants";
import {
  ContentCard, SubAction, Stat, StatRow, ActionBtn, Empty, RecentLogRow,
} from "@/components/overlay/barrack-cells";
import { OdEditDialog } from "@/components/barrack/od-edit-dialog";
import { EquipDialog } from "@/components/barrack/equip-dialog";
import { RaidEditDialog, type RaidEditSection } from "@/components/barrack/raid-edit-dialog";
import { getKinaRateInfo } from "@/lib/barrack/kina";
import { fmtN } from "@/lib/barrack/time";
import { charProfileUrl } from "@/lib/barrack/profile-url";
import type { Character, RaidType } from "@/lib/barrack/types";
import { cn } from "@/lib/utils";

const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

/** 오버레이 전용 콘텐츠 목록 — 원정/초월/루드라/바고트 + 기타(오드·회랑·악몽·각성전 일괄) */
const OVERLAY_CONTENTS = [
  { id: "expedition",      name: "원정",         icon: "🗺" },
  { id: "transcend",       name: "초월",         icon: "⚡" },
  { id: "sanctuary_ludra", name: "성역(루드라)", icon: "🌟" },
  { id: "sanctuary_bagot", name: "성역(바고트)", icon: "🌙" },
  { id: "etc",             name: "기타",         icon: "📦" },
] as const;
const CONTENT_IDS = OVERLAY_CONTENTS.map((c) => c.id);

function contentIdx(id: string): number {
  const i = (CONTENT_IDS as readonly string[]).indexOf(id);
  return i < 0 ? 0 : i;
}

export function BarrackOverlayPanel({ collapsed }: { collapsed: boolean }) {
  const characters = useBarrackStore((s) => s.characters);
  const accounts = useBarrackStore((s) => s.accounts);
  const db = useBarrackStore((s) => s.dbSettings);
  const cfg = useOverlayStore((s) => s.barrack);
  const patchCfg = useOverlayStore((s) => s.patchBarrack);

  const visible = useMemo(
    () => characters.filter((c) => !c.hidden),
    [characters]
  );

  // 선택된 캐릭터 자동 보정 (확장 모드 단일 + 축소 모드 첫번째)
  const selectedChar: Character | null = useMemo(() => {
    if (!visible.length) return null;
    return visible.find((c) => c.id === cfg.selectedCharId) ?? visible[0];
  }, [visible, cfg.selectedCharId]);

  const [charDropdownOpen, setCharDropdownOpen] = useState(false);
  const [odEditCharId, setOdEditCharId] = useState<string | null>(null);
  const [equipCharId, setEquipCharId] = useState<string | null>(null);

  if (!selectedChar) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic p-4 text-center">
        등록된 캐릭터 없음 — 배럭관리에서 추가하세요.
      </div>
    );
  }

  const contentId = cfg.selectedContentId ?? "expedition";
  // 저장된 contentId가 OVERLAY_CONTENTS에 없으면 expedition으로 fallback
  const safeContentId = CONTENT_IDS.includes(contentId as typeof CONTENT_IDS[number]) ? contentId : "expedition";
  const idx = contentIdx(safeContentId);

  function cycleContent(delta: -1 | 1) {
    const next = (idx + delta + OVERLAY_CONTENTS.length) % OVERLAY_CONTENTS.length;
    patchCfg({ selectedContentId: OVERLAY_CONTENTS[next].id });
  }

  function selectChar(id: string) {
    patchCfg({ selectedCharId: id });
    setCharDropdownOpen(false);
  }

  // 축소 모드 + 다중 캐릭터 — 슬롯 기반 (선택 변경 시 재정렬 없음)
  if (collapsed && cfg.collapsed.maxChars > 1) {
    const N = visible.length;
    const maxSlots = Math.min(cfg.collapsed.maxChars, N);
    // 슬롯별 캐릭터 결정: 저장된 selectedCharIds 우선, 미설정 슬롯은 visible 순서 fallback
    const selectedIds = cfg.selectedCharIds ?? [];
    const slotIds: string[] = [];
    const usedIds = new Set<string>();
    for (let i = 0; i < maxSlots; i++) {
      const stored = selectedIds[i];
      if (stored && visible.find((c) => c.id === stored) && !usedIds.has(stored)) {
        slotIds.push(stored);
        usedIds.add(stored);
      } else {
        // visible 순서대로 아직 안 쓰인 캐릭터 채움
        const fallback = visible.find((c) => !usedIds.has(c.id));
        if (fallback) {
          slotIds.push(fallback.id);
          usedIds.add(fallback.id);
        }
      }
    }
    const list = slotIds.map((id) => visible.find((c) => c.id === id)).filter((c): c is Character => !!c);
    const visibleIds = new Set(list.map((c) => c.id));

    function setSlotChar(slotIdx: number, newId: string) {
      const arr = (cfg.selectedCharIds ?? []).slice();
      while (arr.length < maxSlots) arr.push("");
      arr[slotIdx] = newId;
      patchCfg({ selectedCharIds: arr.slice(0, maxSlots) });
    }

    return (
      <div className="flex flex-col h-full text-xs">
        <ContentSelector idx={idx} onCycle={cycleContent} />
        <div className="flex-1 overflow-auto divide-y divide-border/20 relative">
          {list.map((c, slotIdx) => (
            <CharCompactRow
              key={`slot-${slotIdx}-${c.id}`}
              char={c}
              contentId={safeContentId}
              allChars={visible}
              visibleIds={visibleIds}
              isAnchor={false}
              onOdClick={() => setOdEditCharId(c.id)}
              onEquipClick={async () => {
                const ok = await openEquipWindow(c.id);
                if (!ok) setEquipCharId(c.id);
              }}
              onSelectChar={(id) => setSlotChar(slotIdx, id)}
            />
          ))}
        </div>
        <OdEditDialog
          open={!!odEditCharId}
          charId={odEditCharId}
          onClose={() => setOdEditCharId(null)}
        />
        <EquipDialog
          open={!!equipCharId}
          charId={equipCharId}
          onClose={() => setEquipCharId(null)}
        />
      </div>
    );
  }

  // 확장 모드 또는 축소 모드 + 1개 캐릭터 — 기존 단일 패널
  const cls = CLASS_MAP[selectedChar.classId] ?? { icon: "❓", name: "?", color: "#666" };
  const od = selectedChar.od || 0;
  const odMax = computeOdMax(selectedChar, accounts, db);
  const odExtra = selectedChar.odExtra || 0;
  const odTotal = od + odExtra;
  const runs = Math.floor(odTotal / 80);

  return (
    <div className="flex flex-col h-full text-xs">
      {/* 캐릭터 헤더 — 클릭 시 드롭다운, 우측 장비/링크 */}
      <div className="relative border-b border-border/30 bg-cat-barrack/5 flex items-center">
        <button
          onClick={() => setCharDropdownOpen((v) => !v)}
          className="flex-1 flex items-center gap-2 px-2 py-1.5 hover:bg-cat-barrack/10 transition-colors min-w-0"
        >
          <span className="text-base" style={{ color: cls.color }}>{cls.icon}</span>
          <span className="font-extrabold truncate flex-1 text-left">{selectedChar.name}</span>
          {!collapsed && (
            <span className="text-[10px] text-muted-foreground">
              Lv.{selectedChar.level} · {selectedChar.server}
            </span>
          )}
          <ChevronDown className={cn("h-3 w-3 transition-transform", charDropdownOpen && "rotate-180")} />
        </button>
        <div className="flex items-center gap-1 px-2 flex-shrink-0">
          <button
            onClick={async (e) => {
              e.stopPropagation();
              const ok = await openEquipWindow(selectedChar.id);
              if (!ok) setEquipCharId(selectedChar.id);
            }}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/50 hover:bg-cat-arcana/10 hover:border-cat-arcana hover:text-cat-arcana text-[10px] font-bold"
            title="장비 · 스킬 — 신규 창"
          >
            <Shirt className="h-3 w-3" /> 장비
          </button>
          {(() => {
            const pu = charProfileUrl(selectedChar, db);
            return pu ? (
              <a
                href={pu}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/50 hover:bg-gold/10 hover:border-gold hover:text-gold text-[10px] font-bold"
                title="아툴사이트 — 캐릭터 프로필"
              >
                <ExternalLink className="h-3 w-3" /> 링크
              </a>
            ) : (
              <span
                className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/30 text-[10px] font-bold opacity-30"
                title="캐릭터 ID 미등록"
              >
                <ExternalLink className="h-3 w-3" /> 링크
              </span>
            );
          })()}
        </div>
        {charDropdownOpen && (
          <div className="absolute left-0 right-0 top-full z-10 max-h-60 overflow-auto border border-border bg-background/95 backdrop-blur-sm shadow-lg">
            {visible.map((c) => {
              const cc = CLASS_MAP[c.classId] ?? { icon: "❓", name: "?", color: "#666" };
              const active = c.id === selectedChar.id;
              return (
                <button
                  key={c.id}
                  onClick={() => selectChar(c.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-accent/20",
                    active && "bg-cat-barrack/20 font-bold"
                  )}
                >
                  <span className="text-sm" style={{ color: cc.color }}>{cc.icon}</span>
                  <span className="truncate flex-1">{c.name}</span>
                  <span className="text-[9px] text-muted-foreground">{c.server}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* OD 카드 — 클릭하면 편집 */}
      <button
        onClick={() => setOdEditCharId(selectedChar.id)}
        className="flex items-center gap-2 px-2 py-1.5 border-b border-border/30 bg-gold/5 hover:bg-gold/10 transition-colors"
        title="클릭하여 오드 수정"
      >
        <Zap className="h-3.5 w-3.5 text-gold flex-shrink-0" />
        <span className="text-[10px] text-muted-foreground">오드</span>
        <span className="font-extrabold text-gold-light tabular-nums">{od}/{odMax}</span>
        {odExtra > 0 && <span className="text-[10px] text-gold-light">+{odExtra}</span>}
        <span className="flex-1" />
        <span className="text-[10px] text-muted-foreground tabular-nums">{runs}회분</span>
      </button>

      <ContentSelector idx={idx} onCycle={cycleContent} />

      {/* 컨텐츠 본문 — 'etc'는 4종 카드, 나머지는 단일 콘텐츠 상세 */}
      <div className="flex-1 overflow-auto p-2">
        {safeContentId === "etc" ? (
          <FourContentCards char={selectedChar} />
        ) : (
          <ContentBody char={selectedChar} contentId={safeContentId} />
        )}
      </div>

      <OdEditDialog
        open={!!odEditCharId}
        charId={odEditCharId}
        onClose={() => setOdEditCharId(null)}
      />
      <EquipDialog
        open={!!equipCharId}
        charId={equipCharId}
        onClose={() => setEquipCharId(null)}
      />
    </div>
  );
}

/* ============================================================
   컨텐츠 좌우 셀렉터 (공통)
   ============================================================ */
function ContentSelector({ idx, onCycle }: { idx: number; onCycle: (d: -1 | 1) => void }) {
  return (
    <div className="flex items-center border-b border-border/30 bg-background/10">
      <button
        onClick={() => onCycle(-1)}
        className="px-1.5 py-1 hover:bg-accent/20 transition-colors"
        title="이전 컨텐츠"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>
      <div className="flex-1 flex items-center justify-center gap-1 py-1 font-bold">
        <span className="text-sm">{OVERLAY_CONTENTS[idx].icon}</span>
        <span>{OVERLAY_CONTENTS[idx].name}</span>
      </div>
      <button
        onClick={() => onCycle(1)}
        className="px-1.5 py-1 hover:bg-accent/20 transition-colors"
        title="다음 컨텐츠"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

/* ============================================================
   축소 모드 다중 캐릭터 컴팩트 행
   - 캐릭터명 클릭 → 캐릭터 선택 드롭다운 (1개 모드와 동일)
   - 기본 오드 막대바 + 추가오드/회분 라벨
   ============================================================ */
function CharCompactRow({
  char, contentId, allChars, visibleIds, isAnchor, onOdClick, onEquipClick, onSelectChar,
}: {
  char: Character;
  contentId: string;
  allChars: Character[];
  visibleIds: Set<string>;
  isAnchor: boolean;
  onOdClick: () => void;
  onEquipClick: () => void;
  onSelectChar: (id: string) => void;
}) {
  const accounts = useBarrackStore((s) => s.accounts);
  const db = useBarrackStore((s) => s.dbSettings);
  const profileUrl = charProfileUrl(char, db);
  const cls = CLASS_MAP[char.classId] ?? { icon: "❓", name: "?", color: "#666" };
  const od = char.od || 0;
  const odMax = computeOdMax(char, accounts, db);
  const odExtra = char.odExtra || 0;
  const odTotal = od + odExtra;
  const runs = Math.floor(odTotal / 80);
  const odPct = Math.min(100, Math.round((od / Math.max(1, odMax)) * 100));
  const [dropdownOpen, setDropdownOpen] = useState(false);

  return (
    <div className="relative px-2 py-1.5 space-y-1.5 hover:bg-cat-barrack/5">
      {/* 캐릭터명 + 드롭다운 트리거 */}
      <div className="flex items-center gap-2 relative">
        <span className="text-base" style={{ color: cls.color }}>{cls.icon}</span>
        <div className="relative flex-1 min-w-0">
          <button
            onClick={(e) => { e.stopPropagation(); setDropdownOpen((v) => !v); }}
            className={cn(
              "font-extrabold truncate text-left hover:text-cat-barrack transition-colors flex items-center gap-1 w-full",
              isAnchor && "text-cat-barrack"
            )}
            title="클릭하여 표시할 캐릭터 변경"
            style={{ fontSize: "13px" }}
          >
            <span className="truncate">{char.name}</span>
            {!!char.cp && (
              <span className="text-amber-400 font-extrabold tabular-nums shrink-0" style={{ fontSize: "11px" }}>
                ({fmtN(char.cp)})
              </span>
            )}
            <ChevronDown className={cn("h-3 w-3 opacity-60 transition-transform shrink-0", dropdownOpen && "rotate-180")} />
          </button>
          {/* 우측: 장비 / 링크 버튼 */}
          {/* 드롭다운 — 캐릭터명 바로 아래 표시 (이름 위치에 anchor) */}
          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setDropdownOpen(false)} />
              <div
                className="absolute left-0 top-full mt-0.5 z-40 max-h-60 overflow-auto border border-border bg-background/95 backdrop-blur-sm shadow-lg rounded"
                style={{ minWidth: 180 }}
              >
                {allChars.map((c) => {
                  const cc = CLASS_MAP[c.classId] ?? { icon: "❓", name: "?", color: "#666" };
                  const active = c.id === char.id;
                  const shown = visibleIds.has(c.id);
                  return (
                    <button
                      key={c.id}
                      onClick={() => { onSelectChar(c.id); setDropdownOpen(false); }}
                      className={cn(
                        "w-full flex items-center gap-2 px-2 py-1.5 text-left hover:bg-accent/20",
                        active && "bg-cat-barrack/20 font-bold",
                        !active && shown && "bg-cat-barrack/5"
                      )}
                      title={active ? "현재 행" : shown ? "다른 행에 표시 중" : "이 행에 표시"}
                    >
                      <span className="text-sm" style={{ color: cc.color }}>{cc.icon}</span>
                      <span className="truncate flex-1">{c.name}</span>
                      {active && <span className="text-[9px] text-cat-barrack font-bold">▶</span>}
                      {!active && shown && <span className="text-[9px] text-muted-foreground">다른행</span>}
                      {!!c.cp && (
                        <span className="text-amber-400 font-extrabold tabular-nums shrink-0" style={{ fontSize: "10px" }}>
                          {fmtN(c.cp)}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
        {/* 우측: 장비 / 링크 버튼 */}
        <button
          onClick={(e) => { e.stopPropagation(); onEquipClick(); }}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/50 hover:bg-cat-arcana/10 hover:border-cat-arcana hover:text-cat-arcana text-[10px] font-bold flex-shrink-0"
          title="장비 · 스킬 — 신규 창"
        >
          <Shirt className="h-3 w-3" /> 장비
        </button>
        {profileUrl ? (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/50 hover:bg-gold/10 hover:border-gold hover:text-gold text-[10px] font-bold flex-shrink-0"
            title="아툴사이트 — 캐릭터 프로필"
          >
            <ExternalLink className="h-3 w-3" /> 링크
          </a>
        ) : (
          <span
            className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-border/30 text-[10px] font-bold opacity-30 flex-shrink-0"
            title="캐릭터 ID 미등록 — 수정에서 입력"
          >
            <ExternalLink className="h-3 w-3" /> 링크
          </span>
        )}
      </div>

      {/* 기본 오드 막대바 — 파랑 (cat-barrack 색) — 누적보상 카드와 디자인 통일 */}
      <button
        onClick={(e) => { e.stopPropagation(); onOdClick(); }}
        title="오드 수정"
        className="w-full flex items-center gap-2 rounded border border-cat-barrack/40 bg-cat-barrack/10 px-2 py-1 hover:bg-cat-barrack/20 transition-colors"
      >
        <Zap className="h-4 w-4 text-cat-barrack flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="h-2 rounded bg-background/40 overflow-hidden">
            <div className="h-full bg-gradient-to-r from-blue-500/70 to-blue-400" style={{ width: `${odPct}%` }} />
          </div>
        </div>
        <span className="font-extrabold text-cat-barrack tabular-nums" style={{ fontSize: "12px" }}>
          {od}/{odMax}
        </span>
        {odExtra > 0 && (
          <span className="font-extrabold text-cat-barrack tabular-nums" style={{ fontSize: "12px" }}>
            [+{odExtra}]
          </span>
        )}
        <span className="font-extrabold tabular-nums text-white" style={{ fontSize: "12px" }}>
          {runs}회분
        </span>
      </button>

      {/* 본문 — 'etc' 시 4종 카드, 그 외 단일 콘텐츠 상세 */}
      {contentId === "etc" ? (
        <FourContentCards char={char} />
      ) : (
        <ContentBody char={char} contentId={contentId} />
      )}
    </div>
  );
}

/** 오버레이 축소 — 오드/회랑/악몽/각성전 4종 한번에 (2열).
 *  각 카드: 회색 기본, 원정/초월 보상 카드 형태 (아이콘 + 잔여 표기).
 *  좌클릭 → -1 (사용), 우클릭 → +1 (반환). */
function FourContentCards({ char }: { char: Character }) {
  const doShop = useBarrackStore((s) => s.doShop);
  const doCorridor = useBarrackStore((s) => s.doCorridor);
  const doNightmare = useBarrackStore((s) => s.doNightmare);
  const doAwakening = useBarrackStore((s) => s.doAwakening);
  const db = useBarrackStore((s) => s.dbSettings);

  // 오드 (ShopBox) — 변환 + 상점 잔여
  const convMax = db.charConvert?.max ?? 4;
  const buyMax = db.charBuy?.max ?? 4;
  const conv = char.shop?.convert ?? 0;
  const buy = char.shop?.buy ?? 0;
  const odConvLeft = Math.max(0, convMax - conv);
  const odBuyLeft = Math.max(0, buyMax - buy);

  // 회랑
  const cr = char.corridor ?? { lower: 0, lowerMax: 3, middle: 0, middleMax: 3 };

  // 악몽 / 각성전
  const tk = char.nightmare?.tickets ?? 0;
  const tkEx = char.nightmare?.ticketsExtra ?? 0;
  const nmMax = db.nightmare?.maxTickets ?? 14;
  const ak = char.awakening?.tickets ?? 0;
  const akEx = char.awakening?.ticketsExtra ?? 0;
  const akMax = db.awakening?.weeklyTickets ?? 3;

  return (
    <div className="grid grid-cols-2 gap-1.5">
      {/* 오드 — 변환 + 상점 */}
      <ContentCard icon="💎" label="오드">
        <SubAction
          label="변환"
          value={odConvLeft}
          max={convMax}
          done={odConvLeft <= 0}
          onConsume={() => doShop(char.id, "convert", +1)}
          onReturn={() => doShop(char.id, "convert", -1)}
        />
        <SubAction
          label="상점"
          value={odBuyLeft}
          max={buyMax}
          done={odBuyLeft <= 0}
          onConsume={() => doShop(char.id, "buy", +1)}
          onReturn={() => doShop(char.id, "buy", -1)}
        />
      </ContentCard>

      {/* 회랑 — 하층 + 중층 */}
      <ContentCard icon="🏛" label="회랑">
        <SubAction
          label="하층"
          value={cr.lower}
          max={cr.lowerMax}
          done={cr.lower <= 0}
          onConsume={() => doCorridor(char.id, "lower", -1)}
          onReturn={() => doCorridor(char.id, "lower", +1)}
        />
        <SubAction
          label="중층"
          value={cr.middle}
          max={cr.middleMax}
          done={cr.middle <= 0}
          onConsume={() => doCorridor(char.id, "middle", -1)}
          onReturn={() => doCorridor(char.id, "middle", +1)}
        />
      </ContentCard>

      {/* 악몽 */}
      <ContentCard icon="👁" label="악몽">
        <SubAction
          label="티켓"
          value={tk}
          extra={tkEx}
          max={nmMax}
          done={tk + tkEx <= 0}
          onConsume={() => doNightmare(char.id, -1)}
          onReturn={() => doNightmare(char.id, +1)}
        />
      </ContentCard>

      {/* 각성전 */}
      <ContentCard icon="💫" label="각성전">
        <SubAction
          label="티켓"
          value={ak}
          extra={akEx}
          max={akMax}
          done={ak + akEx <= 0}
          onConsume={() => doAwakening(char.id, -1)}
          onReturn={() => doAwakening(char.id, +1)}
        />
      </ContentCard>
    </div>
  );
}

function ContentBody({ char, contentId }: { char: Character; contentId: string }) {
  const doRaid = useBarrackStore((s) => s.doRaid);
  const doMission = useBarrackStore((s) => s.doMission);
  const doAwakening = useBarrackStore((s) => s.doAwakening);
  const doNightmare = useBarrackStore((s) => s.doNightmare);
  const doCorridor = useBarrackStore((s) => s.doCorridor);
  const doShop = useBarrackStore((s) => s.doShop);
  const accounts = useBarrackStore((s) => s.accounts);
  const dbSettings = useBarrackStore((s) => s.dbSettings);
  const [raidEditSection, setRaidEditSection] = useState<RaidEditSection | null>(null);

  const serverData = accounts
    .find((a) => a.id === char.accountId)
    ?.servers?.[char.server];

  if (contentId === "expedition" || contentId === "transcend" || contentId === "sanctuary_ludra" || contentId === "sanctuary_bagot") {
    const raidKey = contentId as RaidType;
    const r = char[raidKey];
    if (!r) return <Empty />;
    const rB = r.rewardBase || 0;
    const bB = r.bossBase || 0;
    const rEx = r.rewardExtra || 0;
    const bEx = r.bossExtra || 0;

    const totalKey = raidKey === "expedition" ? "expRewardTotal" : raidKey === "transcend" ? "traRewardTotal" : null;
    const accumulated = totalKey && serverData ? (serverData[totalKey] as number | undefined) ?? 0 : null;

    // 메인 배럭 키나 획득률 규칙 연동 — 누적 0회 라도 표시 (0회 → 첫 구간 진행률)
    const isKinaType = raidKey === "expedition" || raidKey === "transcend";
    const kinaInfo = isKinaType
      ? getKinaRateInfo(raidKey as "expedition" | "transcend", accumulated ?? 0, dbSettings)
      : null;
    return (
      <div className="space-y-2">
        {/* 보상/보스 — 각 카드 클릭 시 해당 섹션만 수정 */}
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => setRaidEditSection("reward")}
            className="text-left hover:opacity-90 transition-opacity"
            title="잔여 보상 수정"
          >
            <StatRow icon={<Gift className="h-5 w-5" />} value={`${r.reward}/${rB}`} extra={rEx} done={r.reward <= 0 && rEx <= 0} />
          </button>
          <button
            type="button"
            onClick={() => setRaidEditSection("boss")}
            className="text-left hover:opacity-90 transition-opacity"
            title="잔여 보스 수정"
          >
            <StatRow icon={<Skull className="h-5 w-5" />} value={`${r.boss}/${bB}`} extra={bEx} done={r.boss <= 0 && bEx <= 0} />
          </button>
        </div>
        {/* 누적/1회/보스 — 누적 카드 클릭 시 누적 수정 */}
        <div className="grid gap-1.5" style={{ gridTemplateColumns: "2fr 1fr 1fr" }}>
          {accumulated !== null && kinaInfo ? (
            <button
              type="button"
              onClick={() => setRaidEditSection("accumulated")}
              className="rounded border border-cat-barrack/40 bg-cat-barrack/10 px-2 py-1 flex flex-col justify-center text-left hover:bg-cat-barrack/20 transition-colors"
              title="누적 횟수 수정"
            >
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-cat-barrack flex-shrink-0" />
                <span className="ml-auto font-extrabold tabular-nums text-cat-barrack" style={{ fontSize: "13px" }}>
                  {accumulated}회
                </span>
              </div>
              <div className="text-[10px] tabular-nums leading-tight mt-0.5 text-white space-y-0.5">
                <div>
                  현재 <span className="font-bold">{kinaInfo.rate}%</span> 키나획득 중
                </div>
                {kinaInfo.remaining !== null && (
                  <div>
                    다음 제한까지 <span className="font-bold">{kinaInfo.remaining}회</span>
                  </div>
                )}
              </div>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setRaidEditSection("reward")}
              className="rounded border border-border/40 bg-background/20 px-2 py-1 text-[10px] text-muted-foreground italic flex items-center text-left hover:bg-accent/10"
              title="잔여 수정"
            >
              잔여 수정
            </button>
          )}
          <ActionBtn
            icon={<RotateCw className="h-4 w-4" />}
            label="1회"
            accent="green"
            onClick={() => doRaid(char.id, raidKey, "both", -1)}
            onContextMenu={(e) => { e.preventDefault(); doRaid(char.id, raidKey, "both", +1); }}
          />
          <ActionBtn
            icon={<SwordIcon className="h-4 w-4" />}
            label="보스"
            onClick={() => doRaid(char.id, raidKey, "boss", -1)}
            onContextMenu={(e) => { e.preventDefault(); doRaid(char.id, raidKey, "boss", +1); }}
          />
        </div>
        {/* 최근 변경 로그 1건 — 누적/1회/보스 행 아래 */}
        <RecentLogRow char={char} />
        <RaidEditDialog
          open={!!raidEditSection}
          charId={char.id}
          raidKey={raidKey}
          section={raidEditSection ?? "all"}
          onClose={() => setRaidEditSection(null)}
        />
      </div>
    );
  }

  if (contentId === "mission") {
    const done = char.mission?.done || 0;
    return (
      <div className="space-y-2">
        <Stat label="사명" value={`${done}회 완료`} extra={0} done={false} />
        <div className="grid grid-cols-1 gap-1.5">
          <ActionBtn
            label="+1 완료"
            onClick={() => doMission(char.id, +1)}
            onContextMenu={(e) => { e.preventDefault(); doMission(char.id, -1); }}
          />
        </div>
      </div>
    );
  }

  if (contentId === "shop") {
    const convert = char.shop?.convert || 0;
    const buy = char.shop?.buy || 0;
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="전환" value={`${convert}`} extra={0} done={false} />
          <Stat label="구매" value={`${buy}`} extra={0} done={false} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <ActionBtn label="-전환" onClick={() => doShop(char.id, "convert", -1)}
            onContextMenu={(e) => { e.preventDefault(); doShop(char.id, "convert", +1); }} />
          <ActionBtn label="-구매" onClick={() => doShop(char.id, "buy", -1)}
            onContextMenu={(e) => { e.preventDefault(); doShop(char.id, "buy", +1); }} />
        </div>
      </div>
    );
  }

  if (contentId === "corridor") {
    const lo = char.corridor?.lower || 0;
    const loMax = char.corridor?.lowerMax || 0;
    const mid = char.corridor?.middle || 0;
    const midMax = char.corridor?.middleMax || 0;
    return (
      <div className="space-y-2">
        <div className="grid grid-cols-2 gap-2">
          <Stat label="하위" value={`${lo}/${loMax}`} extra={0} done={lo <= 0} />
          <Stat label="중위" value={`${mid}/${midMax}`} extra={0} done={mid <= 0} />
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <ActionBtn label="-하위" onClick={() => doCorridor(char.id, "lower", -1)}
            onContextMenu={(e) => { e.preventDefault(); doCorridor(char.id, "lower", +1); }} />
          <ActionBtn label="-중위" onClick={() => doCorridor(char.id, "middle", -1)}
            onContextMenu={(e) => { e.preventDefault(); doCorridor(char.id, "middle", +1); }} />
        </div>
      </div>
    );
  }

  if (contentId === "nightmare") {
    const t = char.nightmare?.tickets || 0;
    const ex = char.nightmare?.ticketsExtra || 0;
    return (
      <div className="space-y-2">
        <Stat label="악몽 티켓" value={`${t}`} extra={ex} done={t + ex <= 0} />
        <ActionBtn label="-1 소진" onClick={() => doNightmare(char.id, -1)}
          onContextMenu={(e) => { e.preventDefault(); doNightmare(char.id, +1); }} />
      </div>
    );
  }

  if (contentId === "awakening") {
    const t = char.awakening?.tickets || 0;
    const ex = char.awakening?.ticketsExtra || 0;
    return (
      <div className="space-y-2">
        <Stat label="각성전 티켓" value={`${t}`} extra={ex} done={t + ex <= 0} />
        <ActionBtn label="-1 소진" onClick={() => doAwakening(char.id, -1)}
          onContextMenu={(e) => { e.preventDefault(); doAwakening(char.id, +1); }} />
      </div>
    );
  }

  return <Empty />;
}

