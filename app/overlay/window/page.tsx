"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Pin, PinOff, MousePointer2, X, Bell, BellOff, Sword, Users, Sparkles, Maximize2, Minimize2, GripVertical, MoreHorizontal, ChevronDown, Droplet, ZoomIn, ZoomOut, Play, RefreshCw } from "lucide-react";
import { useNotifierStore } from "@/lib/notifier/store";
import { useActiveAlarms } from "@/lib/notifier/alarm";
import { useNotifierTick } from "@/components/notifier/use-notifier-tick";
import { useOverlayStore, type OverlayKind, hmsToSeconds, type ColorAlpha, type BorderStyle } from "@/lib/overlay/store";
import { nextSpawnMs } from "@/lib/notifier/time";
import { serverNow } from "@/lib/notifier/time-sync";
import { setOverlayPassthrough, setOverlayAlwaysOnTop, closeOverlay, setOverlaySize, setOverlayPosition, getOverlayGeometry, showMainWindow } from "@/lib/overlay/tauri";
import { useUiStore } from "@/lib/ui-store";
import { isTauri } from "@/lib/tauri";
import { cn } from "@/lib/utils";
import type { NotifierItem } from "@/lib/notifier/types";
import { BarrackOverlayPanel } from "@/components/overlay/barrack-panel";
import { PartyOverlayPanel } from "@/components/overlay/party-overlay-panel";

const TABS: { id: OverlayKind; label: string; icon: React.ReactNode; color: string }[] = [
  { id: "notifier", label: "알리미", icon: <Bell className="h-3 w-3" />,     color: "text-cat-notifier" },
  { id: "barrack",  label: "배럭",  icon: <Sword className="h-3 w-3" />,    color: "text-cat-barrack" },
  { id: "party",    label: "파티",  icon: <Users className="h-3 w-3" />,    color: "text-cat-party" },
  { id: "arcana",   label: "아르카나", icon: <Sparkles className="h-3 w-3" />, color: "text-cat-arcana" },
];

const DEFAULT_EXPANDED = { w: 380, h: 480 };
const DEFAULT_COLLAPSED = { w: 280, h: 140 };

/**
 * 잔여 시간 포맷 — 음수(이미 지난 시간)도 동일 형식 + `-` 접두.
 * 예: 30초 / -5초 / 1분 30초 / -2분 10초 / 1시간 5분
 */
function fmtRemain(ms: number): { txt: string; secs: number } {
  const totalSec = Math.trunc(ms / 1000);
  const sign = totalSec < 0 ? "-" : "";
  const abs = Math.abs(totalSec);
  const h = Math.floor(abs / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const s = abs % 60;
  if (h > 0) return { txt: `${sign}${h}시간 ${m}분`, secs: totalSec };
  if (m > 0) return { txt: `${sign}${m}분 ${String(s).padStart(2, "0")}초`, secs: totalSec };
  return { txt: `${sign}${s}초`, secs: totalSec };
}

/** ColorAlpha → rgba() */
const KOR_WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

/** Date를 KST 기준 토큰 형식 문자열로 변환. d는 이미 +9 적용된 Date 가정.
 *  토큰: YYYY/YY/MM/M/DD/D/ddd/dd/HH/H/hh/h/mm/m/ss/s/A/a */
function formatClock(d: Date, fmt: string, hour24: boolean): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  const y = d.getUTCFullYear();
  const mo = d.getUTCMonth() + 1;
  const da = d.getUTCDate();
  const wd = d.getUTCDay();
  const H = d.getUTCHours();
  const mi = d.getUTCMinutes();
  const se = d.getUTCSeconds();
  const h12raw = H % 12;
  const h12 = h12raw === 0 ? 12 : h12raw;
  const ampm = H < 12 ? "AM" : "PM";
  const ampmKo = H < 12 ? "오전" : "오후";
  // 우선순위 길이 순으로 치환 (예: YYYY > YY, HH > H)
  const map: Array<[string, string]> = [
    ["YYYY", String(y)],
    ["YY", String(y).slice(-2)],
    ["MM", pad(mo)],
    ["DD", pad(da)],
    ["ddd", KOR_WEEKDAYS[wd]],
    ["dd", KOR_WEEKDAYS[wd]],
    ["HH", pad(hour24 ? H : h12)],
    ["hh", pad(h12)],
    ["mm", pad(mi)],
    ["ss", pad(se)],
    ["AP", ampm],
    ["ap", ampmKo],
    ["A", ampm],
    ["a", ampmKo],
    ["M", String(mo)],
    ["D", String(da)],
    ["H", String(hour24 ? H : h12)],
    ["h", String(h12)],
    ["m", String(mi)],
    ["s", String(se)],
  ];
  let out = fmt;
  for (const [tok, val] of map) {
    out = out.split(tok).join(String(val));
  }
    return out;
}

function colorAlphaCss(c: ColorAlpha): string {
  if (!c || c.alpha <= 0) return "transparent";
  const hex = c.color || "#0a0c12";
  const r = parseInt(hex.slice(1, 3), 16) || 0;
  const g = parseInt(hex.slice(3, 5), 16) || 0;
  const b = parseInt(hex.slice(5, 7), 16) || 0;
  return `rgba(${r}, ${g}, ${b}, ${c.alpha})`;
}

/** BorderStyle → CSS border 단축형 */
function borderStyleCss(b: BorderStyle): string {
  if (!b || b.width <= 0 || b.alpha <= 0) return "none";
  return `${b.width}px solid ${colorAlphaCss(b)}`;
}

