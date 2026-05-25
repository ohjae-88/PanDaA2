"use client";

import { Users, Bell, BellOff } from "lucide-react";
import type { NotifierGroup, NotifierItem } from "@/lib/notifier/types";
import { NotifierCard } from "./notifier-card";
import { cn } from "@/lib/utils";

type Props = {
  group: NotifierGroup;
  members: NotifierItem[]; // sorted by soonest spawn
  onEdit: (id: string) => void;
  onTimeInput: (id: string) => void;
  fixedHeight?: boolean;
};

export function NotifierGroupBundle({ group, members, onEdit, onTimeInput, fixedHeight }: Props) {
  return (
    <div
      className={cn(
        "rounded-lg border-2 border-dashed bg-card/40 p-2",
        group.enabled ? "border-cat-notifier/50" : "border-border"
      )}
    >
      <div className="flex items-center gap-2 mb-1.5 px-1">
        <Users className={cn("h-3.5 w-3.5", group.enabled ? "text-cat-notifier" : "text-muted-foreground")} />
        <span className="text-xs font-extrabold truncate">{group.name}</span>
        <span className="text-[10px] text-muted-foreground">({members.length})</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[10px] font-bold">
          {group.enabled ? (
            <span className="text-cat-notifier">
              <Bell className="h-3 w-3 inline" /> 그룹 알림 · {group.beforeMin}분 전
            </span>
          ) : (
            <span className="text-muted-foreground">
              <BellOff className="h-3 w-3 inline" /> 꺼짐
            </span>
          )}
        </span>
      </div>
      <div className="flex flex-col gap-1.5">
        {members.map((it) => (
          <NotifierCard
            key={it.id}
            item={it}
            onEdit={onEdit}
            onTimeInput={onTimeInput}
            fixedHeight={fixedHeight}
          />
        ))}
      </div>
    </div>
  );
}
