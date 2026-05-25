"use client";

import { useBarrackStore } from "./store";
import { validateBarrackImport } from "./import-validate";
import { toast } from "@/lib/util/toast";
import { confirmDialog } from "@/lib/util/confirm";

/** 배럭 데이터(.txt JSON) 저장 — V4.0.9 호환 형식 */
export function exportBarrackTxt(): void {
  const s = useBarrackStore.getState();
  const payload = {
    __type: "a2-barrack",
    version: 1,
    exportedAt: new Date().toISOString(),
    accounts: s.accounts,
    characters: s.characters,
    dbSettings: s.dbSettings,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `a2-barrack-${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** 배럭 데이터(.txt JSON) 불러오기 */
export function importBarrackTxt(): void {
  const inp = document.createElement("input");
  inp.type = "file";
  inp.accept = ".txt,.json";
  inp.onchange = (e) => {
    const f = (e.target as HTMLInputElement).files?.[0];
    if (!f) return;
    const rd = new FileReader();
    rd.onload = async (ev) => {
      try {
        const d = JSON.parse(String(ev.target?.result));
        // 스키마 검증 — 손상 데이터 차단 + 부분 손상 시 skip 카운트
        const { data, skipped } = validateBarrackImport(d);
        const skipMsg = (skipped.accounts || skipped.characters)
          ? `\n(손상으로 제외: 계정 ${skipped.accounts}개, 캐릭터 ${skipped.characters}개)`
          : "";
        if (!(await confirmDialog({
          title: "배럭 데이터 불러오기",
          description:
            `계정 ${data.accounts.length}개 · 캐릭터 ${data.characters.length}개를 불러옵니다.\n` +
            `현재 데이터를 덮어쓸까요?${skipMsg}`,
          confirmText: "덮어쓰기",
          variant: "destructive",
        }))) return;
        const store = useBarrackStore.getState();
        store.setBarrackData({ accounts: data.accounts, characters: data.characters });
        // dbSettings는 자체 구조가 복잡 — 통과 시 그대로 적용 (별도 검증 미적용)
        if (data.dbSettings && typeof data.dbSettings === "object") {
          store.setDb(data.dbSettings as Parameters<typeof store.setDb>[0]);
        }
        toast.success(`배럭 데이터를 불러왔습니다.${skipMsg}`);
      } catch (err) {
        toast.error("불러오기 실패: " + (err as Error).message);
      }
    };
    rd.readAsText(f);
  };
  inp.click();
}
