"use client";

/**
 * html2canvas-pro로 DOM 요소를 PNG로 저장.
 * SSR 안전을 위해 동적 import 사용.
 */
export async function saveElementAsPng(
  el: HTMLElement,
  filename: string,
  options: { backgroundColor?: string | null } = {}
): Promise<void> {
  if (typeof window === "undefined") return;
  const { default: html2canvas } = await import("html2canvas-pro");
  const canvas = await html2canvas(el, {
    backgroundColor: options.backgroundColor ?? "#18161e",
    scale: 2,
    useCORS: true,
    logging: false,
  });
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
  );
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".png") ? filename : filename + ".png";
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** PNG를 클립보드에 복사 (Tauri webview + 모던 브라우저 지원) */
export async function copyElementAsPng(el: HTMLElement): Promise<boolean> {
  if (typeof window === "undefined" || !navigator.clipboard) return false;
  try {
    const { default: html2canvas } = await import("html2canvas-pro");
    const canvas = await html2canvas(el, { backgroundColor: "#18161e", scale: 2, useCORS: true, logging: false });
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("toBlob failed"))), "image/png")
    );
    // @ts-ignore - ClipboardItem is widely supported but may not be in older lib.dom
    await navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]);
    return true;
  } catch {
    return false;
  }
}
