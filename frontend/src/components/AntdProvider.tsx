'use client';

import { ConfigProvider, App as AntdApp } from 'antd';
import enUS from 'antd/locale/en_US';
import zhCN from 'antd/locale/zh_CN';
import { AntdRegistry } from '@ant-design/nextjs-registry';
import { useMemo, type ReactNode } from 'react';
import { buildAntdTheme } from '@/lib/theme';
import { useTheme } from '@/components/ThemeProvider';
import { useLanguage } from '@/components/LanguageProvider';

export function AntdProvider({ children }: { children: ReactNode }) {
  const { resolvedMode } = useTheme();
  const { language } = useLanguage();
  const theme = useMemo(() => buildAntdTheme(resolvedMode), [resolvedMode]);

  return (
    <AntdRegistry>
      <ConfigProvider locale={language === 'en-US' ? enUS : zhCN} theme={theme}>
        <AntdApp component={false}>{children}</AntdApp>
      </ConfigProvider>
    </AntdRegistry>
  );
}
