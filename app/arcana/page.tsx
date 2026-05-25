"use client";

import { useEffect, useState } from "react";
import { useArcanaCharStore } from "@/lib/arcana/character-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { BuildHeader } from "@/components/arcana/build-header";
import { ArcanaSlots } from "@/components/arcana/arcana-slots";
import { StatsPanel } from "@/components/arcana/stats-panel";
import { SkillListPanel } from "@/components/arcana/skill-list";
import { EquipSkillPanel } from "@/components/arcana/equip-skill-panel";
import { OwnedListPanel } from "@/components/arcana/owned-list";
import { ArcanaRefTable } from "@/components/arcana/arcana-ref-table";

export default function ArcanaBuildPage() {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const characters = useArcanaCharStore((s) => s.characters);
  const builds = useArcanaBuildStore((s) => s.builds);
  const currentBuildId = useArcanaBuildStore((s) => s.currentBuildId);

  const build = builds.find((b) => b.id === currentBuildId) ?? null;
  const character = build ? characters.find((c) => c.id === build.charId) ?? null : null;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">🎴 카드빌드</h1>
        <p className="text-xs text-muted-foreground mt-1">
          아르카나 카드 6슬롯 장착 · 합산 능력치 · 세트 효과 · 스킬 총합 · 보유/계획 카드 관리
        </p>
      </div>

      {!hydrated ? (
        <div className="text-muted-foreground">로딩 중…</div>
      ) : (
        <>
          <BuildHeader />

          {!build ? (
            <div className="rounded-lg border bg-card p-10 text-center text-muted-foreground">
              빌드가 없습니다. 위에서 <b>캐릭터 추가 → 빌드 추가</b> 순서로 시작하세요.
            </div>
          ) : (
            <>
              <ArcanaRefTable build={build} jobId={character?.jobId ?? "guardian"} />
              <ArcanaSlots build={build} jobId={character?.jobId ?? "guardian"} />
              <SkillListPanel build={build} jobId={character?.jobId ?? "guardian"} />
              <StatsPanel build={build} />
              <EquipSkillPanel build={build} jobId={character?.jobId ?? "guardian"} />
              <OwnedListPanel character={character} />
            </>
          )}
        </>
      )}
    </div>
  );
}
