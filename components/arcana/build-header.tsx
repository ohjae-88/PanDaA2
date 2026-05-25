"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CLASSES } from "@/lib/barrack/constants";
import { useArcanaCharStore } from "@/lib/arcana/character-store";
import { useArcanaBuildStore } from "@/lib/arcana/build-store";
import { confirmDialog } from "@/lib/util/confirm";
import { ArcanaCharModal } from "./char-modal";

/** V4.0.9 renderBuildHeader 포팅 — 캐릭터 셀렉트 + 빌드 셀렉트 + 액션 */
export function BuildHeader() {
  const characters = useArcanaCharStore((s) => s.characters);

  const builds = useArcanaBuildStore((s) => s.builds);
  const currentBuildId = useArcanaBuildStore((s) => s.currentBuildId);
  const setCurrentBuildId = useArcanaBuildStore((s) => s.setCurrentBuildId);
  const createBuild = useArcanaBuildStore((s) => s.createBuild);
  const duplicateBuild = useArcanaBuildStore((s) => s.duplicateBuild);
  const renameBuild = useArcanaBuildStore((s) => s.renameBuild);
  const removeBuild = useArcanaBuildStore((s) => s.removeBuild);

  const cur = builds.find((b) => b.id === currentBuildId) ?? null;
  const curChar = cur ? characters.find((c) => c.id === cur.charId) ?? null : null;
  const charBuilds = curChar ? builds.filter((b) => b.charId === curChar.id) : [];

  const [charModalOpen, setCharModalOpen] = useState(false);
  const [charModalEditId, setCharModalEditId] = useState<string | null>(null);

  function handleAddChar() {
    setCharModalEditId(null);
    setCharModalOpen(true);
  }
  function handleRenameChar() {
    if (!curChar) return;
    setCharModalEditId(curChar.id);
    setCharModalOpen(true);
  }
  function handleRemoveChar() {
    if (!curChar) return;
    // 삭제는 char modal 안에서 처리 — 진입만 시킴
    setCharModalEditId(curChar.id);
    setCharModalOpen(true);
  }
  function handleAddBuild() {
    if (!curChar) return;
    const name = prompt("새 빌드 이름", "새 빌드");
    if (!name?.trim()) return;
    createBuild(curChar.id, name.trim());
  }
  function handleRenameBuild() {
    if (!cur) return;
    const name = prompt("빌드 이름 변경", cur.name);
    if (name?.trim()) renameBuild(cur.id, name.trim());
  }
  async function handleRemoveBuild() {
    if (!cur) return;
    if (!(await confirmDialog({
      title: "빌드 삭제",
      description: `'${cur.name}' 빌드를 삭제하시겠습니까?`,
      confirmText: "삭제",
      variant: "destructive",
    }))) return;
    removeBuild(cur.id);
  }
  function handleDuplicate() {
    if (!cur) return;
    duplicateBuild(cur.id);
  }

  return (
    <div className="rounded-lg border bg-card/40 p-2.5">
      <div className="flex items-center gap-1.5 flex-wrap">
        {/* 캐릭터 */}
        <span className="text-xs font-bold text-muted-foreground">캐릭터</span>
        {characters.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">없음</span>
        ) : (
          <Select
            value={curChar?.id ?? "_none"}
            onValueChange={(v) => {
              const c = characters.find((x) => x.id === v);
              if (!c) return;
              const cb = builds.filter((b) => b.charId === c.id);
              setCurrentBuildId(cb[0]?.id ?? null);
            }}
          >
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {characters.map((c) => {
                const cls = CLASSES.find((x) => x.id === c.jobId);
                return (
                  <SelectItem key={c.id} value={c.id}>
                    {cls?.icon ?? "❓"} {c.name} ({cls?.name ?? c.jobId})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        )}
        <Button size="xs" variant="ghost" onClick={handleAddChar} title="캐릭터 추가" className="border border-border">
          <Plus className="h-3 w-3" /> 캐릭터
        </Button>
        {curChar && (
          <>
            <Button size="xs" variant="ghost" onClick={handleRenameChar} title="캐릭터 수정" className="border border-border">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="xs" variant="ghost" onClick={handleRemoveChar} className="text-destructive border border-border" title="삭제">
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}

        <span className="mx-1 text-muted-foreground/40">|</span>

        {/* 빌드 */}
        <span className="text-xs font-bold text-muted-foreground">빌드</span>
        {!curChar ? (
          <span className="text-xs text-muted-foreground italic">캐릭터 먼저</span>
        ) : charBuilds.length === 0 ? (
          <span className="text-xs text-muted-foreground italic">없음</span>
        ) : (
          <Select value={cur?.id ?? "_none"} onValueChange={(v) => setCurrentBuildId(v)}>
            <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              {charBuilds.map((b) => <SelectItem key={b.id} value={b.id}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )}
        {curChar && (
          <Button size="xs" variant="ghost" onClick={handleAddBuild} title="빌드 추가" className="border border-border">
            <Plus className="h-3 w-3" /> 빌드
          </Button>
        )}
        {cur && (
          <>
            <Button size="xs" variant="ghost" onClick={handleDuplicate} title="빌드 복제" className="border border-border">
              <Copy className="h-3 w-3" /> 복제
            </Button>
            <Button size="xs" variant="ghost" onClick={handleRenameBuild} title="빌드 이름 변경" className="border border-border">
              <Pencil className="h-3 w-3" />
            </Button>
            <Button size="xs" variant="ghost" onClick={handleRemoveBuild} className="text-destructive border border-border" title="빌드 삭제">
              <Trash2 className="h-3 w-3" />
            </Button>
          </>
        )}

      </div>

      <ArcanaCharModal
        open={charModalOpen}
        charId={charModalEditId}
        onClose={() => setCharModalOpen(false)}
      />
    </div>
  );
}