export default function OverlayWindowPage() {
  const activeTab = useOverlayStore((s) => s.activeTab);
  const setActiveTab = useOverlayStore((s) => s.setActiveTab);
  const collapsed = useOverlayStore((s) => s.collapsed);
  const setCollapsed = useOverlayStore((s) => s.setCollapsed);
  const collapsedMode = useOverlayStore((s) => s.collapsedMode);
  const setCollapsedMode = useOverlayStore((s) => s.setCollapsedMode);
  const scale = useOverlayStore((s) => s.scale);
  const textScale = useOverlayStore((s) => s.textScale);
  const overallOpacity = useOverlayStore((s) => s.overallOpacity);
  const setOverallOpacity = useOverlayStore((s) => s.setOverallOpacity);
  const visual = useOverlayStore((s) => s.visual);
  const expandedSize = useOverlayStore((s) => s.expandedSize);
  const collapsedSize = useOverlayStore((s) => s.collapsedSize);
  const setWindowPos = useOverlayStore((s) => s.setWindowPos);
  const setExpandedPos = useOverlayStore((s) => s.setExpandedPos);
  const setCollapsedPos = useOverlayStore((s) => s.setCollapsedPos);
  const setExpandedSize = useOverlayStore((s) => s.setExpandedSize);
  const setCollapsedSize = useOverlayStore((s) => s.setCollapsedSize);
  const setCollapsedPartyPos = useOverlayStore((s) => s.setCollapsedPartyPos);
  const setCollapsedPartySize = useOverlayStore((s) => s.setCollapsedPartySize);

  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    // Tauri 투명 윈도우 — html/body 배경 투명화 + 스크롤바 숨김
    if (typeof document !== "undefined") {
      document.documentElement.style.background = "transparent";
      document.body.style.background = "transparent";
      // 오버레이 webview 전역 스크롤바 숨김
      const style = document.createElement("style");
      style.setAttribute("data-overlay-scrollbar-hide", "1");
      style.textContent = `
        *::-webkit-scrollbar { width: 0; height: 0; display: none; }
        * { scrollbar-width: none; -ms-overflow-style: none; }
        html, body { overflow: hidden; }
      `;
      document.head.appendChild(style);

      // 오버레이는 항상 다크 모드 고정 — 메인 프로그램의 라이트/다크 토글에 영향받지 않음.
      // next-themes가 storage 이벤트로 class를 바꾸려 해도 MutationObserver로 즉시 되돌림.
      const root = document.documentElement;
      const forceDark = () => {
        if (root.classList.contains("light")) root.classList.remove("light");
        if (!root.classList.contains("dark")) root.classList.add("dark");
      };
      forceDark();
      const observer = new MutationObserver(forceDark);
      observer.observe(root, { attributes: true, attributeFilter: ["class"] });

      return () => {
        style.remove();
        observer.disconnect();
      };
    }
  }, []);

  // 전체 배율 + 텍스트 배율 — 축소 모드 한정. 확장 모드는 기본 크기 유지.
  // 헤더는 픽셀 고정이라 영향받지 않음.
  useEffect(() => {
    if (typeof document === "undefined") return;
    if (collapsed) {
      document.documentElement.style.fontSize = `${16 * scale * textScale}px`;
    } else {
      document.documentElement.style.fontSize = "";
    }
    return () => {
      document.documentElement.style.fontSize = "";
    };
  }, [scale, textScale, collapsed]);

  // 마운트 시 store에서 위치/크기 복원. 축소 모드는 normal/party 하위 모드 반영.
  useEffect(() => {
    if (!isTauri()) return;
    const timer = setTimeout(async () => {
      const state = useOverlayStore.getState();
      let base: { w: number; h: number };
      let modePos: { x: number; y: number } | null;
      if (state.collapsed) {
        if (state.collapsedMode === "party") {
          base = state.collapsedPartySize;
          modePos = state.collapsedPartyPos;
        } else {
          base = state.collapsedSize;
          modePos = state.collapsedPos;
        }
      } else {
        base = state.expandedSize;
        modePos = state.expandedPos;
      }
      const s = state.collapsed ? state.scale : 1;
      const pos = modePos ?? state.windowPos;
      try {
        if (pos) {
          await setOverlayPosition(pos.x, pos.y);
        }
        await setOverlaySize(base.w * s, base.h * s);
      } catch {}
    }, 50);
    return () => clearTimeout(timer);
  }, []);

  // scale 변경 시 윈도우 크기 비례 조정 (축소 모드 한정, normal/party 하위 모드 인식)
  const isInitialScale = useRef(true);
  useEffect(() => {
    if (!isTauri()) return;
    if (isInitialScale.current) {
      isInitialScale.current = false;
      return;
    }
    const state = useOverlayStore.getState();
    if (!state.collapsed) return;
    const base = state.collapsedMode === "party" ? state.collapsedPartySize : state.collapsedSize;
    setOverlaySize(base.w * scale, base.h * scale).catch(() => {});
  }, [scale]);

  // 윈도우 resize/move 이벤트 → base 크기 저장. 축소 모드면 base = current/scale, 확장 모드면 base = current
  useEffect(() => {
    if (!isTauri()) return;
    let unlistenResize: (() => void) | null = null;
    let unlistenMove: (() => void) | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const persist = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        timer = null;
        const g = await getOverlayGeometry();
        if (!g) return;
        const state = useOverlayStore.getState();
        // legacy 단일 windowPos 호환 유지
        setWindowPos({ x: g.x, y: g.y });
        // 모드별 위치/크기 저장 — 현재 모드(축소 normal/party, 확장)에 맞춰
        if (state.collapsed) {
          const s = state.scale || 1;
          if (state.collapsedMode === "party") {
            setCollapsedPartyPos({ x: g.x, y: g.y });
            setCollapsedPartySize({ w: g.w / s, h: g.h / s });
          } else {
            setCollapsedPos({ x: g.x, y: g.y });
            setCollapsedSize({ w: g.w / s, h: g.h / s });
          }
        } else {
          setExpandedPos({ x: g.x, y: g.y });
          setExpandedSize({ w: g.w, h: g.h });
        }
      }, 500);
    };

    (async () => {
      const winMod = await import("@tauri-apps/api/window");
      const current = winMod.getCurrentWindow();
      unlistenResize = await current.onResized(() => persist());
      unlistenMove = await current.onMoved(() => persist());
    })();

    return () => {
      if (timer) clearTimeout(timer);
      unlistenResize?.();
      unlistenMove?.();
    };
  }, [setWindowPos, setExpandedPos, setCollapsedPos, setExpandedSize, setCollapsedSize, setCollapsedPartyPos, setCollapsedPartySize]);

  const [passthrough, setPass] = useState(false);
  const [pinned, setPinned] = useState(true);

  async function togglePass() {
    const next = !passthrough;
    setPass(next);
    if (isTauri()) await setOverlayPassthrough(next).catch(() => {});
  }

  // 글로벌 단축키(Alt+`) 토글 이벤트 수신 — Rust가 메인에서 emit
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      const ev = await import("@tauri-apps/api/event");
      unlisten = await ev.listen("overlay-passthrough-toggle", () => {
        setPass((prev) => {
          const next = !prev;
          setOverlayPassthrough(next).catch(() => {});
          return next;
        });
      });
    })();
    return () => {
      unlisten?.();
    };
  }, []);

  // 헤더 숨기기/보이기 단축키 (기본 Alt+1) 이벤트 수신
  const setHeaderHidden = useOverlayStore((s) => s.setHeaderHidden);
  const headerHidden = useOverlayStore((s) => s.headerHidden);
  useEffect(() => {
    if (!isTauri()) return;
    let unlisten: (() => void) | null = null;
    (async () => {
      const ev = await import("@tauri-apps/api/event");
      unlisten = await ev.listen("overlay-header-toggle", () => {
        setHeaderHidden(!useOverlayStore.getState().headerHidden);
      });
    })();
    return () => { unlisten?.(); };
  }, [setHeaderHidden]);
  async function togglePin() {
    const next = !pinned;
    setPinned(next);
    if (isTauri()) await setOverlayAlwaysOnTop(next).catch(() => {});
  }
  async function toggleCollapsed() {
    const next = !collapsed;
    const s = scale || 1;
    const state0 = useOverlayStore.getState();
    // 현재 모드의 위치/크기 저장
    if (isTauri()) {
      const cur = await getOverlayGeometry();
      if (cur) {
        if (collapsed) {
          // 현재가 축소 → 현재 축소 하위 모드 슬롯에 저장
          if (state0.collapsedMode === "party") {
            setCollapsedPartySize({ w: cur.w / s, h: cur.h / s });
            setCollapsedPartyPos({ x: cur.x, y: cur.y });
          } else {
            setCollapsedSize({ w: cur.w / s, h: cur.h / s });
            setCollapsedPos({ x: cur.x, y: cur.y });
          }
        } else {
          // 현재가 확장 → 확장 위치/크기 저장
          setExpandedSize({ w: cur.w, h: cur.h });
          setExpandedPos({ x: cur.x, y: cur.y });
        }
      }
    }
    setCollapsed(next);
    if (isTauri()) {
      const state = useOverlayStore.getState();
      let base: { w: number; h: number };
      let nextPos: { x: number; y: number } | null;
      if (next) {
        // 축소로 전환 → 현재 하위 모드 슬롯 사용
        if (state.collapsedMode === "party") {
          base = state.collapsedPartySize ?? { w: 360, h: 360 };
          nextPos = state.collapsedPartyPos;
        } else {
          base = state.collapsedSize ?? DEFAULT_COLLAPSED;
          nextPos = state.collapsedPos;
        }
      } else {
        base = state.expandedSize ?? DEFAULT_EXPANDED;
        nextPos = state.expandedPos;
      }
      const mult = next ? s : 1;
      await setOverlaySize(base.w * mult, base.h * mult).catch(() => {});
      if (nextPos) {
        await setOverlayPosition(nextPos.x, nextPos.y).catch(() => {});
      }
    }
  }

  /** 축소 모드 내부에서 normal ↔ party 전환. 현재 하위 모드 크기/위치 저장 후 다음 슬롯 복원. */
  async function toggleCollapsedMode() {
    if (!collapsed) return;
    const cur = collapsedMode;
    const next: "normal" | "party" = cur === "normal" ? "party" : "normal";
    const s = scale || 1;
    if (isTauri()) {
      const geom = await getOverlayGeometry();
      if (geom) {
        if (cur === "party") {
          setCollapsedPartySize({ w: geom.w / s, h: geom.h / s });
          setCollapsedPartyPos({ x: geom.x, y: geom.y });
        } else {
          setCollapsedSize({ w: geom.w / s, h: geom.h / s });
          setCollapsedPos({ x: geom.x, y: geom.y });
        }
      }
    }
    setCollapsedMode(next);
    if (isTauri()) {
      const state = useOverlayStore.getState();
      const base = next === "party" ? state.collapsedPartySize : state.collapsedSize;
      const nextPos = next === "party" ? state.collapsedPartyPos : state.collapsedPos;
      await setOverlaySize(base.w * s, base.h * s).catch(() => {});
      if (nextPos) {
        await setOverlayPosition(nextPos.x, nextPos.y).catch(() => {});
      }
    }
  }
  async function handleClose() {
    if (isTauri()) await closeOverlay().catch(() => {});
  }

  const winBg = colorAlphaCss(visual.windowBg);
  const winBorder = borderStyleCss(visual.windowBorder);

  return (
    <div
      className="relative h-screen w-screen flex flex-col text-foreground select-none rounded-md overflow-hidden"
      style={{
        background: winBg,
        border: winBorder,
        // CSS opacity는 outer가 아니라 header/body에 개별 적용 → 탭 바 불투명 유지
      } as React.CSSProperties}
    >
      {/* 헤더 — 드래그 핸들 + 컨트롤. 단축키(기본 Alt+1)로 숨김 토글 가능 */}
      {!headerHidden && (() => {
        const hdr = visual.header;
        const headerBg = colorAlphaCss(hdr.bg);
        const btnColor = colorAlphaCss(hdr.buttonColor);
        const btnScale = hdr.buttonScale;
        const iconSize = Math.round(12 * btnScale);
        const btnPad = Math.max(2, Math.round(4 * btnScale));
        const gripSize = Math.round(14 * btnScale);
        const headerFs = Math.round(11 * btnScale);
        const btnStyle: React.CSSProperties = { padding: btnPad, color: btnColor };
        const btnClass = "rounded hover:bg-accent/20 flex items-center justify-center";
        async function handleShowMain() {
          if (isTauri()) await showMainWindow().catch(() => {});
        }
        return (
          <div
            data-tauri-drag-region
            className="flex items-center gap-[4px] px-[6px] py-[3px] border-b"
            style={{
              fontSize: `${headerFs}px`,
              flexShrink: 0,
              opacity: overallOpacity,
              background: headerBg,
              borderBottomColor: btnColor + "33",
            }}
          >
            {/* 점 6개(GripVertical) — 클릭+드래그로 윈도우 이동 */}
            <GripVertical
              data-tauri-drag-region
              style={{ width: gripSize, height: gripSize, flexShrink: 0, color: btnColor, opacity: 0.85 }}
              className="cursor-grab active:cursor-grabbing"
            />

            {/* 일반/파티 전환 — 축소 모드 한정. 투명도 버튼 좌측. */}
            {collapsed && (
              <button
                onClick={toggleCollapsedMode}
                title={collapsedMode === "party" ? "파티 모드 → 일반 모드로 전환" : "일반 모드 → 파티 모드로 전환"}
                style={btnStyle}
                className={cn(
                  btnClass,
                  "px-1.5 font-extrabold whitespace-nowrap border",
                  collapsedMode === "party"
                    ? "border-cat-party/60 bg-cat-party/10"
                    : "border-current/30"
                )}
              >
                {collapsedMode === "party"
                  ? <Users style={{ width: iconSize, height: iconSize }} />
                  : <Sword style={{ width: iconSize, height: iconSize }} />}
                <span style={{ fontSize: `${Math.max(9, headerFs - 1)}px`, marginLeft: 2 }}>
                  {collapsedMode === "party" ? "파티" : "일반"}
                </span>
              </button>
            )}

            {/* 전체 투명도 — 아이콘 전용 버튼 */}
            <OpacityPopover
              value={overallOpacity}
              onChange={setOverallOpacity}
              iconSize={iconSize}
              btnPad={btnPad}
              color={btnColor}
            />

            {/* 전체 배율 — 축소 모드 한정 */}
            {collapsed && (
              <ScalePopover
                value={scale}
                onChange={(v) => useOverlayStore.getState().setScale(v)}
                iconSize={iconSize}
                btnPad={btnPad}
                color={btnColor}
              />
            )}

            <div className="flex-1" data-tauri-drag-region />

            <button
              onClick={toggleCollapsed}
              title={collapsed ? "확장" : "축소"}
              style={btnStyle}
              className={btnClass}
            >
              {collapsed
                ? <Maximize2 style={{ width: iconSize, height: iconSize }} />
                : <Minimize2 style={{ width: iconSize, height: iconSize }} />}
            </button>

            {/* 메인 프로그램 실행 — 확장/축소 버튼 우측 */}
            <button
              onClick={handleShowMain}
              title="메인 프로그램 창 열기"
              style={btnStyle}
              className={btnClass}
            >
              <Play style={{ width: iconSize, height: iconSize }} />
            </button>

            <button
              onClick={togglePin}
              title={pinned ? "항상 위 끄기" : "항상 위 켜기"}
              style={btnStyle}
              className={cn(btnClass, !pinned && "opacity-50")}
            >
              {pinned
                ? <Pin style={{ width: iconSize, height: iconSize }} />
                : <PinOff style={{ width: iconSize, height: iconSize }} />}
            </button>
            <button
              onClick={togglePass}
              title={passthrough ? "클릭 통과 끄기" : "클릭 통과 켜기"}
              style={btnStyle}
              className={cn(btnClass, !passthrough && "opacity-60")}
            >
              <MousePointer2 style={{ width: iconSize, height: iconSize }} />
            </button>
            <button
              onClick={handleClose}
              title="닫기"
              style={{ padding: btnPad, color: btnColor }}
              className="rounded hover:bg-destructive/30 hover:text-destructive flex items-center justify-center"
            >
              <X style={{ width: iconSize, height: iconSize }} />
            </button>
          </div>
        );
      })()}
      {headerHidden && (
        <button
          onClick={() => setHeaderHidden(false)}
          title="헤더 표시 (단축키 또는 클릭)"
          className="absolute top-0 left-1/2 -translate-x-1/2 z-50 px-2 py-0.5 rounded-b bg-amber-400/30 hover:bg-amber-400/50 text-amber-100 text-[9px] font-bold"
          style={{ pointerEvents: "auto" }}
        >
          ▼
        </button>
      )}

      {/* 탭 바 — 축소 모드에서는 숨김. 픽셀 고정 + 불투명 (전체 투명도 영향 안 받음) */}
      {!collapsed && (
        <div
          className="flex border-b border-border/30 bg-background relative text-foreground"
          style={{ fontSize: "11px", flexShrink: 0, opacity: 1 }}
        >
          {TABS.map((t) => {
            const active = t.id === activeTab;
            return (
              <div key={t.id} className="flex-1 flex">
                <button
                  onClick={() => setActiveTab(t.id)}
                  style={{ paddingTop: 6, paddingBottom: 6, gap: 4 }}
                  className={cn(
                    "flex-1 flex items-center justify-center font-bold transition-colors",
                    active ? `${t.color} bg-current/10` : "text-muted-foreground hover:text-foreground hover:bg-accent/5"
                  )}
                >
                  <span className={active ? t.color : ""}>{t.icon}</span>
                  <span>{t.label}</span>
                </button>
                <TabSubMenu tab={t.id} active={active} color={t.color} />
              </div>
            );
          })}
          <EmbedScaleControl />
        </div>
      )}

      {/* 본문 — 전체 투명도 슬라이더 영향. 탭 바는 영향 없음 */}
      <div
        className="flex-1 min-h-0 overflow-auto"
        style={{ opacity: overallOpacity }}
      >
        {!mounted ? (
          <div className="text-center text-xs text-muted-foreground italic py-6">로딩 중…</div>
        ) : collapsed ? (
          collapsedMode === "party" ? <CollapsedPartyView /> : <CollapsedStack />
        ) : (
          // 확장 모드 — 활성 탭 패널을 카테고리 카드(expanded 스타일)로 감쌈
          <ExpandedPanel tab={activeTab} />
        )}
      </div>
    </div>
  );
}

