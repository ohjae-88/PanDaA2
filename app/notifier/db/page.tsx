"use client";

import { useMemo, useState, useEffect } from "react";
import { Download, Upload, Pencil, Trash2, RotateCcw, Plus, Bell, Eye, EyeOff } from "lucide-react";
import { useNotifierStore } from "@/lib/notifier/store";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { NotifierEditDialog } from "@/components/notifier/edit-dialog";
import { NotifierAlertModal } from "@/components/notifier/alert-modal";
import { CombinedAlertModal } from "@/components/notifier/combined-alert-modal";
import { useNotifierTick } from "@/components/notifier/use-notifier-tick";
import { newNotifierId } from "@/lib/notifier/id";

type SortKey = "type" | "tier" | "name" | "area" | "cycle" | "notify" | "";

export default function NotifierDbPage() {
  useNotifierTick();

  const items = useNotifierStore((s) => s.items);
  const removeItem = useNotifierStore((s) => s.removeItem);
  const resetSeed = useNotifierStore((s) => s.resetSeed);
  const setItems = useNotifierStore((s) => s.setItems);
  const toggleNotify = useNotifierStore((s) => s.toggleNotify);
  const toggleDisplayHidden = useNotifierStore((s) => s.toggleDisplayHidden);

  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);

  const [editOpen, setEditOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const [q, setQ] = useState("");
  const [fType, setFType] = useState("");
  const [fTier, setFTier] = useState("");
  const [notifyOnly, setNotifyOnly] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("");
  const [sortDir, setSortDir] = useState<1 | -1>(1);

  const types = useMemo(() => [...new Set(items.map((x) => x.type || "").filter(Boolean))].sort(), [items]);
  const tiers = useMemo(() => [...new Set(items.map((x) => String(x.tier || "")).filter(Boolean))].sort(), [items]);

  const filtered = useMemo(() => {
    const ql = q.toLowerCase().trim();
    let out = items.filter((it) => {
      if (fType && (it.type || "") !== fType) return false;
      if (fTier && String(it.tier || "") !== fTier) return false;
      if (notifyOnly && !it.notifyEnabled) return false;
      if (ql) {
        const hay = `${it.type ?? ""} ${it.name ?? ""} ${it.area ?? ""}`.toLowerCase();
        if (!hay.includes(ql)) return false;
      }
      return true;
    });
    if (sortKey) {
      out = out.slice().sort((a, b) => {
        let av: number | string = 0, bv: number | string = 0;
        if (sortKey === "tier") { av = +a.tier || 0; bv = +b.tier || 0; }
        else if (sortKey === "cycle") {
          av = a.cycleType === "cooldown" ? a.cycleMinutes : 99999;
          bv = b.cycleType === "cooldown" ? b.cycleMinutes : 99999;
        } else if (sortKey === "notify") {
          av = a.notifyEnabled ? 1 : 0;
          bv = b.notifyEnabled ? 1 : 0;
        } else {
          av = (a[sortKey] ?? "").toString();
          bv = (b[sortKey] ?? "").toString();
        }
        if (av < bv) return -1 * sortDir;
        if (av > bv) return 1 * sortDir;
        return 0;
      });
    }
    return out;
  }, [items, q, fType, fTier, notifyOnly, sortKey, sortDir]);

  function setSort(k: SortKey) {
    if (sortKey === k) setSortDir((d) => (d * -1) as 1 | -1);
    else { setSortKey(k); setSortDir(1); }
  }
  function sortArrow(k: SortKey) {
    if (sortKey !== k) return <span className="text-[9px] opacity-50">▲▼</span>;
    return <span className="text-[9px] text-accent">{sortDir > 0 ? "▲" : "▼"}</span>;
  }

  async function handleDelete(id: string) {
    if (!(await confirmDialog({ title: "항목 삭제", description: "이 항목을 삭제하시겠습니까?", confirmText: "삭제", variant: "destructive" }))) return;
    removeItem(id);
  }

  async function handleResetSeed() {
    if (!(await confirmDialog({ title: "DB 초기화", description: "기초 데이터로 모든 항목을 초기화합니다.\n사용자 추가 항목 포함 모두 삭제됩니다.", confirmText: "초기화", variant: "destructive" }))) return;
    resetSeed();
  }

  function handleExport() {
    const data = { version: 1, exportedAt: new Date().toISOString(), items };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `notifier-db-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function handleImport() {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".json,.txt";
    inp.onchange = (e) => {
      const f = (e.target as HTMLInputElement).files?.[0];
      if (!f) return;
      const rd = new FileReader();
      rd.onload = async (ev) => {
        try {
          const d = JSON.parse(String(ev.target?.result));
          const raw = Array.isArray(d) ? d : Array.isArray(d.items) ? d.items : null;
          if (!raw) throw new Error("형식 오류");
          const overwrite = await confirmDialog({
            title: "알리미 DB 불러오기",
            description: `${raw.length}개 항목을 불러옵니다.\n현재 항목을 덮어쓸까요?`,
            confirmText: "덮어쓰기",
            cancelText: "추가 병합",
          });
          if (overwrite) {
            const normalized = raw.map((it: any, i: number) => ({
              id: it.id || newNotifierId(`imp_${i}`),
              type: it.type ?? "",
              tier: Number(it.tier) || 1,
              name: it.name ?? "",
              area: it.area ?? "",
              cycleType: it.cycleType ?? "cooldown",
              cycleMinutes: Number(it.cycleMinutes) || 60,
              specificTimes: Array.isArray(it.specificTimes) ? it.specificTimes : [],
              lastSpawnTs: it.lastSpawnTs ?? null,
              notifyEnabled: !!it.notifyEnabled,
              notifyBeforeMin: Number(it.notifyBeforeMin) || 5,
              important: !!it.important,
            }));
            setItems(normalized);
          } else {
            const cur = useNotifierStore.getState().items.slice();
            raw.forEach((it: any, i: number) => {
              cur.push({
                id: it.id || newNotifierId(`imp_${i}`),
                type: it.type ?? "",
                tier: Number(it.tier) || 1,
                name: it.name ?? "",
                area: it.area ?? "",
                cycleType: it.cycleType ?? "cooldown",
                cycleMinutes: Number(it.cycleMinutes) || 60,
                specificTimes: Array.isArray(it.specificTimes) ? it.specificTimes : [],
                lastSpawnTs: it.lastSpawnTs ?? null,
                notifyEnabled: !!it.notifyEnabled,
                notifyBeforeMin: Number(it.notifyBeforeMin) || 5,
                important: !!it.important,
              });
            });
            setItems(cur);
          }
          toast.success("불러오기 완료");
        } catch (err: any) {
          toast.error("불러오기 실패: " + err.message);
        }
      };
      rd.readAsText(f);
    };
    inp.click();
  }

  if (!hydrated) return <div className="text-muted-foreground">로딩 중…</div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold flex items-center gap-2">⏰ 알리미 DB</h1>
          <p className="text-xs text-muted-foreground mt-1">기초 데이터 외 항목을 추가하거나 편집합니다.</p>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <Button size="sm" onClick={() => { setEditId(null); setEditOpen(true); }}>
          <Plus className="h-4 w-4" /> 항목 추가
        </Button>
        <Button variant="ghost" size="sm" onClick={handleResetSeed}>
          <RotateCcw className="h-4 w-4" /> 기초 데이터 재적용
        </Button>
        <div className="ml-auto flex gap-2">
          <Button variant="ghost" size="sm" onClick={handleExport}>
            <Download className="h-4 w-4" /> 저장
          </Button>
          <Button variant="ghost" size="sm" onClick={handleImport}>
            <Upload className="h-4 w-4" /> 불러오기
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <Label className="text-muted-foreground">검색</Label>
        <Input className="w-[200px] h-8" placeholder="이름·지역·구분" value={q} onChange={(e) => setQ(e.target.value)} />
        <Label className="text-muted-foreground">구분</Label>
        <Select value={fType || "_all"} onValueChange={(v) => setFType(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[120px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체</SelectItem>
            {types.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Label className="text-muted-foreground">티어</Label>
        <Select value={fTier || "_all"} onValueChange={(v) => setFTier(v === "_all" ? "" : v)}>
          <SelectTrigger className="w-[100px] h-8"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">전체</SelectItem>
            {tiers.map((t) => <SelectItem key={t} value={t}>T{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <label className="inline-flex items-center gap-1.5 cursor-pointer">
          <Checkbox checked={notifyOnly} onCheckedChange={(v) => setNotifyOnly(!!v)} />
          <span>알림 켜진 항목만</span>
        </label>
        <span className="ml-auto text-muted-foreground">{filtered.length} / {items.length}</span>
      </div>

      <div className="rounded-lg border overflow-hidden bg-card">
        <table className="w-full text-xs">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-center px-2 py-1.5 font-bold text-muted-foreground w-16" title="사용자설정 모드에서 보이기/숨기기">
                보이기
              </th>
              {([
                ["type", "구분"],
                ["tier", "티어"],
                ["name", "보스명"],
                ["area", "지역"],
                ["cycle", "젠주기"],
                ["notify", "알림"],
              ] as const).map(([k, label]) => (
                <th
                  key={k}
                  className={cn("text-left px-2.5 py-1.5 font-bold text-muted-foreground cursor-pointer select-none hover:text-foreground")}
                  onClick={() => setSort(k as SortKey)}
                >
                  {label} {sortArrow(k as SortKey)}
                </th>
              ))}
              <th className="text-left px-2.5 py-1.5 font-bold text-muted-foreground">액션</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={8} className="text-center text-muted-foreground py-6">항목 없음</td></tr>
            ) : filtered.map((it) => {
              const on = it.notifyEnabled;
              const shown = !it.displayHidden;
              const cycleLabel = it.cycleType === "cooldown"
                ? `쿨타임 ${it.cycleMinutes}분`
                : (it.specificTimes.length ? `특정시간 ${it.specificTimes.length}개` : "특정시간 (미지정)");
              return (
                <tr key={it.id} className={cn("border-t", on && "bg-gold/[0.06] hover:bg-gold/[0.14]")}>
                  <td className="px-2 py-1.5 text-center">
                    <button
                      onClick={() => toggleDisplayHidden(it.id)}
                      className={cn(
                        "inline-flex items-center justify-center w-7 h-7 rounded transition-colors",
                        shown
                          ? "bg-cat-notifier/15 text-cat-notifier hover:bg-cat-notifier/25"
                          : "bg-muted/40 text-muted-foreground hover:text-foreground"
                      )}
                      title={`사용자설정 모드에서 ${shown ? "표시 중 → 클릭하여 숨기기" : "숨김 → 클릭하여 표시"}`}
                    >
                      {shown ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
                    </button>
                  </td>
                  <td className="px-2.5 py-1.5">{it.type}</td>
                  <td className="px-2.5 py-1.5">{it.tier || "-"}</td>
                  <td className="px-2.5 py-1.5">{it.name}</td>
                  <td className="px-2.5 py-1.5">{it.area || "-"}</td>
                  <td className="px-2.5 py-1.5">{cycleLabel}</td>
                  <td className="px-2.5 py-1.5">
                    <button
                      onClick={() => toggleNotify(it.id)}
                      className={cn(
                        "inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold transition-colors",
                        on
                          ? "bg-gold/15 border-gold/50 text-gold-light shadow-[0_0_6px_hsl(var(--gold)/0.20)]"
                          : "bg-card border-border text-muted-foreground hover:text-foreground"
                      )}
                      title={`클릭하여 ${on ? "끄기" : "켜기"}`}
                    >
                      {on ? <><Bell className="h-3 w-3" /> 켜짐 · {it.notifyBeforeMin}분</> : <>꺼짐</>}
                    </button>
                  </td>
                  <td className="px-2.5 py-1.5">
                    <div className="flex gap-1">
                      <Button variant="ghost" size="xs" onClick={() => { setEditId(it.id); setEditOpen(true); }}>
                        <Pencil className="h-3 w-3" /> 편집
                      </Button>
                      <Button variant="ghost" size="xs" onClick={() => handleDelete(it.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <NotifierEditDialog open={editOpen} itemId={editId} onClose={() => setEditOpen(false)} />
      <NotifierAlertModal />
      <CombinedAlertModal />
    </div>
  );
}
