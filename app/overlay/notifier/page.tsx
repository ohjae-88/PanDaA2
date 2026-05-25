"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, Bell, Settings } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * 알리미 오버레이 — 별도 설정 페이지였으나 통합 설정 페이지(/overlay/settings)로 흡수됨.
 * 이 라우트는 안내 + 진입 링크만 제공.
 */
export default function NotifierOverlayLanding() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/overlay" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> 오버레이
        </Link>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Bell className="h-5 w-5 text-cat-notifier" /> ⏰ 알리미 오버레이
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">설정 위치 이동됨</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-xs text-muted-foreground">
          <p>
            알리미 오버레이 옵션(표시 항목 수 · 임계 시간 · 표시 모드 등)은 이제{" "}
            <b>오버레이 통합 설정</b> 페이지에 카테고리별로 모여 있습니다.
          </p>
          <Link
            href="/overlay/settings"
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded border border-amber-400/50 bg-amber-400/10 text-amber-400 hover:bg-amber-400/20 transition-colors font-semibold"
          >
            <Settings className="h-3.5 w-3.5" /> 통합 설정으로 이동
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