function Placeholder({ label }: { label: string }) {
  return (
    <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic p-4 text-center">
      {label}
    </div>
  );
}

/** 탭 바 우측 메뉴 펼치기 — 현재 활성 카테고리의 메인 페이지 서브 라우트 표시.
 *  클릭 시 오버레이 webview를 해당 메인 페이지로 네비게이션. */
const TAB_SUBMENUS: Record<OverlayKind, { label: string; href: string }[]> = {
  notifier: [
    { label: "⏰ 타이머", href: "/notifier" },
    { label: "🗂 알리미 DB", href: "/notifier/db" },
    { label: "⚙ 알리미 설정", href: "/notifier/settings" },
  ],
  barrack: [
    { label: "📊 대시보드", href: "/dashboard" },
    { label: "⚡ 심플", href: "/simple" },
    { label: "👤 캐릭터", href: "/characters" },
    { label: "🗂 배럭 DB", href: "/db" },
  ],
  party: [
    { label: "🧩 파티편집", href: "/party" },
    { label: "🗂 캐릭터 DB", href: "/party/db" },
    { label: "⚙ 파티 설정", href: "/party/settings" },
  ],
  arcana: [
    { label: "🎴 카드빌드", href: "/arcana" },
    { label: "🗂 아르카나 DB", href: "/arcana/db-card" },
    { label: "📘 스킬 DB", href: "/arcana/db-skill" },
  ],
};

