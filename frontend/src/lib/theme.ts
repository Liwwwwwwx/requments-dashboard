import type { ThemeConfig } from 'antd';
import { theme } from 'antd';
import { COLOR_TOKENS, sharedTokens, type ThemeMode } from './tokens';

/**
 * 按主题模式构建 AntD ThemeConfig。颜色来自 tokens.ts（单一来源），
 * 阴影按明暗分别给值，算法按模式切换 default / dark。
 */
export function buildAntdTheme(mode: ThemeMode): ThemeConfig {
  const colors = COLOR_TOKENS[mode];
  const shadow =
    mode === 'dark'
      ? {
          boxShadow:
            '0 1px 2px rgba(0, 0, 0, 0.4), 0 6px 18px rgba(0, 0, 0, 0.45)',
          boxShadowSecondary:
            '0 4px 16px rgba(0, 0, 0, 0.4), 0 1px 2px rgba(0, 0, 0, 0.3)'
        }
      : {
          boxShadow:
            '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 14px rgba(15, 23, 42, 0.06)',
          boxShadowSecondary:
            '0 4px 14px rgba(15, 23, 42, 0.06), 0 1px 2px rgba(15, 23, 42, 0.03)'
        };

  return {
    algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm,
    token: {
      ...colors,
      ...sharedTokens,
      ...shadow
    }
  };
}

/** 默认（亮色）主题，供未包裹 ThemeProvider 的场景兜底。 */
export const antdTheme: ThemeConfig = buildAntdTheme('light');
