"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OverlayKind = "notifier" | "barrack" | "party" | "arcana";

/** 색상+투명도 한 쌍 — 모든 사용자 정의 색상 필드에 공통 사용 */
export type ColorAlpha = {
  /** hex 색상 (#rrggbb). 빈 문자열 = 미설정(투명) */
  color: string;
  /** 0(투명) ~ 1(불투명) */
  alpha: number;
};

/** 테두리 = 색상+투명도 + 두께(px) */
export type BorderStyle = ColorAlpha & {
  /** 두께 px. 0이면 테두리 없음 */
  width: number;
};

/** 알리미 임박 시간 — 시:분:초 단위 */
export type Hms = { h: number; m: number; s: number };

export function hmsToSeconds(t: Hms): number {
  return t.h * 3600 + t.m * 60 + t.s;
}

/** 시계 표시 옵션 */
export type ClockDisplayConfig = {
  /** 카드 중앙 정렬 (false면 우측 정렬) */
  centerAlign: boolean;
  /** 24시간제 (false면 12시간 + AM/PM) */
  hour24: boolean;
  /** 표시 형식 — 토큰 기반:
   *  MM=월, DD=일, ddd=요일(축약, 화/수/목..), HH=24시간, hh=12시간, mm=분, ss=초, A=AM/PM
   *  예: "MM/DD (ddd) HH:mm:ss" */
  format: string;
};

export type NotifierOverlayConfig = {
  /** 알람 켜진 항목만 표시 */
  onlyAlarmOn: boolean;
  /** 그룹 단위 묶음 표시 */
  groupBundles: boolean;
  /** 상단 서버 시계 표시 */
  showClock: boolean;
  /** 시계 표시 옵션 */
  clock: ClockDisplayConfig;
  /** 임계 — 이 시간 이하 항목 강조 (시:분:초) */
  highlightThreshold: Hms;
  /** 임계 초과(예정시간 이미 지난) 항목 — 시간 동안만 표시 후 자동 숨김 */
  overdue: {
    /** 표시 유지 시간 (시:분:초). 0이면 표시 안 함 */
    showDuration: Hms;
    /** 강조 배경/테두리 색상 (hex) — 기본 #420000 */
    color: string;
  };
  /** 확장 모드 */
  expanded: {
    maxItems: number;
  };
  /** 축소 모드 */
  collapsed: {
    enabled: boolean;
    maxItems: number;
    /** 표시한도 초과 시 +N개 더 카드 표시 (클릭 → 확장모드 + /overlay/notifier) */
    showMoreCard: boolean;
  };
};

export type BarrackOverlayConfig = {
  selectedCharId: string | null;
  /** 다중 캐릭터 표시 모드의 슬롯별 캐릭터 ID. 인덱스 = 행 위치.
   *  설정되지 않은 슬롯은 visible 캐릭터 순서대로 자동 채워짐. */
  selectedCharIds: string[];
  selectedContentId: string;
  expanded: {
    /** 추후 옵션 자리 */
  };
  collapsed: {
    enabled: boolean;
    /** 1~10 */
    maxChars: number;
  };
};

/** 카드 한 셋 = 테두리 + 배경 */
export type CardStyle = {
  border: BorderStyle;
  bg: ColorAlpha;
};

/** 카테고리 카드 — 확장/축소 모드 별도 스타일 */
export type CategoryCardStyle = {
  expanded: CardStyle;
  collapsed: CardStyle;
};

/** 상단 상태바 — 배경 + 버튼 스타일 */
export type HeaderStyle = {
  /** 상태바 배경 */
  bg: ColorAlpha;
  /** 버튼 색상 (활성/비활성 통합 텐트 — 기본 #fbbf24 amber) */
  buttonColor: ColorAlpha;
  /** 버튼 배율 0.7 ~ 1.5 — 아이콘/패딩 비례 적용 */
  buttonScale: number;
};

export type OverlayVisualConfig = {
  /** 오버레이 윈도우 자체 테두리 */
  windowBorder: BorderStyle;
  /** 오버레이 윈도우 자체 배경 */
  windowBg: ColorAlpha;
  /** 상단 상태바 */
  header: HeaderStyle;
  /** 카테고리별 섹션 카드 — 확장/축소 모드 별도 */
  notifierCard: CategoryCardStyle;
  barrackCard: CategoryCardStyle;
  partyCard: CategoryCardStyle;
  arcanaCard: CategoryCardStyle;
};

