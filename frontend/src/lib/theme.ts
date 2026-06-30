import type { ThemeConfig } from 'antd';
import { theme } from 'antd';

export const designTokens = {
  colorPrimary: '#2563eb',
  colorInfo: '#2563eb',
  colorSuccess: '#16a34a',
  colorWarning: '#d97706',
  colorError: '#dc2626',

  colorBgBase: '#f4f5f7',
  colorTextBase: '#0f172a',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBgLayout: '#f4f5f7',

  colorBorder: 'rgba(15, 23, 42, 0.1)',
  colorBorderSecondary: 'rgba(15, 23, 42, 0.07)',

  borderRadius: 8,
  borderRadiusSM: 6,
  borderRadiusLG: 14,

  fontFamily:
    '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  fontSize: 14,

  controlHeight: 34,
  controlHeightSM: 28,

  boxShadow:
    '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 14px rgba(15, 23, 42, 0.06)',
  boxShadowSecondary:
    '0 4px 14px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)'
};

export const antdTheme: ThemeConfig = {
  algorithm: theme.defaultAlgorithm,
  token: designTokens
};