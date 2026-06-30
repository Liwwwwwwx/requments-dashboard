'use client';

import { ConfigProvider, App as AntdApp } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { useMemo, type ReactNode } from 'react';
import { buildAntdTheme } from '@/lib/theme';
import { useTheme } from '@/components/ThemeProvider';

export function AntdProvider({ children }: { children: ReactNode }) {
  const { resolvedMode } = useTheme();
  const theme = useMemo(() => buildAntdTheme(resolvedMode), [resolvedMode]);

  return (
    <AntdRegistry>
      <ConfigProvider locale={zhCN} theme={theme}>
        <AntdApp component={false}>{children}</AntdApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
