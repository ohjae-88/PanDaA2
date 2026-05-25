"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { EquipDialog, type DirectCharInfo } from "@/components/barrack/equip-dialog";
import { TooltipProvider } from "@/components/ui/tooltip";

/** 신규 윈도우에서 단일 캐릭터 장비·스킬 표시 (타이틀바 + 카드 풀스크린).
 *  URL 파라미터:
 *    ?charId=<배럭 캐릭터 id>  — 배럭 store에서 매칭
 *    또는 ?cid=<inven cid>&serverId=<n>&name=<n>...  — 파티 도메인 직접 호출
 *
 *  단일 인스턴스화 — 라벨 "equip" 고정. 다른 캐릭터 클릭 시 외부 emit("equip-window-navigate")
 *  수신 → charId state 갱신하여 동일 윈도우 내 재로드. */
function EquipWindowInner() {
  const params = useSearchParams();
  const [open, setOpen] = useState(true);
  const initialCharId = params.get("charId");
  const [charId, setCharId] = useState<string | null>(initialCharId);

  // 닫기 → 윈도우 닫기
  useEffect(() => {
    if (open) return;
    (async () => {
      try {
        const w = await import("@tauri-apps/api/webviewWindow");
        const cur = w.getCurrentWebviewWindow();
        await cur.close();
      } catch {
        // 비-Tauri 환경 — fallback no-op
      }
    })();
  }, [open]);

  // navigate 이벤트 — 외부에서 다른 char 요청 시 동일 윈도우 갱신
  useEffect(() => {
    let unlisten: (() => void) | undefined;
    (async () => {
      try {
        const mod = await import("@tauri-apps/api/event");
        const unsub = await mod.listen<{ charId?: string }>("equip-window-navigate", (e) => {
          const next = e.payload?.charId;
          if (typeof next === "string" && next.length > 0) {
            setCharId(next);
          }
        });
        unlisten = unsub;
      } catch {
        // 비-Tauri 환경
      }
    })();
    return () => { if (unlisten) unlisten(); };
  }, []);

  const directRaw: DirectCharInfo | null = (() => {
    const cid = params.get("cid");
    const serverId = params.get("serverId");
    const name = params.get("name");
    if (!cid || !serverId || !name) return null;
    return {
      cid,
      serverId,
      name,
      level: Number(params.get("level")) || undefined,
      cp: Number(params.get("cp")) || undefined,
      itemLevel: Number(params.get("itemLevel")) || undefined,
      classIcon: params.get("classIcon") ?? undefined,
      classColor: params.get("classColor") ?? undefined,
      className: params.get("className") ?? undefined,
      serverName: params.get("serverName") ?? undefined,
      raceForUrl: params.get("raceForUrl") ?? undefined,
    };
  })();

  return (
    <TooltipProvider delayDuration={150}>
      <EquipDialog
        open={open}
        charId={charId}
        directChar={directRaw}
        onClose={() => setOpen(false)}
        standalone
      />
    </TooltipProvider>
  );
}

export default function EquipWindowPage() {
  return (
    <Suspense fallback={<div className="p-4 text-muted-foreground">로딩…</div>}>
      <EquipWindowInner />
    </Suspense>
  );
}
