import type { Metadata } from "next";
import "./globals.css";
import Header from '@/components/layout/Header';
import ClientProviders from '@/components/ClientProviders';
import { ThemeProvider } from '@/providers/ThemeProvider';
import { Toaster } from 'sonner';
import { PerformanceMonitor } from '@/components/PerformanceMonitor';
import { DMModalProvider } from '@/components/dm/DMModalProvider';

export const metadata: Metadata = {
  title: "My Blog",
  description: "개인 블로그입니다.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <link
          rel="stylesheet"
          as="style"
          crossOrigin=""
          href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable.min.css"
        />
      </head>
      <body
        className="bg-background text-foreground"
        style={{
          fontFamily: 'Pretendard Variable, Pretendard, -apple-system, BlinkMacSystemFont, system-ui, Roboto, "Helvetica Neue", "Segoe UI", "Apple SD Gothic Neo", "Noto Sans KR", "Malgun Gothic", "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif'
        }}
        suppressHydrationWarning={true}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          <ClientProviders>
            <DMModalProvider>
              <Header />
              {children}
              <Toaster position="top-center" richColors />
              <PerformanceMonitor />
            </DMModalProvider>
          </ClientProviders>
        </ThemeProvider>
      </body>
    </html>
  );
}
