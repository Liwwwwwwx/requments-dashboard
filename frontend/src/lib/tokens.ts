/**
 * 设计 token 单一来源（品牌 / 语义色）。
 *
 * 这里集中定义 AntD 需要的颜色 token；`theme.ts` 由此派生 light / dark 两套
 * ThemeConfig。自定义 UI（非 AntD 组件）的样式真值在 `app/globals.css` 的
 * `:root` 与 `[data-theme="dark"]` 中，CSS 变量命名与此处一一对应（见 DESIGN.md）。
 * 改色时两处同步，避免漂移。
 */

export type ThemeMode = 'light' | 'dark';

/** AntD ConfigProvider 所需的核心颜色 token，按主题成对。 */
interface AntdColorTokens {
  colorPrimary: string;
  colorInfo: string;
  colorSuccess: string;
  colorWarning: string;
  colorError: string;

  colorBgBase: string;
  colorTextBase: string;
  colorBgContainer: string;
  colorBgElevated: string;
  colorBgLayout: string;

  colorBorder: string;
  colorBorderSecondary: string;
}

export const lightTokens: AntdColorTokens = {
  colorPrimary: '#2563eb',
  colorInfo: '#2563eb',
  colorSuccess: '#16a34a',
  colorWarning: '#d97706',
  colorError: '#dc2626',

  colorBgBase: '#f6f7f9',
  colorTextBase: '#0f172a',
  colorBgContainer: '#ffffff',
  colorBgElevated: '#ffffff',
  colorBgLayout: '#f6f7f9',

  colorBorder: 'rgba(15, 23, 42, 0.13)',
  colorBorderSecondary: 'rgba(15, 23, 42, 0.09)'
};

export const darkTokens: AntdColorTokens = {
  colorPrimary: '#5b8cff',
  colorInfo: '#5b8cff',
  colorSuccess: '#3ecb7a',
  colorWarning: '#f0a23b',
  colorError: '#ff6b6b',

  colorBgBase: '#0c0e13',
  colorTextBase: '#eceef3',
  colorBgContainer: '#15181f',
  colorBgElevated: '#1b1f28',
  colorBgLayout: '#0c0e13',

  colorBorder: 'rgba(237, 242, 255, 0.13)',
  colorBorderSecondary: 'rgba(237, 242, 255, 0.09)'
};

/** 与主题无关的形状 / 字体 / 控件尺寸 token。 */
export const sharedTokens = {
  borderRadius: 8,
  borderRadiusSM: 6,
  borderRadiusLG: 12,

  fontFamily:
    '"IBM Plex Sans", "PingFang SC", "Microsoft YaHei", -apple-system, BlinkMacSystemFont, "Helvetica Neue", Arial, sans-serif',
  fontSize: 14,

  controlHeight: 34,
  controlHeightSM: 28
};

export const COLOR_TOKENS: Record<ThemeMode, AntdColorTokens> = {
  light: lightTokens,
  dark: darkTokens
};
