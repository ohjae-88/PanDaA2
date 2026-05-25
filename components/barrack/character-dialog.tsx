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
import { useBarrackStore, newBlankCharacter } from "@/lib/barrack/store";
import { CLASSES, CONTENTS } from "@/lib/barrack/constants";
import { Checkbox } from "@/components/ui/checkbox";
import { fetchCharacterFullInfo } from "@/lib/barrack/equip-api";
import { charProfileUrl, getServerId } from "@/lib/barrack/profile-url";
import { Download, ExternalLink, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Character, Race } from "@/lib/barrack/types";

// 캐릭터 카드에 표시되는 콘텐츠 — V4.0.9의 hiddenContents 키
const CARD_CONTENTS = CONTENTS.filter(
  (c) => c.id !== "mission" // 사명은 서버 단위, 캐릭터 카드 미표시
);

type Props = { open: boolean; charId: string | null; onClose: () => void };

export function CharacterDialog({ open, charId, onClose }: Props) {
  const characters = useBarrackStore((s) => s.characters);
  const accounts = useBarrackStore((s) => s.accounts);
  const db = useBarrackStore((s) => s.dbSettings);
  const upsert = useBarrackStore((s) => s.upsertCharacter);
  const remove = useBarrackStore((s) => s.removeCharacter);

  const editing = charId ? characters.find((c) => c.id === charId) : null;
  const [draft, setDraft] = useState<Character | null>(null);
  const [fetching, setFetching] = useState(false);
  const [fetchMsg, setFetchMsg] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      setDraft({ ...editing });
    } else {
      const accId = accounts[0]?.id ?? "";
      const defServer =
        characters.find((c) => c.accountId === accId)?.server ??
        db.serverList[0]?.name ??
        "";
      setDraft(newBlankCharacter(accId, defServer, db));
    }
  }, [open, editing, accounts, characters, db]);

  if (!draft) return null;

  function patch<K extends keyof Character>(k: K, v: Character[K]) {
    setDraft((d) => (d ? { ...d, [k]: v } : d));
  }

  const d = draft;
  const serversForRace = db.serverList.filter((s) => s.race === d.race);

  function handleSave() {
    if (!d) return;
    if (!d.name.trim()) { toast.error("캐릭터명을 입력하세요."); return; }
    if (!d.accountId) { toast.error("계정을 선택하세요."); return; }
    upsert({ ...d, name: d.name.trim() });
    onClose();
  }
  async function handleDelete() {
    if (!editing) return;
    if (!(await confirmDialog({ title: "캐릭터 삭제", description: `'${editing.name}'을(를) 삭제하시겠습니까?`, confirmText: "삭제", variant: "destructive" }))) return;
    remove(editing.id);
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "✎ 캐릭터 수정" : "＋ 캐릭터 추가"}</DialogTitle>
        </DialogHeader>
        {/* ── 캐릭터 정보 ── */}
        <div className="rounded border bg-card/40 p-3 space-y-2">
          <div className="text-xs font-extrabold text-muted-foreground">캐릭터 정보</div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">계정</Label>
              <Select value={d.accountId} onValueChange={(v) => patch("accountId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">종족</Label>
              <Select value={d.race} onValueChange={(v) => patch("race", v as Race)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="천족">천족</SelectItem>
                  <SelectItem value="마족">마족</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">서버명</Label>
              <Select value={d.server} onValueChange={(v) => patch("server", v)}>
                <SelectTrigger><SelectValue placeholder="서버 선택" /></SelectTrigger>
                <SelectContent>
                  {serversForRace.map((s) => (
                    <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="col-span-2 space-y-1">
            <Label className="text-xs text-muted-foreground">캐릭터 ID (장비·스킬 조회용)</Label>
            <div className="flex items-center gap-1.5">
              <Input
                value={d.characterId ?? d.cid ?? ""}
                onChange={(e) => {
                  const raw = e.target.value;
                  // V4.0.9 동등 — URL 붙여넣기 감지: /characters/{serverId}/{characterId}
                  const m = raw.match(/characters\/(\d+)\/([^/?#\s]+)/i);
                  if (m) {
                    const srvIdFromUrl = m[1];
                    const cidFromUrl = decodeURIComponent(m[2]);
                    // 서버 ID로부터 서버명/종족 자동 매칭
                    const srv = db.serverList.find((s) => String(s.id) === srvIdFromUrl);
                    if (srv) {
                      setDraft((cur) => cur ? {
                        ...cur,
                        race: srv.race as Race,
                        server: srv.name,
                        characterId: cidFromUrl,
                      } : cur);
                      setFetchMsg(`✓ URL에서 추출 — 서버 ${srv.name}(${srv.race})`);
                      return;
                    }
                    // 서버 못 찾으면 cid만 추출
                    patch("characterId", cidFromUrl);
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
                disabled={fetching || !(d.characterId ?? d.cid ?? "").trim()}
                onClick={async () => {
                  const cid = (d.characterId ?? d.cid ?? "").trim();
                  if (!cid) return;
                  const srvId = getServerId(d.server, d.race, db);
                  if (!srvId) {
                    setFetchMsg("서버 ID를 찾을 수 없습니다. 서버/종족 확인.");
                    return;
                  }
                  setFetching(true);
                  setFetchMsg(null);
                  try {
                    const info = await fetchCharacterFullInfo(cid, srvId);
                    const patches: Partial<Character> = {};
                    if (info.name) patches.name = info.name;
                    if (info.level !== undefined) patches.level = info.level;
                    if (info.cp !== undefined) patches.cp = info.cp;
                    if (info.itemLevel !== undefined) patches.itemLevel = info.itemLevel;
                    // 종족 매핑 — "천족" / "마족" 그대로 사용
                    if (info.raceName === "천족" || info.raceName === "마족") {
                      patches.race = info.raceName as Race;
                    }
                    // 직업 매핑 — className(한글) → classId
                    if (info.className) {
                      const cls = CLASSES.find((c) => c.name === info.className);
                      if (cls) patches.classId = cls.id;
                    }
                    // 서버 매핑 — serverName 그대로 매칭
                    if (info.serverName) {
                      const srv = db.serverList.find((s) => s.name === info.serverName);
                      if (srv) patches.server = srv.name;
                    }
                    setDraft((cur) => (cur ? { ...cur, ...patches } : cur));
                    const parts: string[] = [];
                    if (info.name) parts.push(info.name);
                    if (info.level) parts.push(`Lv.${info.level}`);
                    if (info.className) parts.push(info.className);
                    setFetchMsg(`✓ 갱신됨 (${parts.join(" · ") || "정보 적용"})`);
                  } catch (e) {
                    setFetchMsg(`✗ 실패: ${(e as Error).message}`);
                  } finally {
                    setFetching(false);
                  }
                }}
                className="border border-border"
                title="aion2.plaync.com에서 캐릭터 정보(이름·레벨·종족·직업·서버·전투력·아이템레벨) 가져오기"
              >
                {fetching ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                불러오기
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => {
                  const cidVal = (d.characterId ?? d.cid ?? "").trim();
                  // 캐릭터 ID 미입력 → 공식 캐릭터 검색 페이지로 이동
                  if (!cidVal) {
                    try {
                      window.open(
                        "https://aion2.plaync.com/ko-kr/characters/index",
                        "_blank",
                        "noopener,noreferrer"
                      );
                    } catch { /* ignore */ }
                    return;
                  }
                  const url = charProfileUrl(d, db);
                  if (!url) {
                    setFetchMsg("프로필 URL을 만들 수 없습니다. 이름/서버 확인.");
                    return;
                  }
                  try { window.open(url, "_blank", "noopener,noreferrer"); }
                  catch { /* ignore */ }
                }}
                className="border border-border"
                title="캐릭터 ID 입력 시: 프로필 페이지 / 미입력 시: 캐릭터 검색 페이지 열기"
              >
                <ExternalLink className="h-3.5 w-3.5" /> 링크
              </Button>
            </div>
            {/* 초등학생도 따라할 수 있는 캐릭터 ID 가져오기 안내 — 접기/펴기 */}
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
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">캐릭터명</Label>
              <Input value={d.name} onChange={(e) => patch("name", e.target.value)} maxLength={20} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">레벨</Label>
              <Input type="number" min={1} max={99} value={d.level} onChange={(e) => patch("level", Number(e.target.value) || 1)} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">전투력 (천 단위)</Label>
              <Input
                type="number"
                value={d.cp ?? 0}
                onChange={(e) => patch("cp", Number(e.target.value) || 0)}
                placeholder="예: 578"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">아이템 레벨</Label>
              <Input type="number" value={d.itemLevel ?? 0} onChange={(e) => patch("itemLevel", Number(e.target.value) || 0)} />
            </div>
            <div className="space-y-1 col-span-2">
              <Label className="text-xs text-muted-foreground">직업</Label>
              <Select value={d.classId} onValueChange={(v) => patch("classId", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CLASSES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.icon} {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* ── 메모 ── */}
        <div className="rounded border bg-card/40 p-3 space-y-1">
          <Label className="text-xs text-muted-foreground">
            메모 <span className="text-muted-foreground/70">(선택 사항)</span>
          </Label>
          <Input value={d.memo ?? ""} onChange={(e) => patch("memo", e.target.value)} placeholder="장비, 빌드, 공략 메모…" maxLength={300} />
        </div>

        {/* ── 패스 ── */}
        <div className="rounded border bg-card/40 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="text-xs font-extrabold text-muted-foreground">
              패스 <span className="font-normal text-muted-foreground/70">(선택 사항)</span>
            </div>
            <span className="text-[10px] text-muted-foreground italic">Enter로 태그 추가, 태그 클릭으로 삭제</span>
          </div>
          <PassTagInput
            value={d.passes ?? []}
            onChange={(next) => patch("passes", next)}
          />
        </div>

        {/* 콘텐츠 박스 표시 여부 — 체크 해제 시 [ - ] 자리표시자로 숨김 */}
        <div className="space-y-2 border-t pt-3">
          <Label className="text-xs text-muted-foreground">콘텐츠 박스 표시 여부 (체크 해제 = 숨김)</Label>
          <div className="grid grid-cols-4 gap-2">
            {CARD_CONTENTS.map((ct) => {
              const visible = !d.hiddenContents?.[ct.id];
              return (
                <label
                  key={ct.id}
                  className="flex items-center gap-2 px-2 py-1.5 rounded border bg-card hover:bg-accent/10 cursor-pointer text-xs"
                >
                  <Checkbox
                    checked={visible}
                    onCheckedChange={(v) => {
                      const next = { ...(d.hiddenContents ?? {}) };
                      if (v) delete next[ct.id];
                      else next[ct.id] = true;
                      patch("hiddenContents", next);
                    }}
                  />
                  <span>{ct.icon} {ct.name}</span>
                </label>
              );
            })}
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

/** 패스 태그 입력 — Enter로 추가, 태그 클릭으로 삭제. V4.0.9 동등 */
function PassTagInput({ value, onChange }: { value: string[]; onChange: (next: string[]) => void }) {
  const [input, setInput] = useState("");
  function add() {
    const v = input.trim();
    if (!v) return;
    if (value.includes(v)) { setInput(""); return; }
    onChange([...value, v]);
    setInput("");
  }
  function remove(idx: number) {
    onChange(value.filter((_, i) => i !== idx));
  }
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-1.5">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); add(); }
            else if (e.key === "Backspace" && !input && value.length > 0) {
              remove(value.length - 1);
            }
          }}
          placeholder="패스명 입력 (예: 연속강화패스) → Enter"
          maxLength={30}
          className="flex-1"
        />
        <Button type="button" size="sm" variant="ghost" onClick={add} disabled={!input.trim()} className="border border-border">
          추가
        </Button>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {value.map((tag, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => remove(idx)}
              title="클릭하여 삭제"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded border border-amber-400/50 bg-amber-400/10 text-amber-300 text-xs hover:bg-amber-400/25 hover:border-amber-400"
            >
              {tag} <span className="opacity-60">×</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
