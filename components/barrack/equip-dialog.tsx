"use client";

import { useEffect, useState } from "react";
import { Shirt, RefreshCw, AlertTriangle, ExternalLink, X } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useBarrackStore } from "@/lib/barrack/store";
import { getServerId, charProfileUrl } from "@/lib/barrack/profile-url";
import { fetchEquipment, fetchEquipmentItem, fetchCharacterFullInfo } from "@/lib/barrack/equip-api";
import { CLASSES } from "@/lib/barrack/constants";
import { fmtN } from "@/lib/barrack/time";
import { cn } from "@/lib/utils";
import { ItemDetailPanel } from "./item-detail-panel";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { skillLevelStyle } from "@/lib/arcana/skill-style";
import type { SkillCategory } from "@/lib/arcana/types";
import { useSkillStore } from "@/lib/arcana/skill-store";
import { SPECIAL_EFFECT_LEVELS } from "@/lib/arcana/constants";
import { SkillHoverTooltip } from "@/components/arcana/skill-hover-tooltip";

/** 외부 도메인(파티 등)에서 직접 캐릭터 정보를 넘겨 장비 모달을 띄울 때 사용 */
export type DirectCharInfo = {
  cid: string;
  serverId: number | string;
  name: string;
  level?: number;
  cp?: number;
  itemLevel?: number;
  classIcon?: string;
  classColor?: string;
  className?: string;
  serverName?: string;
  raceForUrl?: string;
};

type Props = {
  open: boolean;
  /** 배럭 도메인에서 사용 시 — 배럭 store의 캐릭터 id */
  charId?: string | null;
  /** 직접 정보 전달 (파티 등 — charId 대신 사용) */
  directChar?: DirectCharInfo | null;
  onClose: () => void;
  /** true 시 Dialog 래퍼 없이 풀스크린 패널 모드 — 신규 윈도우용 */
  standalone?: boolean;
};

const CLASS_MAP = Object.fromEntries(CLASSES.map((c) => [c.id, c]));

// V4.0.9 SLOT_KO — slotPosName(string) → 한글 라벨
const SLOT_KO: Record<string, string> = {
  MainHand: "무기", SubHand: "보조무기",
  Helmet: "투구", Shoulder: "어깨",
  Torso: "상의", Belt: "허리띠",
  Pants: "바지", Gloves: "장갑",
  Cape: "망토", Boots: "장화",
  Earring1: "귀걸이①", Earring2: "귀걸이②",
  Necklace: "목걸이", Amulet: "장신구",
  Ring1: "반지①", Ring2: "반지②",
  Bracelet1: "팔찌①", Bracelet2: "팔찌②",
  Rune1: "룬①", Rune2: "룬②",
  Arcana1: "아르카나①", Arcana2: "아르카나②", Arcana3: "아르카나③",
  Arcana4: "아르카나④", Arcana5: "아르카나⑤", Arcana6: "아르카나⑥",
};

// V4.0.9 SLOT_ORDER (2열 교차)
const SLOT_ORDER = [
  "MainHand",  "SubHand",   "Earring1",  "Earring2",
  "Helmet",    "Shoulder",  "Necklace",  "Amulet",
  "Torso",     "Pants",     "Ring1",     "Ring2",
  "Gloves",    "Cape",      "Bracelet1", "Bracelet2",
  "Boots",     "Belt",      "Rune1",     "Rune2",
];
const ARCANA_ORDER = ["Arcana1", "Arcana2", "Arcana3", "Arcana4", "Arcana5", "Arcana6"];

const GRADE_KO: Record<string, string> = {
  Legend: "전승", Epic: "영웅", Unique: "유일", Special: "스페셜", Normal: "일반",
};
/** V4.0.9 등급 색상 (style.css line 1809) */
const GRADE_HEX: Record<string, string> = {
  Legend:  "#4a9eff",
  Epic:    "#ED4C00",
  Unique:  "#f0c040",
  Special: "#4cc97a",
  Normal:  "",  // 기본 텍스트
};
function gradeColorStyle(grade: string): React.CSSProperties {
  const c = GRADE_HEX[grade];
  return c ? { color: c } : {};
}
function gradeBoxStyle(grade: string): React.CSSProperties {
  const c = GRADE_HEX[grade];
  return c ? { borderColor: c + "55", background: c + "0d" } : {};
}

const SKILL_CAT_KO: Record<string, string> = { Active: "액티브", Passive: "패시브", Dp: "스티그마" };

// V4.0.9 SLOT_POS_MAP — slotPosName → API slotPos 번호
const SLOT_POS_MAP: Record<string, number> = {
  MainHand: 1,  SubHand: 2,
  Helmet: 3,    Shoulder: 4,  Torso: 5,
  Pants: 6,     Gloves: 7,    Boots: 8,
  Necklace: 10, Earring1: 11, Earring2: 12,
  Ring1: 13,    Ring2: 14,
  Bracelet1: 15, Bracelet2: 16,
  Belt: 17,     Cape: 19,     Amulet: 22,
  Rune1: 23,    Rune2: 24,
  Arcana1: 41,  Arcana2: 42,  Arcana3: 43,
  Arcana4: 44,  Arcana5: 45,  Arcana6: 46,
};

