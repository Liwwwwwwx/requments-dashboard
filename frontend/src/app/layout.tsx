import { UpdateNotifier } from '@/components/UpdateNotifier';
import type { Metadata } from 'next';
import { AntdProvider } from '@/components/AntdProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { ThemeProvider, themeInitScript } from '@/components/ThemeProvider';
import AuthLayout from './AuthLayout';
import './globals.css';

export const metadata: Metadata = {
  title: 'TraceBoard',
  description: 'TraceBoard — 事件溯源驱动的多项目需求管理平台'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <head>
        {/* 无闪烁：绘制前设好 data-theme */}
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ErrorBoundary>
          <ThemeProvider>
            <AntdProvider>
              <AuthLayout>{children}</AuthLayout>
              <UpdateNotifier />
            </AntdProvider>
          </ThemeProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
