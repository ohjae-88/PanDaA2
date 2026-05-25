"use client";

import { useEffect, useState } from "react";
import { SkillDbEditor } from "@/components/arcana/skill-db-editor";

export default function SkillDbPage() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">📘 스킬 DB</h1>
        <p className="text-xs text-muted-foreground mt-1">
          직업별 스킬 마스터 — Inven 스킬 시뮬레이터에서 자동 가져오기 · 데바니온 / 특화 효과 편집
        </p>
      </div>
      {!hydrated ? <div className="text-muted-foreground">로딩 중…</div> : <SkillDbEditor />}
    </div>
  );
}