export function EquipDialog({ open, charId, directChar, onClose, standalone }: Props) {
  const barrackChar = useBarrackStore((s) => (charId ? s.characters.find((c) => c.id === charId) : null));
  const db = useBarrackStore((s) => s.dbSettings);
  const patchBarrackChar = useBarrackStore((s) => s.patchCharacter);
  // 파티 도메인 캐릭터 자동 갱신용 — directChar.cid + serverId 매칭
  const partyPlayers = usePartyStore((s) => s.players);
  const patchPartyChar = usePartyStore((s) => s.patchCharacter);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);
  /** /api/character/info 응답 — 이름·레벨·전투력(천 단위)·아이템레벨.
   *  새로고침 시 함께 갱신되어 캐릭터정보 카드와 로컬 store 둘 다 업데이트. */
  const [charInfo, setCharInfo] = useState<{
    name?: string;
    level?: number;
    cp?: number;
    itemLevel?: number;
  } | null>(null);

  // 아이템 상세 옵션 캐시 + 로딩/에러 + 펼침 상태
  type ItemState = { loading?: boolean; error?: string | null; data?: any };
  const [itemDetails, setItemDetails] = useState<Record<string, ItemState>>({});
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  // 표시·조회용 캐릭터 정보 — directChar 우선, 없으면 barrackChar
  const displayInfo = directChar
    ? {
        name: directChar.name,
        level: directChar.level,
        cp: directChar.cp,
        itemLevel: directChar.itemLevel,
        server: directChar.serverName,
        classIcon: directChar.classIcon,
        classColor: directChar.classColor,
        className: directChar.className,
        race: directChar.raceForUrl,
      }
    : barrackChar
    ? {
        name: barrackChar.name,
        level: barrackChar.level,
        cp: barrackChar.cp,
        itemLevel: barrackChar.itemLevel,
        server: barrackChar.server,
        classIcon: undefined as string | undefined,
        classColor: undefined as string | undefined,
        className: undefined as string | undefined,
        race: barrackChar.race,
      }
    : null;
  const cidRef = directChar ? directChar.cid : (barrackChar?.characterId || barrackChar?.cid || "");
  const srvIdRef = directChar
    ? String(directChar.serverId)
    : barrackChar
    ? getServerId(barrackChar.server, barrackChar.race, db)
    : null;

  // 응답 파생 데이터 — 함수 본체 전체에서 사용
  const root: any = data?.item ?? data?.data ?? data ?? {};
  const equipList: any[] = root?.equipment?.equipmentList ?? root?.equipmentList ?? [];
  const petwing: any = root?.petwing ?? {};
  const skillAll: any[] = root?.skill?.skillList ?? root?.skillList ?? [];
  const charBasic = root?.basic ?? root?.character ?? root?.profile ?? {};
  const mount: any = root?.mount ?? null;
  const bySlot: Record<string, any> = {};
  equipList.forEach((it) => { if (it?.slotPosName) bySlot[it.slotPosName] = it; });

  // 다중 fallback 헬퍼 — API 응답 필드명 변형 대응
  const numOrNull = (v: unknown): number | null => {
    if (v === undefined || v === null || v === "") return null;
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : null;
  };
  // charInfo(/api/character/info)가 가장 정확. equipment endpoint(charBasic)는 fallback.
  const apiName = charInfo?.name && charInfo.name !== "" ? charInfo.name : undefined;
  const apiLevel = numOrNull(charInfo?.level)
    ?? numOrNull(charBasic?.level)
    ?? numOrNull(charBasic?.playerLevel)
    ?? numOrNull(charBasic?.characterLevel)
    ?? numOrNull(charBasic?.lv)
    ?? numOrNull(root?.level);
  const apiCp = numOrNull(charInfo?.cp)
    ?? numOrNull(charBasic?.combatPower)
    ?? numOrNull(charBasic?.cp)
    ?? numOrNull(charBasic?.power)
    ?? numOrNull(root?.combatPower);
  const apiItemLevel = numOrNull(charInfo?.itemLevel)
    ?? numOrNull(charBasic?.itemLevel)
    ?? numOrNull(charBasic?.itemLv)
    ?? numOrNull(root?.itemLevel);

  async function loadItemDetail(slotKey: string, item: any) {
    if (!item || !cidRef || !srvIdRef) return;
    const itemId = item.itemId ?? item.id ?? item.templateId ?? item.itemTemplateId;
    if (!itemId) return;
    const slotPos = SLOT_POS_MAP[slotKey] ?? item.slotPos ?? 0;
    const ench = Number(item.enchantLevel ?? 0);
    setItemDetails((s) => ({ ...s, [slotKey]: { loading: true } }));
    try {
      const result = await fetchEquipmentItem(itemId, ench, cidRef, srvIdRef, slotPos);
      setItemDetails((s) => ({ ...s, [slotKey]: { data: result } }));
    } catch (err) {
      setItemDetails((s) => ({ ...s, [slotKey]: { error: (err as Error).message } }));
    }
  }

  function toggleRow(slotKey: string, item: any) {
    setExpanded((s) => {
      const next = !s[slotKey];
      if (next && !itemDetails[slotKey]?.data && !itemDetails[slotKey]?.loading) {
        void loadItemDetail(slotKey, item);
      }
      return { ...s, [slotKey]: next };
    });
  }

  /** 호버 시 상세 옵션 lazy fetch (캐시되면 재호출 안 함) */
  function ensureDetail(slotKey: string, item: any) {
    if (!item) return;
    const d = itemDetails[slotKey];
    if (d?.data || d?.loading) return;
    void loadItemDetail(slotKey, item);
  }

  /** 전체 펼치기/접기 — 장비 슬롯에 적용 (아르카나 제외) */
  function expandAll(state: boolean) {
    const next: Record<string, boolean> = { ...expanded };
    SLOT_ORDER.forEach((slotKey) => {
      const item = bySlot[slotKey];
      if (!item) return;
      next[slotKey] = state;
      if (state) ensureDetail(slotKey, item);
    });
    setExpanded(next);
  }
  const allExpanded = SLOT_ORDER.filter((k) => bySlot[k]).every((k) => expanded[k]);

  async function load() {
    if (!displayInfo) return;
    const cid = cidRef;
    const srvId = srvIdRef;
    if (!cid) { setError("캐릭터 ID가 등록되어 있지 않습니다."); return; }
    if (!srvId) { setError("서버 ID를 찾을 수 없습니다."); return; }
    setLoading(true);
    setError(null);
    try {
      // 장비/스킬 + 캐릭터 기본정보(이름·레벨·전투력·아이템레벨)를 병렬로 가져온다.
      // fullInfo 실패는 치명적이지 않으므로 allSettled.
      const [equipRes, infoRes] = await Promise.allSettled([
        fetchEquipment(cid, srvId),
        fetchCharacterFullInfo(cid, srvId),
      ]);
      if (equipRes.status === "fulfilled") {
        setData(equipRes.value);
      } else {
        throw equipRes.reason;
      }
      if (infoRes.status === "fulfilled") {
        setCharInfo({
          name: infoRes.value.name,
          level: infoRes.value.level,
          cp: infoRes.value.cp,
          itemLevel: infoRes.value.itemLevel,
        });
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (open && displayInfo) {
      setData(null);
      setCharInfo(null);
      setError(null);
      setItemDetails({});
      setExpanded({});
      void load();
    }
    // displayInfo 존재 여부 변화도 트리거 — 신규 윈도우에서 store 하이드레이션 지연 대응
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, charId, directChar?.cid, !!displayInfo, cidRef, srvIdRef]);

  // 데이터 로드 시 로컬 캐릭터 레코드 자동 갱신 (이름·전투력·아이템레벨·레벨)
  useEffect(() => {
    if (!data && !charInfo) return;
    // 배럭 캐릭터
    if (barrackChar) {
      const patch: Partial<typeof barrackChar> = {};
      if (apiCp !== null && apiCp !== (barrackChar.cp ?? 0)) patch.cp = apiCp;
      if (apiItemLevel !== null && apiItemLevel !== (barrackChar.itemLevel ?? 0)) patch.itemLevel = apiItemLevel;
      if (apiLevel !== null && apiLevel !== (barrackChar.level ?? 0)) patch.level = apiLevel;
      if (apiName && apiName !== barrackChar.name) patch.name = apiName;
      if (Object.keys(patch).length) patchBarrackChar(barrackChar.id, patch);
    }
    // 파티 캐릭터 — directChar.cid + serverId로 매칭
    if (directChar && directChar.cid) {
      const targetCid = String(directChar.cid);
      const targetSid = Number(directChar.serverId);
      for (const pl of partyPlayers) {
        for (const ch of pl.characters) {
          if (String(ch.characterId ?? "") === targetCid && Number(ch.serverId ?? 0) === targetSid) {
            const patch: Partial<{ cp: number; itemLevel: number; name: string }> = {};
            if (apiCp !== null && apiCp !== (ch.cp ?? 0)) patch.cp = apiCp;
            if (apiItemLevel !== null && apiItemLevel !== (ch.itemLevel ?? 0)) patch.itemLevel = apiItemLevel;
            if (apiName && apiName !== ch.name) patch.name = apiName;
            // PartyCharacter에 level 필드는 없으므로 패치하지 않음
            if (Object.keys(patch).length) patchPartyChar(pl.id, ch.id, patch);
          }
        }
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, charInfo]);

  // 데이터 로드 후 아르카나 6개 자동 fetch (V4.0.9 동일)
  useEffect(() => {
    if (!data || !cidRef || !srvIdRef) return;
    const root: any = data?.item ?? data?.data ?? data ?? {};
    const equipList: any[] = root?.equipment?.equipmentList ?? root?.equipmentList ?? [];
    const arcanaItems = ARCANA_ORDER
      .map((k) => equipList.find((it) => it?.slotPosName === k))
      .filter((x): x is any => !!x);
    arcanaItems.forEach((item) => {
      const slotKey = item.slotPosName;
      if (itemDetails[slotKey]?.data || itemDetails[slotKey]?.loading) return;
      void loadItemDetail(slotKey, item);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  if (!displayInfo) return null;
  const cls = barrackChar ? CLASS_MAP[barrackChar.classId] : null;
  const iconChar = displayInfo.classIcon ?? cls?.icon;
  const colorChar = displayInfo.classColor ?? cls?.color;
  const nameChar = displayInfo.className ?? cls?.name;
  // 프로필 URL — barrack은 charProfileUrl, 파티는 직접 조립
  const profileUrl = directChar
    ? `https://www.aion2tool.com/char/serverid=${directChar.serverId}/${encodeURIComponent(directChar.name)}`
    : barrackChar
    ? charProfileUrl(barrackChar, db)
    : null;
  void iconChar; void colorChar; // 미사용 변수 경고 방지 (헤더에서 직접 참조)

  const headerTitle = (
    <div className="flex items-center gap-2 flex-wrap text-lg font-semibold leading-none tracking-tight">
      <Shirt className="h-4 w-4" />
      <span>🎒 장비 · 스킬 — {apiName ?? displayInfo.name}</span>
      <span className="text-xs text-muted-foreground font-normal">
        {(displayInfo.classIcon ?? cls?.icon) ?? ""} {(displayInfo.className ?? cls?.name) ?? ""} · Lv.{apiLevel ?? displayInfo.level ?? "?"} · {displayInfo.server || "서버 미지정"}
      </span>
      <div className="ml-auto flex items-center gap-1.5">
        {profileUrl && (
          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded border bg-cat-arcana/10 border-cat-arcana/40 text-cat-arcana hover:bg-cat-arcana/20"
            title="aion2tool.com 외부 캐릭터 페이지"
          >
            <ExternalLink className="h-3.5 w-3.5" /> 아툴사이트
          </a>
        )}
        <button
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded border hover:bg-accent/10 disabled:opacity-50"
          title="다시 불러오기"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", loading && "animate-spin")} /> 새로고침
        </button>
        <button
          onClick={onClose}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded border hover:bg-destructive/10 hover:border-destructive hover:text-destructive"
          title="창 닫기"
        >
          <X className="h-3.5 w-3.5" /> 창 닫기
        </button>
      </div>
    </div>
  );

  const body = (
    <>

        {loading && (
          <div className="text-center py-10 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin inline-block mr-2" />
            장비/스킬 정보를 불러오는 중…
          </div>
        )}

        {error && !loading && (
          <div className="rounded border border-rose-500/40 bg-rose-500/10 p-4 text-sm">
            <div className="flex items-center gap-2 font-bold mb-2 text-rose-600 dark:text-rose-300">
              <AlertTriangle className="h-4 w-4" /> 불러오기 실패
            </div>
            <div className="text-xs text-muted-foreground whitespace-pre-wrap break-all">{error}</div>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-4 flex-1 min-h-0 overflow-auto">
            {/* 캐릭터 기본 정보 — API basic 우선, 없으면 로컬 캐릭터 정보 */}
            <section className="rounded border bg-card/40 p-3">
              <div className="text-xs font-bold text-muted-foreground mb-2">캐릭터 정보</div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-xs">
                <Field label="이름" value={String(apiName ?? charBasic?.name ?? displayInfo.name ?? "-")} />
                <Field label="레벨" value={String(apiLevel ?? displayInfo.level ?? "-")} />
                <Field
                  label="전투력"
                  value={(() => {
                    const v = apiCp ?? displayInfo.cp;
                    return v ? fmtN(Number(v)) : "-";
                  })()}
                  highlight="gold"
                />
                <Field label="아이템 레벨" value={String(apiItemLevel ?? displayInfo.itemLevel ?? "-")} />
              </div>
            </section>

            {/* 장비 — V4.0.9의 4열 교차 배치, 클릭 시 상세 옵션 토글 + 호버 툴팁 */}
            <section className="rounded border bg-card/40 p-3">
              <div className="text-xs font-bold text-muted-foreground mb-2 flex items-center justify-between">
                <span>
                  🎒 장비 <span className="font-normal">({SLOT_ORDER.filter((k) => bySlot[k]).length}/{SLOT_ORDER.length})</span>
                </span>
                <Button
                  variant="ghost"
                  size="xs"
                  onClick={() => expandAll(!allExpanded)}
                  className="text-[11px]"
                  title={allExpanded ? "전체 옵션 접기" : "전체 옵션 펼치기"}
                >
                  {allExpanded ? <><ChevronUp className="h-3 w-3" /> 전체 접기</> : <><ChevronDown className="h-3 w-3" /> 전체 펼치기</>}
                </Button>
              </div>
              <TooltipProvider delayDuration={200}>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  {SLOT_ORDER.map((slotKey) => (
                    <EquipRow
                      key={slotKey}
                      slotKey={slotKey}
                      item={bySlot[slotKey]}
                      expanded={!!expanded[slotKey]}
                      detail={itemDetails[slotKey]}
                      onToggle={() => toggleRow(slotKey, bySlot[slotKey])}
                      onHover={() => ensureDetail(slotKey, bySlot[slotKey])}
                      classId={barrackChar?.classId ?? ""}
                    />
                  ))}
                </div>
              </TooltipProvider>
            </section>

            {/* 스킬 */}
            {skillAll.length > 0 && (
              <section className="rounded border bg-card/40 p-3">
                <div className="text-xs font-bold text-muted-foreground mb-2">✨ 스킬 ({skillAll.length})</div>
                <SkillGrid skills={skillAll} classId={barrackChar?.classId ?? ""} />
              </section>
            )}

            {/* 아르카나 — 자동 상세 로드 (V4.0.9 동일) */}
            {ARCANA_ORDER.some((k) => bySlot[k]) && (
              <section className="rounded border bg-card/40 p-3">
                <div className="text-xs font-bold text-muted-foreground mb-2">
                  🃏 아르카나 ({ARCANA_ORDER.filter((k) => bySlot[k]).length}/6)
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-1.5">
                  {ARCANA_ORDER.map((slotKey) => (
                    <ArcanaRow
                      key={slotKey}
                      slotKey={slotKey}
                      item={bySlot[slotKey]}
                      detail={itemDetails[slotKey]}
                      classId={barrackChar?.classId ?? ""}
                    />
                  ))}
                </div>
              </section>
            )}

            {/* 펫·날개·탈것 */}
            {(petwing?.pet || petwing?.wing || petwing?.wingSkin || mount) && (
              <section className="rounded border bg-card/40 p-3">
                <div className="text-xs font-bold text-muted-foreground mb-2">🐾 펫 · 날개 · 탈것</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
                  <PetWingCard label="펫" obj={petwing.pet} />
                  <PetWingCard label="날개" obj={petwing.wing} />
                  <PetWingCard label="날개 스킨" obj={petwing.wingSkin} />
                  <PetWingCard label="탈것" obj={mount} />
                </div>
              </section>
            )}

            {/* 데이터가 거의 비어있을 때 */}
            {!equipList.length && !skillAll.length && (
              <div className="text-xs text-muted-foreground italic text-center py-4">
                응답에 장비·스킬 데이터가 없습니다. (응답 키: {Object.keys(root).join(", ") || "없음"})
              </div>
            )}
          </div>
        )}
    </>
  );

  // 풀스크린 패널 모드 — Dialog 래퍼 없이 윈도우 전체 사용
  if (standalone) {
    return (
      <div className="h-screen w-screen flex flex-col p-4 gap-3 bg-background">
        <div className="flex flex-col space-y-1.5">
          {headerTitle}
        </div>
        {body}
      </div>
    );
  }

  // 기본 모달 모드 — Dialog 래퍼
  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent
        className="max-w-5xl w-[min(1200px,96vw)] h-[min(900px,calc(100vh-32px))] max-h-[calc(100vh-32px)] flex flex-col p-4 gap-3"
        hideCloseButton
      >
        <DialogHeader>
          <DialogTitle asChild>{headerTitle}</DialogTitle>
        </DialogHeader>
        {body}
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, value, highlight }: { label: string; value: string; highlight?: "gold" }) {
  return (
    <div className="rounded border bg-background/50 px-2 py-1.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-bold tabular-nums", highlight === "gold" && "text-gold")}>{value}</div>
    </div>
  );
}

/** 장비 슬롯 — 클릭 시 상세 옵션 패널 토글, 호버 시 카드형 툴팁 미리보기 */
type EquipRowProps = {
  slotKey: string;
  item: any;
  expanded: boolean;
  detail?: { loading?: boolean; error?: string | null; data?: any };
  onToggle: () => void;
  onHover?: () => void;
  classId?: string;
};
function EquipRow({ slotKey, item, expanded, detail, onToggle, onHover, classId = "" }: EquipRowProps) {
  const slotLabel = SLOT_KO[slotKey] ?? slotKey;
  if (!item) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded border bg-background/30 text-xs opacity-50">
        <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0 text-muted-foreground">—</div>
        <span className="text-[10px] text-muted-foreground w-12 flex-shrink-0">{slotLabel}</span>
        <span className="text-[11px] text-muted-foreground italic">미착용</span>
      </div>
    );
  }
  const grade: string = item?.grade ?? "Normal";
  const ench: number = Number(item?.enchantLevel ?? 0);
  const exceed: number = Number(item?.exceedLevel ?? 0);
  const icon: string | undefined = item?.icon;
  const name: string = item?.name ?? "-";
  const gradeCol = gradeColorStyle(grade);
  const gradeBox = gradeBoxStyle(grade);
  const gradeKo = GRADE_KO[grade] ?? grade;

  const button = (
    <button
      type="button"
      onClick={onToggle}
      onMouseEnter={onHover}
      onFocus={onHover}
      className="w-full flex items-center gap-2 px-2 py-1.5 text-xs text-left hover:bg-accent/5"
      title={`${gradeKo}${ench ? ` +${ench}` : ""}${exceed ? ` ★${exceed}` : ""}`}
    >
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="w-7 h-7 rounded flex-shrink-0" loading="lazy" />
      ) : (
        <div className="w-7 h-7 rounded bg-muted flex items-center justify-center flex-shrink-0">?</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted-foreground truncate">{slotLabel}</div>
        <div className="font-bold truncate" style={gradeCol} title={name}>
          {ench > 0 && <span className="text-[10px] mr-0.5 text-gold-light">+{ench}</span>}
          {exceed > 0 && <span className="text-[10px] mr-0.5 text-amber-400">★{exceed}</span>}
          {name}
        </div>
      </div>
      {expanded ? <ChevronUp className="h-3 w-3 text-muted-foreground" /> : <ChevronDown className="h-3 w-3 text-muted-foreground" />}
    </button>
  );

  return (
    <div className={cn("rounded border", expanded && "ring-1 ring-gold/30")} style={gradeBox}>
      <Tooltip>
        <TooltipTrigger asChild>{button}</TooltipTrigger>
        <TooltipContent
          side="right"
          align="start"
          avoidCollisions
          collisionPadding={16}
          className="w-[360px] p-3 bg-popover text-popover-foreground border shadow-xl"
        >
          <div className="flex items-center gap-2 pb-2 mb-2 border-b">
            {icon ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={icon} alt="" className="w-8 h-8 rounded flex-shrink-0" loading="lazy" />
            ) : (
              <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">?</div>
            )}
            <div className="min-w-0 flex-1">
              <div className="text-[10px] text-muted-foreground">{slotLabel} · {gradeKo}</div>
              <div className="font-bold text-sm truncate" style={gradeCol} title={name}>
                {ench > 0 && <span className="text-[11px] mr-1 text-gold-light">+{ench}</span>}
                {exceed > 0 && <span className="text-[11px] mr-1 text-amber-400">★{exceed}</span>}
                {name}
              </div>
            </div>
          </div>
          <ItemDetailPanel data={detail?.data} loading={detail?.loading} error={detail?.error ?? null} classId={classId} />
        </TooltipContent>
      </Tooltip>
      {expanded && (
        <div className="border-t px-2 py-1.5">
          <ItemDetailPanel data={detail?.data} loading={detail?.loading} error={detail?.error ?? null} classId={classId} />
        </div>
      )}
    </div>
  );
}

