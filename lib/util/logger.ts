"use client";

/**
 * 로그 wrapper — Tauri 환경에선 tauri-plugin-log로 파일+stdout 양쪽 전송,
 * 브라우저(dev/iframe)에서는 console로 폴백.
 *
 * 로그 파일 위치 (Tauri):
 *   Windows: %LOCALAPPDATA%/판다의 A2 통합/logs/
 *
 * 사용 예:
 *   import { log } from "@/lib/util/logger";
 *   log.info("user clicked X", { userId: 123 });
 *   log.error("import failed", err);
 */

import { isTauri } from "@/lib/tauri";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error";

type LogPlugin = {
  trace: (msg: string) => Promise<void>;
  debug: (msg: string) => Promise<void>;
  info:  (msg: string) => Promise<void>;
  warn:  (msg: string) => Promise<void>;
  error: (msg: string) => Promise<void>;
};

let pluginLoaded: Promise<LogPlugin | null> | null = null;

function loadPlugin(): Promise<LogPlugin | null> {
  if (!isTauri()) return Promise.resolve(null);
  if (!pluginLoaded) {
    // npm install 전엔 모듈이 없을 수 있음 — 동적 import + catch로 안전 폴백
    pluginLoaded = import(/* @vite-ignore */ "@tauri-apps/plugin-log" as string)
      .then((m) => m as unknown as LogPlugin)
      .catch(() => null);
  }
  return pluginLoaded;
}

function stringify(args: unknown[]): string {
  return args
    .map((a) => {
      if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack ?? ""}`;
      if (typeof a === "string") return a;
      try { return JSON.stringify(a); } catch { return String(a); }
    })
    .join(" ");
}

async function send(level: LogLevel, args: unknown[]) {
  const msg = stringify(args);
  const plugin = await loadPlugin();
  if (plugin) {
    try {
      switch (level) {
        case "trace": await plugin.trace(msg); break;
        case "debug": await plugin.debug(msg); break;
        case "info":  await plugin.info(msg); break;
        case "warn":  await plugin.warn(msg); break;
        case "error": await plugin.error(msg); break;
      }
      return;
    } catch {
      // fall through to console
    }
  }
  const fn = (
    level === "error" ? console.error
    : level === "warn" ? console.warn
    : level === "debug" ? console.debug
    : console.log
  );
  fn(`[${level}]`, ...args);
}

export const log = {
  trace: (...args: unknown[]) => { void send("trace", args); },
  debug: (...args: unknown[]) => { void send("debug", args); },
  info:  (...args: unknown[]) => { void send("info", args); },
  warn:  (...args: unknown[]) => { void send("warn", args); },
  error: (...args: unknown[]) => { void send("error", args); },
};
