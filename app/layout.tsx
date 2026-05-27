import type { Metadata } from "next";
import { Suspense } from "react";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/site-header";
import { MainWrapper } from "@/components/main-wrapper";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AppProviders } from "@/components/app-providers";
import { UpdateCheckProvider } from "@/components/update-check-provider";
import { EmbedScaleApplier } from "@/components/embed-scale-applier";
import { Toaster } from "@/components/ui/sonner";
import { ConfirmDialogHost } from "@/components/confirm-dialog-host";

export const metadata: Metadata = {
  title: "판다의 A2 통합",
  description: "배럭 · 파티 · 아르카나 · 알리미",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          <TooltipProvider delayDuration={150}>
            {/* pathname 기준 Provider 분기 — 장비창은 경량 모드 */}
            <Suspense fallback={null}>
              <AppProviders />
            </Suspense>
            {/* useSearchParams 사용 컴포넌트 — Next.js 정적 export 시 Suspense 필요 */}
            <Suspense fallback={null}>
              <EmbedScaleApplier />
              <SiteHeader />
              <MainWrapper>{children}</MainWrapper>
            </Suspense>
            {/* Suspense 바깥 마운트 — Suspense 재렌더링 시 언마운트되면 Rust 콜백 유실 */}
            <UpdateCheckProvider />
            <Toaster />
            <ConfirmDialogHost />
          </TooltipProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