/** 아르카나 슬롯 — 좌: 큰 이미지+카드명 / 우: 옵션 수직 정렬 */
function ArcanaRow({ slotKey, item, detail, classId = "" }: { slotKey: string; item: any; detail?: { loading?: boolean; error?: string | null; data?: any }; classId?: string }) {
  const slotLabel = SLOT_KO[slotKey] ?? slotKey;
  if (!item) {
    return (
      <div className="flex items-center gap-3 px-3 py-2.5 rounded border bg-background/30 text-xs opacity-50">
        <div className="w-14 h-14 rounded bg-muted flex items-center justify-center flex-shrink-0 text-2xl">🃏</div>
        <div className="flex flex-col gap-0.5">
          <span className="text-[11px] text-muted-foreground">{slotLabel}</span>
          <span className="text-sm text-muted-foreground italic">미착용</span>
        </div>
      </div>
    );
  }
  const grade: string = item?.grade ?? "Normal";
  const ench: number = Number(item?.enchantLevel ?? 0);
  const icon: string | undefined = item?.icon;
  const name: string = item?.name ?? "-";
  const gradeCol = gradeColorStyle(grade);
  const gradeBox = gradeBoxStyle(grade);

  return (
    <div className="flex items-stretch gap-3 px-3 py-2.5 rounded border" style={gradeBox}>
      {/* 좌측: 큰 아이콘 + 슬롯 라벨 + 카드명 (강화레벨 포함) */}
      <div className="flex flex-col items-center gap-1.5 flex-shrink-0 w-[140px]">
        {icon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={icon} alt="" className="w-20 h-20 rounded-md flex-shrink-0" loading="lazy" />
        ) : (
          <div className="w-20 h-20 rounded-md bg-muted flex items-center justify-center flex-shrink-0 text-3xl">🃏</div>
        )}
        <div className="text-[11px] text-muted-foreground">{slotLabel}</div>
        <div className="font-extrabold text-sm leading-tight text-center break-keep" style={gradeCol} title={name}>
          {ench > 0 && <span className="text-xs mr-1 text-gold-light">+{ench}</span>}
          {name}
        </div>
      </div>
      {/* 우측: 옵션(스킬) 수직 정렬 */}
      <div className="flex-1 min-w-0 border-l pl-3">
        <ItemDetailPanel data={detail?.data} loading={detail?.loading} error={detail?.error ?? null} compact classId={classId} />
      </div>
    </div>
  );
}

