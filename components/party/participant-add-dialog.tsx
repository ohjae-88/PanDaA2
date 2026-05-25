"use client";

import { useEffect, useMemo, useState } from "react";
import { Users, Check } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  open: boolean;
  gid: string | null;
  onClose: () => void;
};

export function ParticipantAddDialog({ open, gid, onClose }: Props) {
  const players = usePartyStore((s) => s.players);
  const groups = usePartyStore((s) => s.groups);
  const addParticipants = usePartyStore((s) => s.addParticipants);

  const group = groups.find((g) => g.id === gid);
  const existing = useMemo(() => new Set(group?.participants.map((p) => p.playerId) ?? []), [group]);

  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");

  useEffect(() => {
    if (open) { setPicked(new Set()); setQuery(""); }
  }, [open]);

  const filtered = players.filter((p) => !existing.has(p.id) && (!query || p.name.toLowerCase().includes(query.toLowerCase())));

  function toggle(pid: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }
  function handleSave() {
    if (!gid) return;
    addParticipants(gid, Array.from(picked));
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" /> 참가자 추가
          </DialogTitle>
        </DialogHeader>
        <Input placeholder="플레이어 검색…" value={query} onChange={(e) => setQuery(e.target.value)} />
        <div className="max-h-72 overflow-y-auto rounded border bg-card/40">
          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">추가 가능한 플레이어 없음</div>
          ) : (
            filtered.map((p) => {
              const sel = picked.has(p.id);
              return (
                <button
                  key={p.id}
                  onClick={() => toggle(p.id)}
                  className={cn(
                    "w-full flex items-center gap-2 px-3 py-2 text-left text-sm border-b last:border-b-0 hover:bg-accent/10",
                    sel && "bg-cat-party/10"
                  )}
                >
                  <div className={cn(
                    "w-4 h-4 rounded border flex items-center justify-center",
                    sel ? "bg-cat-party border-cat-party text-white" : "bg-background"
                  )}>
                    {sel && <Check className="h-3 w-3" />}
                  </div>
                  <span className="font-bold flex-1">{p.name}</span>
                  <span className="text-[10px] text-muted-foreground">{p.characters.length}캐릭터</span>
                </button>
              );
            })
          )}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>취소</Button>
          <Button onClick={handleSave} disabled={!picked.size}>{picked.size}명 추가</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