/** 아이콘 전용 미니 버튼 — 클릭 시 팝오버 (-, 슬라이더, +, 숫자입력, 프리셋) */
type MiniIconProps = {
  icon: React.ReactNode;
  title: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  presets?: number[];
  hint?: string;
  iconSize: number;
  btnPad: number;
  color: string;
};
function MiniIconPopover({ icon, title, value, onChange, min, max, step, presets, hint, iconSize, btnPad, color }: MiniIconProps) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ left: number; top: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement | null>(null);
  const clamp = (v: number) => Math.max(min, Math.min(max, v));
  const dec = () => onChange(clamp(Math.round((value - step) * 100) / 100));
  const inc = () => onChange(clamp(Math.round((value + step) * 100) / 100));
  const active = Math.abs(value - 1) > 0.001;
  void iconSize;

  function toggle() {
    if (!open && btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ left: Math.min(window.innerWidth - 260, Math.max(4, r.left)), top: r.bottom + 4 });
    }
    setOpen((v) => !v);
  }

  return (
    <div className="shrink-0 flex items-center">
      <button
        ref={btnRef}
        onClick={toggle}
        title={`${title} ${Math.round(value * 100)}% — 클릭하여 설정`}
        className={cn("rounded hover:bg-amber-400/15 flex items-center justify-center", !active && "opacity-70")}
        style={{ padding: btnPad, color }}
      >
        {icon}
      </button>
      {open && coords && typeof document !== "undefined" && createPortal(
        <>
          <div className="fixed inset-0 z-[2147483640]" onClick={() => setOpen(false)} />
          <div
            className="fixed border border-border bg-background shadow-lg rounded p-2 space-y-1.5 text-foreground z-[2147483647]"
            style={{ left: coords.left, top: coords.top, minWidth: 240, fontSize: "11px" }}
          >
            <div className="font-bold flex items-center gap-1">
              <span style={{ color }}>{icon}</span>
              <span>{title}</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={dec}
                disabled={value <= min + 0.001}
                title="감소"
                className="shrink-0 inline-flex items-center justify-center rounded border border-border hover:bg-accent/10 disabled:opacity-30"
                style={{ width: 22, height: 22 }}
              >
                <ZoomOut style={{ width: 12, height: 12 }} />
              </button>
              <input
                type="range"
                min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: "#fbbf24" }}
              />
              <button
                onClick={inc}
                disabled={value >= max - 0.001}
                title="증가"
                className="shrink-0 inline-flex items-center justify-center rounded border border-border hover:bg-accent/10 disabled:opacity-30"
                style={{ width: 22, height: 22 }}
              >
                <ZoomIn style={{ width: 12, height: 12 }} />
              </button>
              <input
                type="number"
                min={Math.round(min * 100)} max={Math.round(max * 100)} step={1}
                value={Math.round(value * 100)}
                onChange={(e) => onChange(clamp(Number(e.target.value) / 100 || 1))}
                className="px-1 py-0.5 text-right tabular-nums rounded border bg-background"
                style={{ width: 52, fontSize: "10px" }}
              />
              <span className="text-muted-foreground" style={{ fontSize: "10px" }}>%</span>
            </div>
            {presets && presets.length > 0 && (
              <div className="flex gap-1">
                {presets.map((v) => (
                  <button
                    key={v}
                    onClick={() => onChange(v)}
                    className={cn(
                      "flex-1 rounded border transition-colors",
                      Math.abs(value - v) < 0.025
                        ? "border-amber-400 bg-amber-400/15 text-amber-400"
                        : "border-border hover:bg-accent/10"
                    )}
                    style={{ fontSize: "9px", padding: "2px 0" }}
                  >
                    {Math.round(v * 100)}%
                  </button>
                ))}
              </div>
            )}
            {hint && <p className="text-muted-foreground italic" style={{ fontSize: "9px" }}>{hint}</p>}
          </div>
        </>,
        document.body
      )}
    </div>
  );
}

