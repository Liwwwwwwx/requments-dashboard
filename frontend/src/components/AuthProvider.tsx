'use client';

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { setAccessToken } from '@/lib/auth';

interface User {
  id: string;
  username: string;
  displayName?: string;
  role?: string;
}

interface AuthCtx {
  user: User | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, password: string, displayName?: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthCtx>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: async () => {}
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const res = await fetch('/api/auth/refresh', {
          method: 'POST',
          credentials: 'include'
        });
        if (res.ok) {
          const data = await res.json();
          if (data.ok) {
            setAccessToken(data.accessToken);
            // refresh 端点现在直接返回 user，无需额外请求 /auth/me
            if (active && data.user) setUser(data.user);
          }
        } else {
          setAccessToken(null);
        }
      } catch {
        setAccessToken(null);
      } finally {
        if (active) setLoading(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || data.code || '登录失败');
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const register = useCallback(async (username: string, password: string, displayName?: string) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ username, password, displayName })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.message || data.code || '注册失败');
    setAccessToken(data.accessToken);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    setAccessToken(null);
    setUser(null);
    router.push('/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function RouteGuard({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const pathname = usePathname();
  const router = useRouter();
  const isLoginPage = pathname === '/login';

  useEffect(() => {
    if (loading || user || isLoginPage) return;
    router.replace(`/login?redirect=${encodeURIComponent(window.location.pathname + window.location.search)}`);
  }, [isLoginPage, loading, pathname, router, user]);

  if (isLoginPage) return <>{children}</>;

  if (loading || !user) {
    return (
      <main className="auth-loading" aria-label="正在检查登录状态">
        <span>正在检查登录状态</span>
      </main>
    );
  }

  return <>{children}</>;
}
