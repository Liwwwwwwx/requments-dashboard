import { render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { AuthProvider, RouteGuard } from '@/components/AuthProvider';
import { setAccessToken } from '@/lib/auth';

const navState = vi.hoisted(() => ({
  pathname: '/p/default',
  replace: vi.fn()
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navState.pathname,
  useRouter: () => ({
    replace: navState.replace,
    push: vi.fn()
  })
}));

function jsonResponse(body: unknown, init: ResponseInit = {}) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
    ...init
  });
}

describe('AuthProvider + RouteGuard', () => {
  beforeEach(() => {
    navState.pathname = '/p/default';
    navState.replace.mockReset();
    setAccessToken(null);
    vi.restoreAllMocks();
    window.history.pushState({}, '', '/p/default');
  });

  it('通过 refresh 恢复用户后展示受保护页面', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({
        ok: true,
        accessToken: 'access-1',
        user: { id: 'u1', username: 'admin', displayName: '管理员' }
      })
    );

    render(
      <AuthProvider>
        <RouteGuard>
          <div>Protected Board</div>
        </RouteGuard>
      </AuthProvider>
    );

    expect(screen.getByLabelText('正在检查登录状态')).toBeInTheDocument();
    expect(await screen.findByText('Protected Board')).toBeInTheDocument();
    expect(navState.replace).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledOnce();
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/auth/refresh',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include'
      })
    );
  });

  it('refresh 失败后带当前地址跳转登录页', async () => {
    navState.pathname = '/p/default/r/REQ-0001';
    window.history.pushState({}, '', '/p/default/r/REQ-0001?tab=history');
    vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
      jsonResponse({ ok: false, error: 'NO_REFRESH_TOKEN' }, { status: 401 })
    );

    render(
      <AuthProvider>
        <RouteGuard>
          <div>Protected Detail</div>
        </RouteGuard>
      </AuthProvider>
    );

    await waitFor(() => {
      expect(navState.replace).toHaveBeenCalledWith(
        `/login?redirect=${encodeURIComponent('/p/default/r/REQ-0001?tab=history')}`
      );
    });
    expect(screen.queryByText('Protected Detail')).not.toBeInTheDocument();
  });
});