function OpacityPopover({ value, onChange, iconSize, btnPad, color }: { value: number; onChange: (v: number) => void; iconSize: number; btnPad: number; color: string }) {
  return (
    <MiniIconPopover
      icon={<Droplet style={{ width: iconSize, height: iconSize }} />}
      title="전체 투명도"
      value={value}
      onChange={onChange}
      min={0.5} max={1.0} step={0.05}
      presets={[0.6, 0.75, 0.9, 1.0]}
      hint="오버레이 본문 + 헤더 투명도. 50% ~ 100%"
      iconSize={iconSize}
      btnPad={btnPad}
      color={color}
    />
  );
}

function ScalePopover({ value, onChange, iconSize, btnPad, color }: { value: number; onChange: (v: number) => void; iconSize: number; btnPad: number; color: string }) {
  return (
    <MiniIconPopover
      icon={<ZoomIn style={{ width: iconSize, height: iconSize }} />}
      title="전체 배율 (축소 모드 한정)"
      value={value}
      onChange={onChange}
      min={0.5} max={2.0} step={0.05}
      presets={[0.75, 1.0, 1.25, 1.5]}
      hint="윈도우 크기 + 콘텐츠 폰트 동시 확대/축소"
      iconSize={iconSize}
      btnPad={btnPad}
      color={color}
    />
  );
}