function PetWingCard({ label, obj }: { label: string; obj: any }) {
  if (!obj?.name) {
    return (
      <div className="flex items-center gap-2 px-2 py-1.5 rounded border bg-background/30 text-xs opacity-50">
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">—</div>
        <div className="min-w-0">
          <div className="text-[10px] text-muted-foreground">{label}</div>
          <div className="italic text-muted-foreground text-[11px]">미장착</div>
        </div>
      </div>
    );
  }
  const grade = obj?.grade ?? "Normal";
  const gradeCol = gradeColorStyle(grade);
  const gradeBox = gradeBoxStyle(grade);
  const icon = obj?.icon;
  const ench = Number(obj?.enchantLevel ?? 0);
  const lvl = obj?.level ? `Lv.${obj.level}` : null;
  return (
    <div className="flex items-center gap-2 px-2 py-1.5 rounded border text-xs" style={gradeBox}>
      {icon ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={icon} alt="" className="w-8 h-8 rounded flex-shrink-0" loading="lazy" />
      ) : (
        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">?</div>
      )}
      <div className="min-w-0 flex-1">
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className="font-bold truncate" style={gradeCol} title={obj.name}>
          {ench > 0 && <span className="text-[10px] mr-0.5 text-gold-light">+{ench}</span>}
          {obj.name}
        </div>
        {lvl && <div className="text-[10px] text-muted-foreground">{lvl}</div>}
      </div>
    </div>
  );
}

