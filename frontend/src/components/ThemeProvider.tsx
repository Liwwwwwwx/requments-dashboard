'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import type { ThemeMode } from '@/lib/tokens';

/** 用户选择：明确亮 / 暗，或跟随系统。 */
export type ThemePreference = 'light' | 'dark' | 'system';

export const THEME_STORAGE_KEY = 'tb-theme';

interface ThemeContextValue {
  /** 用户偏好（含 system）。 */
  preference: ThemePreference;
  /** 实际生效的模式（system 解析后）。 */
  resolvedMode: ThemeMode;
  setPreference: (pref: ThemePreference) => void;
  /** light → dark → system → light 循环。 */
  cycle: () => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

function getSystemMode(): ThemeMode {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function resolve(pref: ThemePreference): ThemeMode {
  return pref === 'system' ? getSystemMode() : pref;
}

function applyMode(mode: ThemeMode) {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = mode;
}

const CYCLE: ThemePreference[] = ['light', 'dark', 'system'];

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [preference, setPreferenceState] = useState<ThemePreference>('system');
  const [resolvedMode, setResolvedMode] = useState<ThemeMode>('light');

  // 挂载后读取已保存偏好（SSR 期间用默认值，避免水合不一致）。
  useEffect(() => {
    let initial: ThemePreference = 'system';
    try {
      const stored = window.localStorage.getItem(THEME_STORAGE_KEY) as ThemePreference | null;
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        initial = stored;
      }
    } catch {
      // localStorage 不可用时回退 system
    }
    setPreferenceState(initial);
    const mode = resolve(initial);
    setResolvedMode(mode);
    applyMode(mode);
  }, []);

  // 偏好为 system 时，跟随系统主题变化。
  useEffect(() => {
    if (preference !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => {
      const mode = mq.matches ? 'dark' : 'light';
      setResolvedMode(mode);
      applyMode(mode);
    };
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [preference]);

  const setPreference = useCallback((pref: ThemePreference) => {
    setPreferenceState(pref);
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, pref);
    } catch {
      // 忽略持久化失败
    }
    const mode = resolve(pref);
    setResolvedMode(mode);
    applyMode(mode);
  }, []);

  const cycle = useCallback(() => {
    const idx = CYCLE.indexOf(preference);
    setPreference(CYCLE[(idx + 1) % CYCLE.length]);
  }, [preference, setPreference]);

  const value = useMemo<ThemeContextValue>(
    () => ({ preference, resolvedMode, setPreference, cycle }),
    [preference, resolvedMode, setPreference, cycle]
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // 未包裹 Provider 时的安全兜底（亮色、无操作）。
    return {
      preference: 'system',
      resolvedMode: 'light',
      setPreference: () => {},
      cycle: () => {}
    };
  }
  return ctx;
}

/**
 * 无闪烁内联脚本：在首帧绘制前根据 localStorage / 系统偏好设好
 * `data-theme`，避免亮→暗跳变。注入到 <head>。
 */
export const themeInitScript = `(function(){try{var k='${THEME_STORAGE_KEY}';var p=localStorage.getItem(k);var d=window.matchMedia('(prefers-color-scheme: dark)').matches;var m=(p==='light'||p==='dark')?p:(d?'dark':'light');document.documentElement.dataset.theme=m;}catch(e){document.documentElement.dataset.theme='light';}})();`;
