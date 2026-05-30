"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ChevronDown, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ThemeToggle } from "@/components/theme-toggle";
import { UnifiedButton } from "@/components/unified/unified-button";
import { OverlayToggleButton } from "@/components/overlay/overlay-toggle-button";
import { MainScaleControl } from "@/components/main-scale-control";
import { cn } from "@/lib/utils";
import { useUpdateStore } from "@/lib/util/update-store";

type NavCategory = {
  key: string;
  label: string;
  icon: string;
  defaultHref: string;
  colorClass: string; // tailwind class for the active tint
  items: { label: string; href: string }[];
};

const CATEGORIES: NavCategory[] = [
  {
    key: "barrack",
    label: "배럭관리",
    icon: "📊",
    defaultHref: "/dashboard",
    colorClass: "text-[hsl(var(--cat-barrack))]",
    items: [
      { label: "📊 대시보드", href: "/dashboard" },
      { label: "⚡ 심플",     href: "/simple" },
      { label: "👤 캐릭터",   href: "/characters" },
      { label: "📋 기록",     href: "/history" },
      { label: "⚙ DB설정",   href: "/db" },
    ],
  },
  {
    key: "party",
    label: "파티구성",
    icon: "👥",
    defaultHref: "/party",
    colorClass: "text-[hsl(var(--cat-party))]",
    items: [
      { label: "🧩 파티편집", href: "/party" },
      { label: "🗂 캐릭터DB", href: "/party/db" },
    ],
  },
  {
    key: "arcana",
    label: "아르카나",
    icon: "🃏",
    defaultHref: "/arcana",
    colorClass: "text-[hsl(var(--cat-arcana))]",
    items: [
      { label: "🎴 카드빌드",    href: "/arcana" },
      { label: "🗂 아르카나DB", href: "/arcana/db-card" },
      { label: "📘 스킬DB",      href: "/arcana/db-skill" },
    ],
  },
  {
    key: "notifier",
    label: "알리미",
    icon: "⏰",
    defaultHref: "/notifier",
    colorClass: "text-[hsl(var(--cat-notifier))]",
    items: [
      { label: "⏰ 알리미",       href: "/notifier" },
      { label: "🗂 알리미DB",     href: "/notifier/db" },
      { label: "⚙ 알리미 설정",   href: "/notifier/settings" },
    ],
  },
];

export function SiteHeader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { check, checking, info, openDialog } = useUpdateStore();

  // 오버레이 윈도우 경로에서는 헤더 숨김
  if (pathname?.startsWith("/overlay/window/")) return null;
  // 신규 장비 윈도우 — 헤더 숨김
  if (pathname?.startsWith("/overlay/equip")) return null;
  // 오버레이 확장 모드 iframe 임베드 시에도 헤더 숨김 (?embedded=1)
  if (searchParams?.get("embedded") === "1") return null;

  function isActiveCat(cat: NavCategory) {
    return cat.items.some(i => pathname === i.href || pathname.startsWith(i.href + "/"));
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-14 flex-nowrap items-center gap-3 px-4">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2 font-bold whitespace-nowrap">
          <span className="text-xl">🐼</span>
          <span className="hidden lg:inline">판다의 A2</span>
        </Link>
        <button
          type="button"
          onClick={() => info?.available ? openDialog() : check(false)}
          disabled={checking}
          title={
            info?.available
              ? `새 버전 v${info.newVersion} 클릭하여 설치`
              : "업데이트 확인"
          }
          className={cn(
            "relative flex shrink-0 items-center gap-1 rounded px-1.5 py-0.5 text-xs font-normal transition-colors whitespace-nowrap",
            "hover:bg-accent/20 disabled:opacity-60",
            info?.available
              ? "text-emerald-500 dark:text-emerald-400"
              : "text-muted-foreground"
          )}
        >
          <RefreshCw
            className={cn("h-3 w-3", checking && "animate-spin")}
          />
          <span className="hidden md:inline">Ver.{process.env.NEXT_PUBLIC_APP_VERSION}</span>
          {info?.available && (
            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-emerald-500 ring-1 ring-background" />
          )}
        </button>

        <div className="mx-2 h-6 w-px bg-border" />

        <nav className="flex shrink-0 items-center gap-2">
          {CATEGORIES.map(cat => {
            const active = isActiveCat(cat);
            return (
              <div
                key={cat.key}
                className={cn(
                  "flex shrink-0 rounded-md border overflow-hidden transition-colors",
                  active
                    ? `border-current ${cat.colorClass} bg-current/10`
                    : "border-border text-muted-foreground hover:text-foreground"
                )}
              >
                <Link
                  href={cat.defaultHref}
                  className={cn(
                    "px-3 py-1.5 text-sm font-semibold hover:bg-accent/10 transition-colors whitespace-nowrap",
                    active && cat.colorClass
                  )}
                >
                  {cat.icon}<span className="hidden lg:inline">&nbsp;{cat.label}</span>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger
                    className={cn(
                      "px-2 border-l border-current/30 hover:bg-accent/10 transition-colors",
                      active && cat.colorClass
                    )}
                    aria-label={`${cat.label} 메뉴`}
                  >
                    <ChevronDown className="h-3 w-3" />
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    {cat.items.map(item => (
                      <DropdownMenuItem key={item.href} asChild>
                        <Link
                          href={item.href}
                          className={cn(
                            pathname === item.href && "bg-accent/20 text-accent-foreground font-semibold"
                          )}
                        >
                          {item.label}
                        </Link>
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <OverlayToggleButton settingsHref="/overlay/settings" settingsActive={!!pathname?.startsWith("/overlay/settings")} />
          <MainScaleControl />
          <UnifiedButton />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
