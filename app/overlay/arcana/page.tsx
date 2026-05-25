"use client";
import Link from "next/link";
import { ArrowLeft, Sparkles } from "lucide-react";

export default function ArcanaOverlayPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/overlay" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> 오버레이
        </Link>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-cat-arcana" /> 🃏 아르카나 오버레이
        </h1>
      </div>
      <div className="rounded-lg border-2 border-dashed p-10 text-center text-muted-foreground">
        <p className="text-sm font-bold mb-2">개발 예정</p>
        <p className="text-xs">아르카나 카드 빌드 참조 / 스킬 도움말을 게임 위에서 확인할 예정입니다.</p>
      </div>
    </div>
  );
}
