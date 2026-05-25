"use client";

import { useNotifierTick } from "@/components/notifier/use-notifier-tick";

/**
 * 메인/오버레이 윈도우 어디에 마운트하든 알리미 tick(1초)을 보장.
 * - 메인은 어느 페이지에 있든(트레이 hide 상태에서도 webview 살아있음) 알람 발화
 * - 오버레이는 collapsedMode가 normal/party 무관 항상 발화
 *
 * useNotifierTick 자체에 중복 마운트 가드(module-level flag) 있어
 * NotifierPanel 등에서 추가 호출되어도 setInterval은 1개만 동작.
 */
export function NotifierTickRunner() {
  useNotifierTick();
  return null;
}