/** 스킬 객체에서 레벨 추출 — V4.0.9 호환 + 다중 필드 fallback */
function skillLv(s: any): number | null {
  const candidates = [s?.skillLevel, s?.level, s?.lv, s?.lvl, s?.engraveLevel];
  for (const v of candidates) {
    const n = Number(v);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return null;
}

function SkillGrid({ skills, classId = "" }: { skills: any[]; classId?: string }) {
  const grouped: Record<string, any[]> = {};
  skills.forEach((s) => {
    const cat = s.category || "Other";
    (grouped[cat] ??= []).push(s);
  });
  const order = ["Active", "Passive", "Dp"];
  const cats = [...order.filter((k) => grouped[k]), ...Object.keys(grouped).filter((k) => !order.includes(k))];

  const [popupSkill, setPopupSkill] = useState<any>(null);

  return (
    <>
    <div className="space-y-2">
      {cats.map((cat) => (
        <div key={cat}>
          <div className="text-[11px] font-bold mb-1">
            {SKILL_CAT_KO[cat] ?? cat} <span className="text-muted-foreground">({grouped[cat].length})</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
            {grouped[cat].map((s, i) => {
              const lv = skillLv(s);
              // 아르카나 동등 — 카테고리/총레벨 기반 임계치 강조
              const lvStyle = lv !== null ? skillLevelStyle(cat as SkillCategory, lv) : { containerCls: "", lvBg: "" };
              const useThreshold = !!lvStyle.containerCls;
              return (
                <Tooltip key={i} delayDuration={150}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setPopupSkill(s)}
                      className={cn(
                        "flex items-center gap-1.5 px-2 py-1 rounded border text-xs transition-colors text-left w-full",
                        useThreshold
                          ? lvStyle.containerCls
                          : "border-border bg-background/50 hover:bg-accent/10"
                      )}
                    >
                      {s.icon ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={s.icon} alt="" className="w-5 h-5 rounded flex-shrink-0" loading="lazy" />
                      ) : (
                        <div className="w-5 h-5 rounded bg-muted flex items-center justify-center text-[10px]">✨</div>
                      )}
                      <span className="truncate flex-1">{s.name}</span>
                      {lv !== null && (
                        <span className={cn(
                          "inline-flex items-center px-1 rounded text-[10px] font-extrabold tabular-nums flex-shrink-0",
                          useThreshold ? `${lvStyle.lvBg} text-background` : "text-gold-light"
                        )}>
                          Lv.{lv}
                        </span>
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-[440px] p-3 bg-card text-card-foreground border shadow-xl">
                    <ArcanaSkillTooltipOrFallback apiSkill={s} cat={cat} lv={lv} classId={classId} />
                  </TooltipContent>
                </Tooltip>
              );
            })}
          </div>
        </div>
      ))}
    </div>
    {/* 클릭 팝업 — 스킬 상세 */}
    {popupSkill && (
      <Dialog open={!!popupSkill} onOpenChange={(v) => !v && setPopupSkill(null)}>
        <DialogContent className="max-w-md p-4">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {popupSkill.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={popupSkill.icon} alt="" className="w-8 h-8 rounded" />
              )}
              <span>{popupSkill.name}</span>
              <span className="text-xs text-muted-foreground font-normal">
                {SKILL_CAT_KO[popupSkill.category] ?? popupSkill.category}
              </span>
            </DialogTitle>
          </DialogHeader>
          <SkillTooltipContent skill={popupSkill} cat={popupSkill.category} lv={skillLv(popupSkill)} expanded />
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}

/**
 * 장비창 스킬 툴팁 — 아르카나 Skill 찾으면 SkillHoverTooltip(✨ 스킬 카드와 동일),
 * 없으면 기존 SkillTooltipContent로 폴백.
 */
function ArcanaSkillTooltipOrFallback({
  apiSkill, cat, lv, classId,
}: {
  apiSkill: any;
  cat: string;
  lv: number | null;
  classId: string;
}) {
  const arcanaSkill = useSkillStore((s) => {
    const sid = Number(apiSkill.skillId ?? apiSkill.id);
    if (Number.isFinite(sid)) {
      const byId = s.skills.find((x) => x.skillId === sid);
      if (byId) return byId;
    }
    return s.skills.find((x) => x.name === apiSkill.name) ?? null;
  });

  if (arcanaSkill) {
    // 아르카나 SkillHoverTooltip (동일 UI). build=null → 카드/장비 분배 행 생략, 기본 레벨 표기.
    return <SkillHoverTooltip skill={arcanaSkill} build={null} jobId={classId} />;
  }

  // arcana DB에 없는 스킬 — 기존 툴팁 폴백
  return <SkillTooltipContent skill={apiSkill} cat={cat} lv={lv} />;
}

/** 스킬 카드 툴팁/팝업 내용 — 아이콘 + 이름 + Lv + 특화 효과 (액티브/스티그마).
 *  위험/경고/보통 텍스트 표기 제거 (시각적 임계치 강조는 칩에서만). */
function SkillTooltipContent({ skill, cat, lv, expanded }: { skill: any; cat: string; lv: number | null; expanded?: boolean }) {
  const lvStyle = lv !== null ? skillLevelStyle(cat as SkillCategory, lv) : { containerCls: "", lvBg: "" };
  // 스킬 마스터 룩업 — Inven skillId 또는 이름 매칭
  const skillMaster = useSkillStore((s) => {
    const sid = Number(skill.skillId ?? skill.id);
    if (Number.isFinite(sid)) {
      const byId = s.skills.find((x) => x.skillId === sid);
      if (byId) return byId;
    }
    return s.skills.find((x) => x.name === skill.name) ?? null;
  });
  const effLevels = SPECIAL_EFFECT_LEVELS[cat as SkillCategory] ?? [];
  const showEffects = effLevels.length > 0;

  return (
    <div className="space-y-1.5 text-xs">
      {!expanded && (
        <div className="flex items-center gap-2 pb-1 border-b">
          {skill.icon && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={skill.icon} alt="" className="w-6 h-6 rounded" loading="lazy" />
          )}
          <span className="font-extrabold text-sm">{skill.name}</span>
          <span className="text-[10px] text-muted-foreground">{SKILL_CAT_KO[cat] ?? cat}</span>
          {lv !== null && (
            <span className={cn(
              "ml-auto inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-extrabold tabular-nums",
              lvStyle.lvBg ? `${lvStyle.lvBg} text-background` : "text-cat-arcana"
            )}>
              Lv.{lv}
            </span>
          )}
        </div>
      )}
      {/* 특화 효과 — 액티브(8/12/16) / 스티그마(5/10/15/20) */}
      {showEffects && (
        <div className="space-y-0.5">
          <div className="text-[10px] font-bold text-muted-foreground">✨ 특화 효과</div>
          {effLevels.map((eLv) => {
            const reached = lv !== null && lv >= eLv;
            const effs = (skillMaster?.specialEffects || []).filter((e) => e.level === eLv);
            return (
              <div
                key={eLv}
                className={cn(
                  "rounded px-1.5 py-1 text-[13px]",
                  reached ? "bg-cat-arcana/10 text-foreground" : "bg-muted/20 text-muted-foreground opacity-70"
                )}
              >
                <div className="flex items-start gap-1.5">
                  <span className="font-extrabold tabular-nums">Lv.{eLv}</span>
                  <span className="flex-shrink-0">{reached ? "✓" : "○"}</span>
                  <div className="flex-1 min-w-0 space-y-0.5">
                    {effs.length === 0 ? (
                      <span className="italic opacity-60">(스킬 DB에 효과 미정의)</span>
                    ) : (
                      effs.map((e, i) => (
                        <div key={i} className="leading-snug">
                          {effs.length > 1 && <span className="text-muted-foreground/70 mr-1">·</span>}
                          {e.text}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
      {expanded && skill.description && (
        <div className="text-[11px] whitespace-pre-wrap pt-1 border-t">{String(skill.description)}</div>
      )}
    </div>
  );
}