/** 축소 모드 하위 모드: normal = 알림+배럭 / party = 파티 세트카드 */
export type CollapsedMode = "normal" | "party";

/** 파티 오버레이(축소 모드의 party 하위 모드) 설정 */
export type PartyOverlayConfig = {
  /** 선택된 파티 그룹 ID (null=활성 그룹 사용) */
  selectedGroupId: string | null;
  /** 표시할 세트 인덱스 목록(0-based). 비어있으면 전체. */
  selectedSetIndices: number[];
};

/** 사용자 정의 단축키 바인딩 — 통합 설정에서 명령+단축키 추가 */
export type HotkeyBinding = {
  id: string;
  /** 명령 식별자 (HOTKEY_COMMANDS의 id) */
  cmd: string;
  /** N번째 매개변수 — needsN 명령에만 사용 (1-based) */
  n?: number;
  /** 단축키 조합 — "Ctrl+Shift+K" 등 */
  combo: string;
  /** 활성/비활성 토글 (false 시 글로벌 등록 안 함) */
  enabled: boolean;
};

export type OverlayState = {
  activeTab: OverlayKind;
  collapsed: boolean;
  /** 축소 모드 하위 모드 — 일반(알림+배럭) / 파티 */
  collapsedMode: CollapsedMode;
  passthroughHotkey: string;
  /** 사용자 정의 단축키 — 통합 설정 단축키 카드에서 추가/관리 */
  customHotkeys: HotkeyBinding[];
  /** 헤더 숨기기/보이기 단축키 (기본 Alt+1) */
  headerHiddenHotkey: string;
  /** 헤더 숨김 상태 (단축키로 토글) */
  headerHidden: boolean;
  /** 오버레이 전체 투명도 (CSS opacity) — 0.1 ~ 1.0. 헤더/본문 모두 영향 */
  overallOpacity: number;
  /** 전체 배율 — 0.7 ~ 1.5. 윈도우 크기 + 콘텐츠 폰트크기 동시 적용 */
  scale: number;
  /** 텍스트 배율 — 0.7 ~ 1.5. root font-size에 추가 곱해짐 */
  textScale: number;
  /** @deprecated v8 이전 — 단일 위치. 모드별 분리로 이전 */
  windowPos: { x: number; y: number } | null;
  /** 확장 모드 마지막 위치 (LogicalPosition) */
  expandedPos: { x: number; y: number } | null;
  /** 축소(normal) 모드 마지막 위치 (LogicalPosition) */
  collapsedPos: { x: number; y: number } | null;
  /** 축소(party) 모드 마지막 위치 */
  collapsedPartyPos: { x: number; y: number } | null;
  /** 사용자가 수동 리사이즈한 "base" 크기 (scale=1 기준) */
  expandedSize: { w: number; h: number };
  /** 축소(normal) 모드 base 크기 */
  collapsedSize: { w: number; h: number };
  /** 축소(party) 모드 base 크기 */
  collapsedPartySize: { w: number; h: number };
  /** 확장 모드 iframe URL — 카테고리별 마지막 선택 페이지 */
  iframeUrls: Record<OverlayKind, string>;
  visual: OverlayVisualConfig;
  notifier: NotifierOverlayConfig;
  barrack: BarrackOverlayConfig;
  party: { placeholder: true };
  arcana: { placeholder: true };
  /** 파티 오버레이(축소 모드의 party 하위 모드) 설정 */
  partyOverlay: PartyOverlayConfig;
};