/** 임베드 페이지 텍스트 배율 조절 — 확장 모드 탭바 우측. 메인 스케일 컨트롤과 동일 3등분 카드 형식. */
function EmbedScaleControl() {
  const embedScale = useUiStore((s) => s.embedScale);
  const setEmbedScale = useUiStore((s) => s.setEmbedScale);
  const [open, setOpen] = useState(false);

  const MIN = 0.5, MAX = 2.0, STEP = 0.05;
  const clamp = (v: number) => Math.max(MIN, Math.min(MAX, v));
  const dec = () => setEmbedScale(clamp(Math.round((embedScale - STEP) * 100) / 100));
  const inc = () => setEmbedScale(clamp(Math.round((embedScale + STEP) * 100) / 100));
  const active = Math.abs(embedScale - 1) > 0.001;

  return (
    <div className="relative shrink-0 flex items-center border-l border-border/30 pl-[2px] pr-[2px]">
      <div
        className={cn(
          "inline-flex items-stretch rounded-[3px] border overflow-hidden",
          active ? "border-amber-400/50 text-amber-400" : "border-border/40 text-muted-foreground"
        )}
        style={{ fontSize: "10px", height: 20 }}
      >
        <button
          onClick={dec}
          disabled={embedScale <= MIN + 0.001}
          title="텍스트 배율 축소"
          className="inline-flex items-center justify-center hover:bg-accent/10 disabled:opacity-30 disabled:hover:bg-transparent"
          style={{ width: 18 }}
        >
          <ZoomOut style={{ width: 10, height: 10 }} />
        </button>
        <button
          onClick={() => setOpen((v) => !v)}
          title={`임베드 페이지 텍스트 배율 ${Math.round(embedScale * 100)}% — 클릭하여 상세 설정`}
          className="inline-flex items-center justify-center border-l border-r border-current/30 tabular-nums hover:bg-accent/10"
          style={{ minWidth: 28 }}
        >
          {Math.round(embedScale * 100)}%
        </button>
        <button
          onClick={inc}
          disabled={embedScale >= MAX - 0.001}
          title="텍스트 배율 확대"
          className="inline-flex items-center justify-center hover:bg-accent/10 disabled:opacity-30 disabled:hover:bg-transparent"
          style={{ width: 18 }}
        >
          <ZoomIn style={{ width: 10, height: 10 }} />
        </button>
      </div>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 border border-border bg-background shadow-lg rounded-b p-2 space-y-1.5"
            style={{ minWidth: 240, fontSize: "11px", marginTop: 2 }}
          >
            <div className="font-bold">임베드 텍스트 배율</div>
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={MIN} max={MAX} step={STEP}
                value={embedScale}
                onChange={(e) => setEmbedScale(Number(e.target.value))}
                className="flex-1"
                style={{ accentColor: "#fbbf24" }}
              />
              <input
                type="number"
                min={MIN * 100} max={MAX * 100} step={1}
                value={Math.round(embedScale * 100)}
                onChange={(e) => setEmbedScale(clamp(Number(e.target.value) / 100 || 1))}
                className="px-1 py-0.5 text-right tabular-nums rounded border bg-background"
                style={{ width: 52, fontSize: "10px" }}
              />
              <span className="text-muted-foreground" style={{ fontSize: "10px" }}>%</span>
            </div>
            <div className="flex gap-1">
              {[0.75, 1.0, 1.25, 1.5].map((v) => (
                <button
                  key={v}
                  onClick={() => setEmbedScale(v)}
                  className={cn(
                    "flex-1 rounded border transition-colors",
                    Math.abs(embedScale - v) < 0.025
                      ? "border-amber-400 bg-amber-400/15 text-amber-400"
                      : "border-border hover:bg-accent/10"
                  )}
                  style={{ fontSize: "9px", padding: "2px 0" }}
                >
                  {Math.round(v * 100)}%
                </button>
              ))}
            </div>
            <p className="text-muted-foreground italic" style={{ fontSize: "9px" }}>
              rem 기반 텍스트/카드 비례 조정. 컨텐츠 박스 크기는 부풀지 않음.
            </p>
          </div>
        </>
      )}
    </div>
  );
}

