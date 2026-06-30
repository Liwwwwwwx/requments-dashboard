'use client';

import { useEffect, useRef, useState } from 'react';

interface VersionInfo {
  version: string;
}

const isDev = process.env.NODE_ENV === 'development';

export function useAppUpdate(checkIntervalMs = 60000) {
  const [hasUpdate, setHasUpdate] = useState(false);
  const currentVersionRef = useRef<string | null>(null);

  useEffect(() => {
    // 开发环境跳过版本检测，避免干扰
    if (isDev) return;

    let cancelled = false;

    const check = async () => {
      try {
        const res = await fetch(`/version.json?v=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;

        const data: VersionInfo = await res.json();

        if (!currentVersionRef.current) {
          currentVersionRef.current = data.version;
        } else if (currentVersionRef.current !== data.version) {
          if (!cancelled) setHasUpdate(true);
        }
      } catch {
        // 静默失败，不影响用户
      }
    };

    check();
    const id = setInterval(check, checkIntervalMs);

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      cancelled = true;
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [checkIntervalMs]);

  const reload = () => {
    window.location.reload();
  };

  return { hasUpdate, reload };
}
