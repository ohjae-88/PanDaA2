"use client";

import Link from "next/link";
import { Monitor, Sword, Users, Sparkles, Bell, ArrowRight, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const ITEMS = [
  { href: "/overlay/settings", icon: <Settings className="h-5 w-5" />, title: "오버레이 통합 설정", desc: "불투명도 · 배율 · 텍스트 크기 · 액센트 색상 · 클릭 통과 단축키", color: "border-amber-400/40 bg-amber-400/5" },
  { href: "/overlay/notifier", icon: <Bell className="h-5 w-5" />, title: "알리미 오버레이", desc: "보스/이벤트 잔여 시간을 게임 화면 위에 띄움", color: "border-cat-notifier/40 bg-cat-notifier/5" },
  { href: "/overlay/barrack", icon: <Sword className="h-5 w-5" />, title: "배럭 오버레이", desc: "캐릭터 컨텐츠 진행 현황 (개발 예정)", color: "border-cat-barrack/40 bg-cat-barrack/5", soon: true },
  { href: "/overlay/party", icon: <Users className="h-5 w-5" />, title: "파티 오버레이", desc: "파티 구성 빠른 확인 (개발 예정)", color: "border-cat-party/40 bg-cat-party/5", soon: true },
  { href: "/overlay/arcana", icon: <Sparkles className="h-5 w-5" />, title: "아르카나 오버레이", desc: "아르카나 카드 빌드 참조 (개발 예정)", color: "border-cat-arcana/40 bg-cat-arcana/5", soon: true },
];

export default function OverlayHome() {
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Monitor className="h-5 w-5 text-amber-400" /> 🖥 오버레이
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          게임 화면 위에 떠 있는 반투명 창으로 정보를 상시 확인하고 빠르게 편집할 수 있습니다.
          각 카테고리별 페이지에서 표시 항목과 옵션을 설정하세요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">사용 가이드</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-xs text-muted-foreground">
          <p>• 오버레이는 <b>Tauri 데스크톱 앱 환경</b>에서만 동작합니다. (브라우저에서는 별도 창이 열리지 않음)</p>
          <p>• 각 오버레이 창은 <b>항상 위·테두리 없음·작업표시줄 숨김</b>으로 표시됩니다.</p>
          <p>• 우상단의 핀 / 통과 / 닫기 버튼으로 게임 클릭 통과를 토글하거나 닫을 수 있습니다.</p>
          <p>• 게임을 전체화면(Fullscreen)이 아닌 <b>창모드 / 테두리 없는 창모드</b>로 실행할 때 가장 잘 표시됩니다.</p>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {ITEMS.map((it) => (
          <Link
            key={it.href}
            href={it.href}
            className={cn(
              "block rounded-lg border-2 p-4 hover:bg-accent/5 transition-colors",
              it.color
            )}
          >
            <div className="flex items-center gap-3 mb-2">
              {it.icon}
              <h3 className="font-extrabold text-base">{it.title}</h3>
              {it.soon && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">예정</span>}
              <ArrowRight className="h-4 w-4 ml-auto opacity-50" />
            </div>
            <p className="text-xs text-muted-foreground">{it.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