type Store = OverlayState & {
  setActiveTab: (t: OverlayKind) => void;
  setCollapsed: (v: boolean) => void;
  setCollapsedMode: (m: CollapsedMode) => void;
  setPassthroughHotkey: (s: string) => void;
  setHeaderHiddenHotkey: (s: string) => void;
  setCustomHotkeys: (list: HotkeyBinding[]) => void;
  upsertCustomHotkey: (b: HotkeyBinding) => void;
  removeCustomHotkey: (id: string) => void;
  setHeaderHidden: (v: boolean) => void;
  setOverallOpacity: (v: number) => void;
  setScale: (v: number) => void;
  setTextScale: (v: number) => void;
  setWindowPos: (p: { x: number; y: number } | null) => void;
  setExpandedPos: (p: { x: number; y: number } | null) => void;
  setCollapsedPos: (p: { x: number; y: number } | null) => void;
  setCollapsedPartyPos: (p: { x: number; y: number } | null) => void;
  setExpandedSize: (s: { w: number; h: number }) => void;
  setCollapsedSize: (s: { w: number; h: number }) => void;
  setCollapsedPartySize: (s: { w: number; h: number }) => void;
  setIframeUrl: (tab: OverlayKind, url: string) => void;
  patchVisual: (p: Partial<OverlayVisualConfig>) => void;
  patchNotifier: (p: Partial<NotifierOverlayConfig>) => void;
  patchBarrack: (p: Partial<BarrackOverlayConfig>) => void;
  patchPartyOverlay: (p: Partial<PartyOverlayConfig>) => void;
};

const ACCENT_NOTIFIER = "#a78bfa";
const ACCENT_BARRACK = "#60a5fa";
const ACCENT_PARTY = "#34d399";
const ACCENT_ARCANA = "#fb7185";

const defaultCardCollapsed = (accent: string): CardStyle => ({
  border: { color: accent, alpha: 0.4, width: 1 },
  bg: { color: "#0a0c12", alpha: 0.6 },
});

const defaultCardExpanded = (accent: string): CardStyle => ({
  border: { color: accent, alpha: 0.3, width: 1 },
  bg: { color: "#0a0c12", alpha: 0.5 },
});

const mkCategoryCard = (accent: string): CategoryCardStyle => ({
  expanded: defaultCardExpanded(accent),
  collapsed: defaultCardCollapsed(accent),
});

const defaultHeader: HeaderStyle = {
  bg: { color: "#fbbf24", alpha: 0.1 },
  buttonColor: { color: "#fbbf24", alpha: 1.0 },
  buttonScale: 1.0,
};

const defaultVisual: OverlayVisualConfig = {
  windowBorder: { color: "#fbbf24", alpha: 0, width: 0 },
  windowBg: { color: "#0a0c12", alpha: 0 },
  header: defaultHeader,
  notifierCard: mkCategoryCard(ACCENT_NOTIFIER),
  barrackCard: mkCategoryCard(ACCENT_BARRACK),
  partyCard: mkCategoryCard(ACCENT_PARTY),
  arcanaCard: mkCategoryCard(ACCENT_ARCANA),
};

const defaultClock: ClockDisplayConfig = {
  centerAlign: true,
  hour24: true,
  format: "MM/DD (ddd) HH:mm:ss",
};

const defaultNotifier: NotifierOverlayConfig = {
  onlyAlarmOn: true,
  groupBundles: true,
  showClock: true,
  clock: defaultClock,
  highlightThreshold: { h: 0, m: 5, s: 0 },
  overdue: { showDuration: { h: 0, m: 5, s: 0 }, color: "#420000" },
  expanded: { maxItems: 12 },
  collapsed: { enabled: true, maxItems: 5, showMoreCard: true },
};

const defaultBarrack: BarrackOverlayConfig = {
  selectedCharId: null,
  selectedCharIds: [],
  selectedContentId: "expedition",
  expanded: {},
  collapsed: { enabled: true, maxChars: 1 },
};

// 빌드 스냅샷 적용 (오버레이 통합 설정 기본값)
import { BUILD_SNAPSHOT, hasSnapshot } from "@/lib/defaults/snapshot";
const overlaySnapshot = hasSnapshot("overlay") ? (BUILD_SNAPSHOT.overlay ?? {}) : {};

