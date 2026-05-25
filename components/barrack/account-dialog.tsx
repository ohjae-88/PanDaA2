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
import { Checkbox } from "@/components/ui/checkbox";
import { useBarrackStore } from "@/lib/barrack/store";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";
import { uid } from "@/lib/barrack/time";

type Props = { open: boolean; accId: string | null; onClose: () => void };

export function AccountDialog({ open, accId, onClose }: Props) {
  const accounts = useBarrackStore((s) => s.accounts);
  const upsert = useBarrackStore((s) => s.upsertAccount);
  const remove = useBarrackStore((s) => s.removeAccount);

  const editing = accId ? accounts.find((a) => a.id === accId) : null;
  const [name, setName] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  useEffect(() => {
    if (!open) return;
    setName(editing?.name ?? "");
    setSubscribed(!!editing?.subscribed);
  }, [open, editing]);

  function handleSave() {
    const n = name.trim();
    if (!n) { toast.error("계정명을 입력하세요."); return; }
    if (editing) {
      upsert({ ...editing, name: n, subscribed });
    } else {
      upsert({ id: uid("a"), name: n, subscribed, servers: {} });
    }
    onClose();
  }

  async function handleDelete() {
    if (!editing) return;
    if (!(await confirmDialog({ title: "계정 삭제", description: `'${editing.name}'과 소속 캐릭터를 모두 삭제합니다.`, confirmText: "삭제", variant: "destructive" }))) return;
    remove(editing.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{editing ? "✎ 계정 수정" : "＋ 계정 추가"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label className="text-xs text-muted-foreground">계정명</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="본계정, 부계정 등" />
          </div>
          <label className="flex items-center gap-2 cursor-pointer text-sm">
            <Checkbox checked={subscribed} onCheckedChange={(v) => setSubscribed(!!v)} />
            <span>구독 (✦ 오드 부스트 등)</span>
          </label>
        </div>
        <DialogFooter className="justify-between">
          {editing ? (
            <Button variant="ghost" onClick={handleDelete} className="text-destructive">🗑 삭제</Button>
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
