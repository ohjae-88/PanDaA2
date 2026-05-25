"use client";

import { useState } from "react";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

export function GroupBar() {
  const groups = usePartyStore((s) => s.groups);
  const activeGroupId = usePartyStore((s) => s.activeGroupId);
  const setActiveGroupId = usePartyStore((s) => s.setActiveGroupId);
  const addGroup = usePartyStore((s) => s.addGroup);
  const renameGroup = usePartyStore((s) => s.renameGroup);
  const removeGroup = usePartyStore((s) => s.removeGroup);

  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  function startEdit(id: string, name: string) {
    setEditId(id);
    setEditName(name);
  }
  function commitEdit() {
    if (editId) renameGroup(editId, editName);
    setEditId(null);
  }
  async function handleDelete(id: string, name: string) {
    if (groups.length <= 1) { toast.warning("마지막 그룹은 삭제할 수 없습니다."); return; }
    if (!(await confirmDialog({ title: "그룹 삭제", description: `그룹 '${name}'을(를) 삭제하시겠습니까?`, confirmText: "삭제", variant: "destructive" }))) return;
    removeGroup(id);
  }

  return (
    <div className="flex items-center gap-1 flex-wrap rounded-lg border bg-card p-2">
      {groups.map((g) => {
        const active = g.id === activeGroupId;
        const isEditing = editId === g.id;
        return (
          <div
            key={g.id}
            className={cn(
              "flex items-center gap-1 rounded-md border px-2 py-1 text-xs transition-colors",
              active ? "bg-cat-party/15 border-cat-party text-cat-party" : "bg-background hover:bg-accent/10"
            )}
          >
            {isEditing ? (
              <input
                autoFocus
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditId(null);
                }}
                className="bg-transparent border-b border-cat-party w-24 outline-none font-bold"
              />
            ) : (
              <button onClick={() => setActiveGroupId(g.id)} className="font-bold">
                {g.name}
              </button>
            )}
            <span className="text-[10px] text-muted-foreground">{g.participants.length}</span>
            <button
              onClick={() => startEdit(g.id, g.name)}
              className="opacity-50 hover:opacity-100"
              title="이름 변경"
            >
              <Pencil className="h-3 w-3" />
            </button>
            <button
              onClick={() => handleDelete(g.id, g.name)}
              className="opacity-50 hover:opacity-100 hover:text-destructive"
              title="삭제"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        );
      })}
      <Button size="xs" variant="ghost" onClick={() => addGroup()}>
        <Plus className="h-3 w-3" /> 그룹 추가
      </Button>
    </div>
  );
}