export const useOverlayStore = create<Store>()(
  persist(
    (set) => ({
      activeTab: "notifier",
      collapsed: false,
      collapsedMode: "normal",
      passthroughHotkey: "Alt+`",
      headerHiddenHotkey: "Alt+1",
      customHotkeys: [],
      headerHidden: false,
      overallOpacity: 1.0,
      scale: 1.0,
      textScale: 1.0,
      windowPos: null,
      expandedPos: null,
      collapsedPos: null,
      collapsedPartyPos: null,
      expandedSize: { w: 380, h: 480 },
      collapsedSize: { w: 280, h: 140 },
      collapsedPartySize: { w: 360, h: 360 },
      iframeUrls: {
        notifier: "/notifier",
        barrack: "/dashboard",
        party: "/party",
        arcana: "/arcana",
      },
      visual: defaultVisual,
      notifier: defaultNotifier,
      barrack: defaultBarrack,
      party: { placeholder: true },
      arcana: { placeholder: true },
      partyOverlay: { selectedGroupId: null, selectedSetIndices: [] },
      // 스냅샷 override — 위 기본값 위에 덮어쓰기
      ...overlaySnapshot,
      setActiveTab: (t) => set({ activeTab: t }),
      setCollapsed: (v) => set({ collapsed: v }),
      setCollapsedMode: (m) => set({ collapsedMode: m }),
      setPassthroughHotkey: (s) => set({ passthroughHotkey: s }),
      setCustomHotkeys: (list) => set({ customHotkeys: list }),
      upsertCustomHotkey: (b) =>
        set((st) => {
          const idx = st.customHotkeys.findIndex((x) => x.id === b.id);
          const next = st.customHotkeys.slice();
          if (idx >= 0) next[idx] = b;
          else next.push(b);
          return { customHotkeys: next };
        }),
      removeCustomHotkey: (id) =>
        set((st) => ({ customHotkeys: st.customHotkeys.filter((x) => x.id !== id) })),
      setHeaderHiddenHotkey: (s) => set({ headerHiddenHotkey: s }),
      setHeaderHidden: (v) => set({ headerHidden: v }),
      setOverallOpacity: (v) => set({ overallOpacity: Math.max(0.5, Math.min(1.0, v)) }),
      setScale: (v) => set({ scale: Math.max(0.5, Math.min(2.0, v)) }),
      setTextScale: (v) => set({ textScale: Math.max(0.7, Math.min(1.5, v)) }),
      setWindowPos: (p) => set({ windowPos: p }),
      setExpandedPos: (p) => set({ expandedPos: p }),
      setCollapsedPos: (p) => set({ collapsedPos: p }),
      setCollapsedPartyPos: (p) => set({ collapsedPartyPos: p }),
      setExpandedSize: (s) => set({ expandedSize: { w: Math.max(220, s.w), h: Math.max(140, s.h) } }),
      setCollapsedSize: (s) => set({ collapsedSize: { w: Math.max(220, s.w), h: Math.max(140, s.h) } }),
      setCollapsedPartySize: (s) => set({ collapsedPartySize: { w: Math.max(220, s.w), h: Math.max(140, s.h) } }),
      setIframeUrl: (tab, url) => set((s) => ({ iframeUrls: { ...s.iframeUrls, [tab]: url } })),
      patchVisual: (p) => set((s) => ({ visual: { ...s.visual, ...p } })),
      patchNotifier: (p) => set((s) => ({ notifier: { ...s.notifier, ...p } })),
      patchBarrack: (p) => set((s) => ({ barrack: { ...s.barrack, ...p } })),
      patchPartyOverlay: (p) => set((s) => ({ partyOverlay: { ...s.partyOverlay, ...p } })),
    }),
    {
      name: "a2-overlay",
      version: 8,
      migrate: (persisted: unknown, _v) => {
        const p = (persisted ?? {}) as Record<string, unknown>;

        // 알리미
        const oldNotifier = (p.notifier ?? {}) as Record<string, unknown>;
        const oldHighlightMin = typeof oldNotifier.highlightMin === "number" ? oldNotifier.highlightMin : 5;
        const nextNotifier: NotifierOverlayConfig = {
          ...defaultNotifier,
          onlyAlarmOn:
            typeof oldNotifier.onlyAlarmOn === "boolean" ? oldNotifier.onlyAlarmOn : defaultNotifier.onlyAlarmOn,
          groupBundles:
            typeof oldNotifier.groupBundles === "boolean" ? oldNotifier.groupBundles : defaultNotifier.groupBundles,
          showClock: typeof oldNotifier.showClock === "boolean" ? oldNotifier.showClock : defaultNotifier.showClock,
          highlightThreshold:
            typeof (oldNotifier.highlightThreshold as Hms | undefined)?.h === "number"
              ? (oldNotifier.highlightThreshold as Hms)
              : { h: 0, m: oldHighlightMin, s: 0 },
          clock: (() => {
            const c = oldNotifier.clock as Partial<ClockDisplayConfig> | undefined;
            return {
              centerAlign: typeof c?.centerAlign === "boolean" ? c.centerAlign : defaultClock.centerAlign,
              hour24: typeof c?.hour24 === "boolean" ? c.hour24 : defaultClock.hour24,
              format: typeof c?.format === "string" && c.format ? c.format : defaultClock.format,
            };
          })(),
          overdue: (() => {
            const o = oldNotifier.overdue as { showDuration?: Hms; color?: string } | undefined;
            return {
              showDuration:
                typeof o?.showDuration?.h === "number"
                  ? (o.showDuration as Hms)
                  : { h: 0, m: 5, s: 0 },
              color: typeof o?.color === "string" && o.color ? o.color : "#420000",
            };
          })(),
          expanded: {
            maxItems:
              typeof (oldNotifier.expanded as { maxItems?: number } | undefined)?.maxItems === "number"
                ? (oldNotifier.expanded as { maxItems: number }).maxItems
                : typeof oldNotifier.maxItems === "number"
                ? (oldNotifier.maxItems as number)
                : defaultNotifier.expanded.maxItems,
          },
          collapsed: {
            enabled:
              typeof (oldNotifier.collapsed as { enabled?: boolean } | undefined)?.enabled === "boolean"
                ? (oldNotifier.collapsed as { enabled: boolean }).enabled
                : true,
            maxItems:
              typeof (oldNotifier.collapsed as { maxItems?: number } | undefined)?.maxItems === "number"
                ? (oldNotifier.collapsed as { maxItems: number }).maxItems
                : typeof oldNotifier.collapsedMaxItems === "number"
                ? (oldNotifier.collapsedMaxItems as number)
                : defaultNotifier.collapsed.maxItems,
            showMoreCard:
              typeof (oldNotifier.collapsed as { showMoreCard?: boolean } | undefined)?.showMoreCard === "boolean"
                ? (oldNotifier.collapsed as { showMoreCard: boolean }).showMoreCard
                : true,
          },
        };

        // 배럭
        const oldBarrack = (p.barrack ?? {}) as Record<string, unknown>;
        const nextBarrack: BarrackOverlayConfig = {
          selectedCharId:
            typeof oldBarrack.selectedCharId === "string" || oldBarrack.selectedCharId === null
              ? (oldBarrack.selectedCharId as string | null)
              : null,
          selectedCharIds: Array.isArray(oldBarrack.selectedCharIds)
            ? (oldBarrack.selectedCharIds as string[]).filter((x) => typeof x === "string")
            : [],
          selectedContentId:
            typeof oldBarrack.selectedContentId === "string"
              ? (oldBarrack.selectedContentId as string)
              : "expedition",
          expanded: {},
          collapsed: {
            enabled:
              typeof (oldBarrack.collapsed as { enabled?: boolean } | undefined)?.enabled === "boolean"
                ? (oldBarrack.collapsed as { enabled: boolean }).enabled
                : true,
            maxChars:
              typeof (oldBarrack.collapsed as { maxChars?: number } | undefined)?.maxChars === "number"
                ? (oldBarrack.collapsed as { maxChars: number }).maxChars
                : 1,
          },
        };

        // 비주얼 — cardBorder/cardBg 제거, 카테고리 카드는 expanded/collapsed nested로
        const persistedVisual = (p.visual as Record<string, unknown> | undefined) ?? {};
        function normalizeCategoryCard(name: string, accent: string): CategoryCardStyle {
          const old = persistedVisual[name] as Record<string, unknown> | undefined;
          if (!old) return mkCategoryCard(accent);
          // v4 형태: { border, bg } 단일 — collapsed로 매핑, expanded는 default
          if ("border" in old && "bg" in old) {
            return {
              collapsed: old as unknown as CardStyle,
              expanded: defaultCardExpanded(accent),
            };
          }
          // v5+ 형태: { expanded, collapsed }
          return {
            expanded: (old.expanded as CardStyle | undefined) ?? defaultCardExpanded(accent),
            collapsed: (old.collapsed as CardStyle | undefined) ?? defaultCardCollapsed(accent),
          };
        }
        const nextVisual: OverlayVisualConfig = {
          windowBorder: (persistedVisual.windowBorder as BorderStyle | undefined) ?? defaultVisual.windowBorder,
          windowBg: (persistedVisual.windowBg as ColorAlpha | undefined) ?? defaultVisual.windowBg,
          header: ((persistedVisual.header as HeaderStyle | undefined) ?? defaultHeader),
          notifierCard: normalizeCategoryCard("notifierCard", ACCENT_NOTIFIER),
          barrackCard: normalizeCategoryCard("barrackCard", ACCENT_BARRACK),
          partyCard: normalizeCategoryCard("partyCard", ACCENT_PARTY),
          arcanaCard: normalizeCategoryCard("arcanaCard", ACCENT_ARCANA),
        };

        // textSizePx → textScale (10-18px 가정 → 0.7-1.5 매핑)
        let textScale = 1.0;
        if (typeof p.textScale === "number") textScale = p.textScale as number;
        else if (typeof p.textSizePx === "number") {
          // 12px가 기준 → 그 외는 비율로
          textScale = Math.max(0.7, Math.min(1.5, (p.textSizePx as number) / 12));
        }

        const defaultIframeUrls = {
          notifier: "/notifier",
          barrack: "/dashboard",
          party: "/party",
          arcana: "/arcana",
        };
        const persistedIframeUrls = (p.iframeUrls as Record<string, string> | undefined) ?? {};
        const persistedPartyOverlay = (p.partyOverlay as Partial<PartyOverlayConfig> | undefined) ?? {};
        return {
          ...p,
          visual: nextVisual,
          notifier: nextNotifier,
          barrack: nextBarrack,
          activeTab: (p.activeTab as OverlayKind | undefined) ?? "notifier",
          collapsed: typeof p.collapsed === "boolean" ? (p.collapsed as boolean) : false,
          collapsedMode:
            p.collapsedMode === "party" || p.collapsedMode === "normal"
              ? (p.collapsedMode as CollapsedMode)
              : "normal",
          passthroughHotkey: typeof p.passthroughHotkey === "string" ? (p.passthroughHotkey as string) : "Alt+`",
          overallOpacity: typeof p.overallOpacity === "number" ? (p.overallOpacity as number) : 1.0,
          scale: typeof p.scale === "number" ? (p.scale as number) : 1.0,
          textScale,
          windowPos: ((p.windowPos as { x: number; y: number } | null | undefined) ?? null),
          expandedPos: ((p.expandedPos as { x: number; y: number } | null | undefined) ?? (p.windowPos as { x: number; y: number } | null | undefined) ?? null),
          collapsedPos: ((p.collapsedPos as { x: number; y: number } | null | undefined) ?? null),
          collapsedPartyPos: ((p.collapsedPartyPos as { x: number; y: number } | null | undefined) ?? null),
          expandedSize: ((p.expandedSize as { w: number; h: number } | undefined) ?? { w: 380, h: 480 }),
          collapsedSize: ((p.collapsedSize as { w: number; h: number } | undefined) ?? { w: 280, h: 140 }),
          collapsedPartySize: ((p.collapsedPartySize as { w: number; h: number } | undefined) ?? { w: 360, h: 360 }),
          headerHidden: false,  // 항상 false로 초기화
          headerHiddenHotkey: typeof p.headerHiddenHotkey === "string" ? (p.headerHiddenHotkey as string) : "Alt+1",
          customHotkeys: Array.isArray(p.customHotkeys)
            ? (p.customHotkeys as HotkeyBinding[]).filter(
                (b) => b && typeof b.id === "string" && typeof b.cmd === "string" && typeof b.combo === "string"
              )
            : [],
          iframeUrls: { ...defaultIframeUrls, ...persistedIframeUrls },
          partyOverlay: {
            selectedGroupId:
              typeof persistedPartyOverlay.selectedGroupId === "string" || persistedPartyOverlay.selectedGroupId === null
                ? persistedPartyOverlay.selectedGroupId
                : null,
            selectedSetIndices: Array.isArray(persistedPartyOverlay.selectedSetIndices)
              ? persistedPartyOverlay.selectedSetIndices.filter((x): x is number => typeof x === "number")
              : [],
          },
        };
      },
    }
  )
);
