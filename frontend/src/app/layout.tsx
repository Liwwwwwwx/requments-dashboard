import type { Metadata } from 'next';
import { AntdProvider } from '@/components/AntdProvider';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import AuthLayout from './AuthLayout';
import './globals.css';

export const metadata: Metadata = {
  title: '需求看板',
  description: '多项目需求看板：需求、子任务、接口契约、进度统一管理'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@300;400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <ErrorBoundary>
          <AntdProvider>
            <AuthLayout>{children}</AuthLayout>
          </AntdProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}