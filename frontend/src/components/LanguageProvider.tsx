'use client';

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type AppLanguage = 'zh-CN' | 'en-US';

const LANGUAGE_STORAGE_KEY = 'tb-language';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'zh-CN',
  setLanguage: () => {}
});

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<AppLanguage>('zh-CN');

  const setLanguage = useCallback((next: AppLanguage) => {
    setLanguageState(next);
    document.documentElement.lang = next;
    try {
      window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    } catch {
      // localStorage 不可用时仍保持本次会话的选择
    }
  }, []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(LANGUAGE_STORAGE_KEY);
      if (stored === 'zh-CN' || stored === 'en-US') {
        setLanguage(stored);
      }
    } catch {
      // 默认中文
    }
  }, [setLanguage]);

  const value = useMemo(() => ({ language, setLanguage }), [language, setLanguage]);
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  return useContext(LanguageContext);
}
