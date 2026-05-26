"use client";

import { useEffect, useMemo, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { usePartyStore, newCharId } from "@/lib/party/store";
import { PARTY_JOBS } from "@/lib/party/constants";
import type { PartyCharacter } from "@/lib/party/types";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";
import { fetchCharacterFullInfo } from "@/lib/barrack/equip-api";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

type Props = { open: boolean; pid: string | null; cid: string | null; onClose: () => void };

const EMPTY: PartyCharacter = {
  id: "", name: "", job: "수호성", type: "main",
  cp: 0, itemLevel: 0, characterId: "", serverId: undefined,
};

export function CharDialog({ open, pid, cid, onClose }: Props) {
  const players = usePartyStore((s) => s.players);
  const servers = usePartyStore((s) => s.servers);
  const defaultServerId = usePartyStore((s) => s.defaultServerId);
  const upsert = usePartyStore((s) => s.upsertCharacter);
  const remove = usePartyStore((s) => s.removeCharacter);

  const player = pid ? players.find((p) => p.id === pid) : null;
  const editing = player && cid ? player.characters.find((c) => c.id === cid) : null;

  const [draft, setDraft] = useState<PartyCharacter>(EMPTY);
  const [race, setRace] = useState<"천족" | "마족">("천족");
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFetchMsg(null);
    setGuideOpen(false);
    if (editing) {
      setDraft({ ...editing });
      const sv = servers.find((s) => s.serverId === editing.serverId);
      setRace(sv?.race === "마족" ? "마족" : "천족");
    } else {
      setDraft({ ...EMPTY, id: newCharId(), serverId: defaultServerId ?? undefined });
      const def = servers.find((s) => s.serverId === defaultServerId);
      setRace(def?.race === "마족" ? "마족" : "천족");
    }
  }, [open, editing, servers, defaultServerId]);

  const filteredServers = useMemo(
    () => servers.filter((s) => s.race === race),
    [servers, race]
  );

  function patch<K extends keyof PartyCharacter>(k: K, v: PartyCharacter[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  function handleSave() {
    if (!pid) return;
    if (!draft.name.trim()) { toast.error("캐릭터명을 입력하세요."); return; }
    upsert(pid, { ...draft, name: draft.name.trim() });
    onClose();
  }

  async function handleDelete() {
    if (!pid || !editing) return;
    if (!(await confirmDialog({ title: "캐릭터 삭제", description: `'${editing.name}' 캐릭터를 삭제하시겠습니까?`, confirmText: "삭제", variant: "destructive" }))) return;
    remove(pid, editing.id);
    onClose();
  }

  if (!player) return null;

  const characterId = draft.characterId ?? "";

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {editing ? "✎ 캐릭터 수정" : "＋ 캐릭터 추가"} — {player.name}
          </DialogTitle>
        </DialogHeader>

        {/* ── 캐릭터 정보 ── */}
        <div className="rounded border bg-card/40 p-3 space-y-2">
          <div className="text-xs font-extrabold text-muted-foreground">캐릭터 정보</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">종족</Label>
              <Select value={race} onValueChange={(v) => setRace(v as "천족" | "마족")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="천족">천족</SelectItem>
                  <SelectItem value="마족">마족</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">구분</Label>
              <Select value={draft.type} onValueChange={(v) => patch("type", v as "main" | "sub")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="main">본케</SelectItem>
                  <SelectItem value="sub">부케</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">서버</Label>
              <Select
                value={draft.serverId ? String(draft.serverId) : "_none"}
                onValueChange={(v) => patch("serverId", v === "_none" ? undefined : Number(v))}
              >
                <SelectTrigger><SelectValue placeholder="서버 선택" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">미지정</SelectItem>
                  {filteredServers.map((s) => (
                    <SelectItem key={s.serverId} value={String(s.serverId)}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">캐릭터 ID (장비·스킬 조회용)</Label>
            <div className="flex items-center gap-1.5">
              <Input
                value={characterId}
                onChange={(e) => {
                  const raw = e.target.value;
                  const m = raw.match(/characters\/(\d+)\/([^/?#\s]+)/i);
                  if (m) {
                    const srvFromUrl = servers.find((s) => String(s.serverId) === m[1]);
                    if (srvFromUrl) {
                      setDraft((d) => ({ ...d, serverId: srvFromUrl.serverId, characterId: decodeURIComponent(m[2]) }));
                      setRace(srvFromUrl.race === "마족" ? "마족" : "천족");
                      setFetchMsg(`✓ URL에서 추출 — 서버 ${srvFromUrl.name}(${srvFromUrl.race})`);
                      return;
                    }
                    patch("characterId", decodeURIComponent(m[2]));
                    return;
                  }
                  patch("characterId", raw);
                }}
                placeholder="ID 또는 aion2.plaync.com 캐릭터 URL 붙여넣기"
                className="flex-1"
              />
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={fetching || !characterId.trim()}
                onClick={async () => {
                  const cid = characterId.trim();
                  if (!cid) return;
                  const srvId = draft.serverId;
                  if (!srvId) { setFetchMsg("서버를 먼저 선택하세요."); return; }
                  setFetching(true);
                  setFetchMsg(null);
                  try {
                    const info = await fetchCharacterFullInfo(cid, srvId);
                    const patches: Partial<PartyCharacter> = {};
                    if (info.name) patches.name = info.name;
                    if (info.cp !== undefined) patches.cp = info.cp;
                    if (info.itemLevel !== undefined) patches.itemLevel = info.itemLevel;
                    if (info.className) {
                      const j = PARTY_JOBS.find((j) => j.id === info.className);
                      if (j) patches.job = j.id;
                    }
                    let nextRace = race;
                    if (info.raceName === "천족" || info.raceName === "마족") {
                      nextRace = info.raceName;
                      setRace(nextRace);
                    }
                    if (info.serverName) {
                      const srv = servers.find((s) => s.name === info.serverName);
                      if (srv) {
                        patches.serverId = srv.serverId;
                        setRace(srv.race === "마족" ? "마족" : "천족");
                      }
                    }
                    setDraft((d) => ({ ...d, ...patches }));
                    const parts: string[] = [];
                    if (info.name) parts.push(info.name);
                    if (info.className) parts.push(info.className);
                    setFetchMsg(`✓ 갱신됨 (${parts.join(" · ") || "정보 적용"})`);
                  } catch (e) {
                    setFetchMsg(`✗ 실패: ${(e as Error).message}`);
                  } finally {
                    setFetching(false);
                  }
                }}
                className="border border-border"
                title="aion2.plaync.com에서 캐릭터 정보(이름·종족·직업·서버·전투력·아이템레벨) 가져오기"
              >
                {fetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                불러오기
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  if (!characterId.trim()) {
                    try { window.open("https://aion2.plaync.com/ko-kr/characters/index", "_blank", "noopener,noreferrer"); } catch { /* ignore */ }
                    return;
                  }
                  try { window.open(`https://aion2.plaync.com/ko-kr/characters/${draft.serverId}/${characterId}`, "_blank", "noopener,noreferrer"); } catch { /* ignore */ }
                }}
                className="border border-border"
                title="캐릭터 ID 입력 시: 프로필 페이지 / 미입력 시: 캐릭터 검색 페이지 열기"
              >
                <ExternalLink className="h-3.5 w-3.5" /> 링크
              </Button>
            </div>
            {/* 캐릭터 ID 가이드 — 접기/펴기 */}
            <div className="rounded border border-cat-barrack/30 bg-cat-barrack/5 p-2.5 text-[11px] leading-relaxed space-y-1">
              <button
                type="button"
                onClick={() => setGuideOpen((v) => !v)}
                className="w-full flex items-center justify-between gap-2 text-left hover:opacity-80 transition-opacity"
                aria-expanded={guideOpen}
              >
                <span className="text-base font-extrabold text-cat-barrack">📘 캐릭터 ID 어떻게 얻나요?</span>
                <span className="text-sm font-bold text-gold-light tabular-nums">
                  {guideOpen ? "[▲내용닫기▲]" : "[▼내용보기▼]"}
                </span>
              </button>
              {guideOpen && (
                <>
                  <ol className="list-decimal pl-4 space-y-0.5 text-foreground/90">
                    <li>
                      오른쪽{" "}
                      <a
                        href="https://aion2.plaync.com/ko-kr/characters/index"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-bold text-cat-barrack underline underline-offset-2 hover:text-gold-light"
                      >
                        [링크]
                      </a>{" "}
                      버튼을 눌러요. → 아이온2 홈페이지가 열려요.
                    </li>
                    <li>홈페이지에서 <b>내 캐릭터 이름</b>을 검색해요.</li>
                    <li>찾은 캐릭터를 <b>클릭</b>해요. → 인터넷 주소창에 길고 복잡한 글자가 나와요.<br />
                      <span className="text-muted-foreground">
                        예: <code className="text-[10px] bg-muted/60 px-1 rounded">https://aion2.plaync.com/ko-kr/characters/1010/wuoZ......ngMk=</code>
                      </span>
                    </li>
                    <li>
                      인터넷 주소창의 <b className="text-gold-light">주소 전체</b>를 <b>복사</b>해요.<br />
                      <span className="text-muted-foreground">
                        (<code className="text-[10px] bg-muted/60 px-1 rounded">https://</code> 부터 끝까지 전부 — 마우스로 주소를 한 번 누르고 <b>Ctrl+A</b> → <b>Ctrl+C</b>)
                      </span>
                    </li>
                    <li>위쪽 <b>[캐릭터 ID]</b> 칸을 클릭한 다음 <b>Ctrl+V</b>로 <b>붙여넣어요</b>. → 캐릭터 ID만 자동으로 골라져요!</li>
                    <li>마지막으로 <b>[불러오기]</b> 버튼을 누르면 끝! 🎉</li>
                  </ol>
                  <div className="text-[10px] text-muted-foreground italic pt-1 border-t border-cat-barrack/20 mt-1">
                    💡 복잡한 부분은 신경 쓰지 않아도 돼요. 주소 전체만 그대로 붙여넣으면 자동으로 처리돼요.
                  </div>
                </>
              )}
            </div>
            {fetchMsg && (
              <p className={cn("text-[10px] italic", fetchMsg.startsWith("✓") ? "text-emerald-500" : "text-rose-400")}>
                {fetchMsg}
              </p>
            )}
          </div>
        </div>

        {/* ── 기본 정보 ── */}
        <div className="rounded border bg-card/40 p-3 space-y-2">
          <div className="text-xs font-extrabold text-muted-foreground">기본 정보</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">캐릭터명</Label>
              <Input value={draft.name} onChange={(e) => patch("name", e.target.value)} autoFocus maxLength={20} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">직업</Label>
              <Select value={draft.job} onValueChange={(v) => patch("job", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PARTY_JOBS.map((j) => (
                    <SelectItem key={j.id} value={j.id}>{j.icon} {j.id}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">전투력</Label>
              <Input
                type="number"
                min={0}
                value={draft.cp ?? 0}
                onChange={(e) => patch("cp", Number(e.target.value) || 0)}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">아이템 레벨</Label>
              <Input
                type="number"
                min={0}
                value={draft.itemLevel ?? 0}
                onChange={(e) => patch("itemLevel", Number(e.target.value) || 0)}
              />
            </div>
          </div>
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
