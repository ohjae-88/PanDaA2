"use client";

import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";
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
import { useOwnedStore } from "@/lib/arcana/owned-store";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  /** 신규(null) / 수정(charId) */
  charId: string | null;
  onClose: () => void;
};

/** V4.0.9 openCharModal 포팅. */
export function ArcanaCharModal({ open, charId, onClose }: Props) {
  const characters = useArcanaCharStore((s) => s.characters);
  const addChar = useArcanaCharStore((s) => s.addCharacter);
  const renameChar = useArcanaCharStore((s) => s.renameCharacter);
  const removeChar = useArcanaCharStore((s) => s.removeCharacter);
  const setJob = useArcanaCharStore((s) => s.setJob);

  const builds = useArcanaBuildStore((s) => s.builds);
  const createBuild = useArcanaBuildStore((s) => s.createBuild);
  const removeBuild = useArcanaBuildStore((s) => s.removeBuild);
  const setCurrentBuildId = useArcanaBuildStore((s) => s.setCurrentBuildId);
  const removeOwnedByChar = useOwnedStore((s) => s.removeByChar);

  const editing = charId ? characters.find((c) => c.id === charId) ?? null : null;

  const [name, setName] = useState("");
  const [jobId, setJobIdState] = useState("sword");

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setName(editing.name);
      setJobIdState(editing.jobId);
    } else {
      setName("");
      setJobIdState("sword");
    }
  }, [open, editing]);

  function handleSave() {
    const v = name.trim();
    if (!v) {
      toast.error("캐릭터명을 입력하세요.");
      return;
    }
    if (editing) {
      renameChar(editing.id, v);
      setJob(editing.id, jobId);
    } else {
      const c = addChar(v, jobId);
      const b = createBuild(c.id, `${c.name}의 첫 빌드`);
      setCurrentBuildId(b.id);
    }
    onClose();
  }

  async function handleDelete() {
    if (!editing) return;
    const charBuilds = builds.filter((b) => b.charId === editing.id);
    const msg =
      `'${editing.name}' 을(를) 삭제하시겠습니까?\n` +
      `· 소속 빌드 ${charBuilds.length}개\n` +
      `· 보유/계획 카드 (이 캐릭터 묶음)\n` +
      `모두 함께 삭제됩니다.`;
    if (!(await confirmDialog({ title: "캐릭터 삭제", description: msg, confirmText: "삭제", variant: "destructive" }))) return;
    for (const b of charBuilds) removeBuild(b.id);
    removeOwnedByChar(editing.id);
    removeChar(editing.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>{editing ? "✎ 캐릭터 수정" : "＋ 캐릭터 추가"}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">캐릭터명</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              maxLength={20}
              autoFocus
              onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            />
          </div>

          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">직업</Label>
            <Select value={jobId} onValueChange={setJobIdState}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {CLASSES.map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.icon} {c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {editing && (
            <div className="rounded border bg-muted/30 p-2 text-[11px] text-muted-foreground space-y-0.5">
              <div>소속 빌드: <b>{builds.filter((b) => b.charId === editing.id).length}개</b></div>
              <div className={cn("italic", "text-amber-500")}>
                ⚠ 직업 변경 시, 카드 적용 스킬은 직업별로 저장되므로 영향 없음.
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="justify-between">
          {editing ? (
            <Button variant="ghost" onClick={handleDelete} className="text-destructive">
              🗑 삭제
            </Button>
          ) : <span />}
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>취소</Button>
            <Button onClick={handleSave}>{editing ? "저장" : "추가"}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
