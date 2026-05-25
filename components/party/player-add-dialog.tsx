"use client";

import { useEffect, useState } from "react";
import {
  Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { usePartyStore } from "@/lib/party/store";
import { toast } from "@/lib/util/toast";

type Props = { open: boolean; onClose: () => void };

export function PlayerAddDialog({ open, onClose }: Props) {
  const addPlayer = usePartyStore((s) => s.addPlayer);
  const [name, setName] = useState("");
  useEffect(() => { if (open) setName(""); }, [open]);

  function handleSave() {
    const n = name.trim();
    if (!n) { toast.error("플레이어 이름을 입력하세요."); return; }
    addPlayer(n);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>＋ 플레이어 추가</DialogTitle>
        </DialogHeader>
        <div className="space-y-1">
          <Label className="text-xs text-muted-foreground">이름</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleSave(); }}
            autoFocus
            placeholder="플레이어 이름"
          />
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSave}>추가</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
