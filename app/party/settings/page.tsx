"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Server as ServerIcon, Plus, Trash2, RotateCcw } from "lucide-react";
import { usePartyStore } from "@/lib/party/store";
import { DEFAULT_PARTY_SERVERS } from "@/lib/party/constants";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { PartyServer } from "@/lib/party/types";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

export default function PartySettingsPage() {
  const servers = usePartyStore((s) => s.servers);
  const defaultServerId = usePartyStore((s) => s.defaultServerId);
  const setServers = usePartyStore((s) => s.setServers);
  const setDefaultServerId = usePartyStore((s) => s.setDefaultServerId);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [newName, setNewName] = useState("");
  const [newId, setNewId] = useState("");
  const [newRace, setNewRace] = useState<"천족" | "마족">("천족");

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  function addServer() {
    const sid = Number(newId);
    if (!newName.trim() || !sid) { toast.error("서버명과 ID를 입력하세요."); return; }
    if (servers.some((s) => s.serverId === sid)) { toast.error("이미 존재하는 서버 ID입니다."); return; }
    setServers([...servers, { name: newName.trim(), serverId: sid, race: newRace }]);
    setNewName(""); setNewId("");
  }
  async function removeServer(sid: number) {
    if (!(await confirmDialog({ title: "서버 삭제", description: "서버를 삭제하시겠습니까?", confirmText: "삭제", variant: "destructive" }))) return;
    setServers(servers.filter((s) => s.serverId !== sid));
    if (defaultServerId === sid) setDefaultServerId(null);
  }
  async function resetDefaults() {
    if (!(await confirmDialog({ title: "기본 서버 목록 복원", description: "기본 서버 목록으로 되돌리시겠습니까?", confirmText: "복원" }))) return;
    setServers(DEFAULT_PARTY_SERVERS);
  }

  const grouped = {
    천족: servers.filter((s) => s.race === "천족"),
    마족: servers.filter((s) => s.race === "마족"),
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Link href="/party" className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5" /> 파티 편집
        </Link>
        <h1 className="text-2xl font-extrabold flex items-center gap-2">
          <ServerIcon className="h-5 w-5" /> 🛠 파티 설정
        </h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>기본 서버</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <p className="text-xs text-muted-foreground">
            기본 서버의 캐릭터는 이름 뒤에 서버 약자를 표시하지 않습니다.
          </p>
          <div className="flex items-center gap-2">
            <Label className="text-xs w-24">기본 서버</Label>
            <select
              value={defaultServerId ?? ""}
              onChange={(e) => setDefaultServerId(e.target.value ? Number(e.target.value) : null)}
              className="px-3 py-1.5 text-sm rounded border bg-background"
            >
              <option value="">(선택 없음)</option>
              {servers.map((s) => (
                <option key={s.serverId} value={s.serverId}>{s.race} · {s.name} (#{s.serverId})</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle>서버 마스터</CardTitle>
          <Button size="sm" variant="ghost" onClick={resetDefaults}>
            <RotateCcw className="h-4 w-4" /> 기본값 복원
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-end gap-2 flex-wrap p-2 rounded border bg-muted/20">
            <div>
              <Label className="text-xs mb-1 block">종족</Label>
              <div className="inline-flex rounded border overflow-hidden">
                {(["천족", "마족"] as const).map((r) => (
                  <button
                    key={r}
                    onClick={() => setNewRace(r)}
                    className={cn(
                      "px-3 py-1.5 text-xs font-bold",
                      newRace === r ? "bg-cat-party/15 text-cat-party" : "text-muted-foreground"
                    )}
                  >{r}</button>
                ))}
              </div>
            </div>
            <div>
              <Label className="text-xs mb-1 block">서버명</Label>
              <Input className="w-32" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="예: 멜렌" />
            </div>
            <div>
              <Label className="text-xs mb-1 block">서버 ID</Label>
              <Input className="w-24" type="number" value={newId} onChange={(e) => setNewId(e.target.value)} placeholder="1010" />
            </div>
            <Button size="sm" onClick={addServer}>
              <Plus className="h-4 w-4" /> 추가
            </Button>
          </div>

          {(["천족", "마족"] as const).map((race) => (
            <ServerListSection
              key={race}
              race={race}
              servers={grouped[race]}
              defaultServerId={defaultServerId}
              onRemove={removeServer}
            />
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function ServerListSection({ race, servers, defaultServerId, onRemove }: {
  race: string;
  servers: PartyServer[];
  defaultServerId: number | null;
  onRemove: (sid: number) => void;
}) {
  return (
    <div>
      <div className="text-xs font-bold mb-1.5 text-muted-foreground">{race} · {servers.length}개</div>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-1.5">
        {servers.map((s) => (
          <div
            key={s.serverId}
            className={cn(
              "flex items-center gap-1.5 rounded border px-2 py-1.5 text-xs",
              defaultServerId === s.serverId && "border-cat-party bg-cat-party/10"
            )}
          >
            <span className="font-bold flex-1 truncate">{s.name}</span>
            <span className="text-[10px] text-muted-foreground tabular-nums">#{s.serverId}</span>
            <button
              onClick={() => onRemove(s.serverId)}
              className="opacity-50 hover:opacity-100 hover:text-destructive"
              title="삭제"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
