"use client";
import Link from "next/link";
import { ArrowLeft, Users } from "lucide-react";

export default function PartyOverlayPage() {
  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/overlay" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> 오버레이
        </Link>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <Users className="h-5 w-5 text-cat-party" /> 👥 파티 오버레이
        </h1>
      </div>
      <div className="rounded-lg border-2 border-dashed p-10 text-center text-muted-foreground">
        <p className="text-sm font-bold mb-2">개발 예정</p>
        <p className="text-xs">파티 구성 빠른 확인 + 슬롯 조정 기능을 게임 위에서 사용할 예정입니다.</p>
      </div>
    </div>
  );
}