function TabSubMenu({ tab, active, color }: { tab: OverlayKind; active: boolean; color: string }) {
  const [open, setOpen] = useState(false);
  const items = TAB_SUBMENUS[tab];
  const setActiveTab = useOverlayStore((s) => s.setActiveTab);
  const setIframeUrl = useOverlayStore((s) => s.setIframeUrl);
  const currentUrl = useOverlayStore((s) => s.iframeUrls[tab]);

  function go(href: string) {
    setOpen(false);
    setActiveTab(tab);
    setIframeUrl(tab, href);
  }

  return (
    <div className="relative shrink-0 flex items-stretch">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        title={`${tab} 페이지 메뉴`}
        style={{ padding: "0 4px" }}
        className={cn(
          "flex items-center border-l border-border/30 hover:bg-accent/10 transition-colors",
          active ? color : "text-muted-foreground hover:text-foreground"
        )}
      >
        <ChevronDown
          style={{ width: 10, height: 10 }}
          className={cn("transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full z-50 min-w-[180px] border border-border bg-background shadow-lg rounded-b"
            style={{ fontSize: "11px" }}
          >
            {items.map((it) => {
              const isCurrent = currentUrl === it.href;
              return (
                <button
                  key={it.href}
                  onClick={() => go(it.href)}
                  className={cn(
                    "w-full text-left px-3 py-1.5 hover:bg-accent/20 transition-colors",
                    isCurrent && "bg-accent/30 font-semibold"
                  )}
                >
                  {it.label}
                </button>
              );
            })}
            <div
              className="px-3 py-1 border-t border-border/40 text-muted-foreground italic"
              style={{ fontSize: "9px" }}
            >
              탭 전환 + 임베드 페이지 변경
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** 축소 모드 — 파티 뷰. 그룹 dropdown + 세트 선택 + 세트 카드 수직 배치 */
function CollapsedPartyView() {
  const visual = useOverlayStore((s) => s.visual);
  return (
    <div className="flex flex-col h-full p-1.5">
      <CategoryCard style={visual.partyCard.collapsed} grow>
        <PartyOverlayPanel />
      </CategoryCard>
    </div>
  );
}

/** 축소 모드 스택 — 각 카테고리를 collapsed 카드 스타일로 감싸 표시 */
function CollapsedStack() {
  const notifierEnabled = useOverlayStore((s) => s.notifier.collapsed.enabled);
  const barrackEnabled = useOverlayStore((s) => s.barrack.collapsed.enabled);
  const visual = useOverlayStore((s) => s.visual);

  if (!notifierEnabled && !barrackEnabled) {
    return (
      <div className="h-full flex items-center justify-center text-xs text-muted-foreground italic p-4 text-center">
        축소 모드에서 표시할 카테고리가 없음 — 통합 설정에서 활성화하세요.
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full p-1.5 gap-1.5">
      {notifierEnabled && (
        <CategoryCard style={visual.notifierCard.collapsed} grow={!barrackEnabled} cap={barrackEnabled ? "55%" : undefined}>
          <NotifierPanel collapsed />
        </CategoryCard>
      )}
      {barrackEnabled && (
        <CategoryCard style={visual.barrackCard.collapsed} grow>
          <BarrackOverlayPanel collapsed />
        </CategoryCard>
      )}
    </div>
  );
}

function withEmbedded(url: string): string {
  return url + (url.includes("?") ? "&" : "?") + "embedded=1";
}

/** 확장 모드 — 활성 탭의 메인 페이지를 iframe으로 임베드 + 카테고리 카드 스타일 래퍼 */
function ExpandedPanel({ tab }: { tab: OverlayKind }) {
  const visual = useOverlayStore((s) => s.visual);
  const iframeUrls = useOverlayStore((s) => s.iframeUrls);
  const url = iframeUrls[tab];
  const style =
    tab === "notifier"
      ? visual.notifierCard.expanded
      : tab === "barrack"
      ? visual.barrackCard.expanded
      : tab === "party"
      ? visual.partyCard.expanded
      : visual.arcanaCard.expanded;

  return (
    <div className="h-full p-1.5">
      <CategoryCard style={style} grow>
        <iframe
          src={withEmbedded(url)}
          className="w-full h-full border-0 bg-transparent"
          title={`${tab} embedded page`}
        />
      </CategoryCard>
    </div>
  );
}

/** 카테고리 카드 래퍼 — 테두리/배경 사용자 설정 적용 */
function CategoryCard({ style, grow, cap, children }: {
  style: { border: BorderStyle; bg: ColorAlpha };
  grow?: boolean;
  cap?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      className={cn("rounded overflow-hidden", grow ? "flex-1 min-h-0 h-full" : "shrink-0")}
      style={{
        background: colorAlphaCss(style.bg),
        border: borderStyleCss(style.border),
        ...(cap ? { maxHeight: cap } : {}),
      }}
    >
      <div className="h-full overflow-auto">{children}</div>
    </div>
  );
}

function NotifierPanel({ collapsed }: { collapsed: boolean }) {
  // 메인 알림 설정 따라 알람 발화 (오버레이 컨텍스트에서도 사운드/하이라이트)
  useNotifierTick();
  const items = useNotifierStore((s) => s.items);
  const groupDefs = useNotifierStore((s) => s.groupDefs ?? []);
  const markSpawned = useNotifierStore((s) => s.markSpawned);
  const cfg = useOverlayStore((s) => s.notifier);
  const activeAlarms = useActiveAlarms((s) => s.alarms);
  const clearAlarm = useActiveAlarms((s) => s.clear);

  const [, setTick] = useState(0);
  useEffect(() => {
    // 벽시계 초 경계에 맞춰 tick — 메인/오버레이 동시에 같은 초에 갱신
    let timer: ReturnType<typeof setTimeout> | null = null;
    let stopped = false;
    const schedule = () => {
      if (stopped) return;
      const nowMs = Date.now();
      const delay = 1000 - (nowMs % 1000);
      timer = setTimeout(() => {
        setTick((t) => t + 1);
        schedule();
      }, delay);
    };
    const stop = () => {
      stopped = true;
      if (timer) { clearTimeout(timer); timer = null; }
    };
    const start = () => {
      if (!stopped) return;
      stopped = false;
      schedule();
    };
    const onVis = () => {
      if (document.visibilityState === "hidden") stop();
      else {
        setTick((t) => t + 1);
        start();
      }
    };
    if (document.visibilityState !== "hidden") schedule();
    else stopped = true;
    document.addEventListener("visibilitychange", onVis);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  // DB 강제 새로고침 — localStorage에서 재읽기 (메인 프로그램에서 수정한 항목 즉시 반영)
  const [dbRefreshing, setDbRefreshing] = useState(false);
  async function handleDbRefresh() {
    setDbRefreshing(true);
    try {
      // zustand persist rehydrate
      const persist = (useNotifierStore as unknown as { persist?: { rehydrate: () => Promise<void> | void } }).persist;
      if (persist?.rehydrate) {
        await Promise.resolve(persist.rehydrate());
      }
      setTick((t) => t + 1);
    } finally {
      setTimeout(() => setDbRefreshing(false), 400);
    }
  }

  const setCollapsedState = useOverlayStore((s) => s.setCollapsed);
  const setActiveTabState = useOverlayStore((s) => s.setActiveTab);

  const now = serverNow();
  let list: Array<{ item: NotifierItem; nextMs: number | null; remain: number }> = items.map((it) => {
    const nextMs = nextSpawnMs(it, now);
    // remain은 부호 있음 — 음수는 이미 지난 시간 (-Ns로 표시)
    const remain = nextMs ? nextMs - now : Number.POSITIVE_INFINITY;
    return { item: it, nextMs, remain };
  });
  // 표시 기준 — 알리미 DB의 "보이기"(displayHidden=false)로 설정된 항목만.
  //   축소 모드: 보이기 기준만 (알람 ON/OFF 무관) — 사용자가 카드에서 알람만 끄고 표시는 유지 가능
  //   확장 모드: onlyAlarmOn 옵션 시 추가로 알람 ON 항목으로 필터
  list = list.filter((x) => !x.item.displayHidden && x.nextMs !== null);
  if (!collapsed && cfg.onlyAlarmOn) list = list.filter((x) => x.item.notifyEnabled);

  // 초과(과거) 항목 자동 숨김 처리: remain이 음수이고 절대값이 showDuration보다 크면 제외
  const overdueShowSec = hmsToSeconds(cfg.overdue.showDuration);
  list = list.filter((x) => {
    if (x.remain >= 0) return true;
    if (overdueShowSec <= 0) return false;  // 0이면 즉시 숨김
    const elapsedSec = Math.floor(-x.remain / 1000);
    return elapsedSec <= overdueShowSec;
  });

  list.sort((a, b) => a.remain - b.remain);

  const limit = collapsed ? cfg.collapsed.maxItems : cfg.expanded.maxItems;
  const limited = list.slice(0, limit);
  const overflowCount = list.length - limited.length;
  const highlightSec = hmsToSeconds(cfg.highlightThreshold);
  const d = new Date(now + 9 * 3600 * 1000);
  const clock = formatClock(d, cfg.clock.format, cfg.clock.hour24);

  function handleExpandMore() {
    setCollapsedState(false);
    setActiveTabState("notifier");
  }

  return (
    <div className="flex flex-col h-full">
      {cfg.showClock && (
        <div className="px-2 py-1 border-b border-border/30 bg-cat-notifier/5 flex items-center gap-2">
          {/* 좌측: DB 새로고침 — 메인 프로그램 수정사항 즉시 반영 */}
          <button
            onClick={handleDbRefresh}
            disabled={dbRefreshing}
            title="알리미 DB 새로고침 — 메인 프로그램에서 수정한 항목 반영"
            className={cn(
              "flex items-center gap-1 px-1.5 py-0.5 rounded border border-cat-notifier/30 bg-cat-notifier/10 hover:bg-cat-notifier/20 transition-colors text-[10px] font-bold text-cat-notifier",
              dbRefreshing && "opacity-60"
            )}
          >
            <RefreshCw className={cn("h-3 w-3", dbRefreshing && "animate-spin")} />
            DB
          </button>
          {/* 시계 — 정렬 옵션에 따라 가운데/우측 */}
          <div
            className={cn(
              "flex items-center gap-2 flex-1",
              cfg.clock.centerAlign ? "justify-center" : "justify-end"
            )}
          >
            <Bell className="h-3 w-3 text-cat-notifier" />
            <span className="text-sm font-extrabold tabular-nums text-cat-notifier">{clock}</span>
          </div>
        </div>
      )}
      <div className="flex-1 overflow-auto p-1.5 space-y-1">
        {limited.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground italic py-6">— 표시할 항목 없음 —</div>
        ) : (
          limited.map(({ item, remain }) => {
            const { txt, secs } = fmtRemain(remain);
            const isOverdue = remain < 0;
            const isImm = !isOverdue && secs < highlightSec;
            const isImportant = !!item.important;
            // 상태별 색상: 초과 > 임박=빨강 > 중요=노랑 > 일반=회색
            const state: "overdue" | "imm" | "important" | "normal" = isOverdue
              ? "overdue"
              : isImm ? "imm" : isImportant ? "important" : "normal";
            const stateClasses =
              state === "overdue"
                ? "border-[color:var(--overdue-color)] text-foreground"
                : state === "imm"
                ? "border-rose-500/60 bg-rose-500/10 hover:bg-rose-500/20"
                : state === "important"
                ? "border-amber-400/60 bg-amber-400/10 hover:bg-amber-400/20"
                : "border-border/40 bg-background/20 hover:bg-background/40 text-muted-foreground";
            const remainClasses =
              state === "overdue" ? "text-rose-200"
              : state === "imm" ? "text-rose-400"
              : state === "important" ? "text-amber-400"
              : "text-foreground/80";
            const memberGroups = (item.groups ?? []).map((gid) => groupDefs.find((g) => g.id === gid)).filter(Boolean);
            const overdueStyle = state === "overdue"
              ? ({ "--overdue-color": cfg.overdue.color, backgroundColor: cfg.overdue.color, borderColor: cfg.overdue.color } as React.CSSProperties)
              : undefined;
            const isAlarming = !!activeAlarms[item.id];
            return (
              <button
                key={item.id}
                onClick={() => { markSpawned(item.id); clearAlarm(item.id); }}
                title={isAlarming
                  ? "🔔 알람 — 클릭하여 잡음"
                  : isOverdue ? "예정 시간 지남 — 클릭하여 다음 사이클" : "클릭 — 잡음(쿨타임 재시작)"}
                style={overdueStyle}
                className={cn(
                  "w-full flex items-center gap-2 px-2 py-1 rounded border text-xs transition-colors text-left cursor-pointer",
                  stateClasses,
                  isAlarming && "ring-2 ring-amber-400 alarm-pulse"
                )}
              >
                {item.notifyEnabled
                  ? <Bell className="h-3 w-3 text-cat-notifier flex-shrink-0" />
                  : <BellOff className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                }
                <span
                  className={cn("font-extrabold truncate flex-1", collapsed && "text-white")}
                  title={item.name}
                >
                  {item.name}
                </span>
                {!collapsed && cfg.groupBundles && memberGroups.length > 0 && (
                  <span className="text-[9px] px-1 rounded bg-cat-notifier/15 text-cat-notifier flex-shrink-0">
                    {memberGroups[0]!.name}
                  </span>
                )}
                <span
                  className={cn(
                    "tabular-nums font-bold flex-shrink-0",
                    collapsed ? "text-white" : remainClasses
                  )}
                >
                  {txt}
                </span>
              </button>
            );
          })
        )}
        {/* +N개 더 카드 — 축소 모드 + 설정 활성 시 */}
        {collapsed && overflowCount > 0 && cfg.collapsed.showMoreCard && (
          <button
            onClick={handleExpandMore}
            title="확장모드로 전환 — 알리미 전체 보기"
            className="w-full flex items-center gap-2 px-2 py-1 rounded border border-dashed border-cat-notifier/40 bg-cat-notifier/5 hover:bg-cat-notifier/15 text-xs transition-colors text-left cursor-pointer"
          >
            <MoreHorizontal className="h-3 w-3 text-cat-notifier flex-shrink-0" />
            <span className="font-extrabold truncate flex-1 text-cat-notifier">
              +{overflowCount}개 더
            </span>
            <span className="text-[10px] text-muted-foreground">클릭 — 확장</span>
          </button>
        )}
      </div>
    </div>
  );
}
