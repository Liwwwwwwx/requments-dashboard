import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginPage from '@/app/login/page';

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; username: string },
  login: vi.fn(),
  redirect: '',
  replace: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: authState.replace
  }),
  useSearchParams: () => new URLSearchParams(authState.redirect)
}));

vi.mock('@/components/AuthProvider', () => ({
  useAuth: () => ({
    user: authState.user,
    login: authState.login
  })
}));

describe('LoginPage', () => {
  beforeEach(() => {
    authState.user = null;
    authState.redirect = '';
    authState.login.mockReset();
    authState.replace.mockReset();
  });

  it('渲染简洁登录表单且不展示默认账号', () => {
    render(<LoginPage />);

    expect(screen.getByText('TraceBoard')).toBeInTheDocument();
    expect(screen.getByLabelText('用户名')).toBeInTheDocument();
    expect(screen.getByLabelText('密码')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /登\s*录/ })).toBeDisabled();
    expect(screen.queryByText(/默认账号|admin123/)).not.toBeInTheDocument();
  });

  it('提交用户名和密码调用登录', async () => {
    authState.login.mockResolvedValue(undefined);
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('用户名'), {
      target: { value: 'admin' }
    });
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'secret' }
    });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    await waitFor(() => {
      expect(authState.login).toHaveBeenCalledWith('admin', 'secret');
    });
  });

  it('登录失败时展示错误提示', async () => {
    authState.login.mockRejectedValue(new Error('INVALID_CREDENTIALS'));
    render(<LoginPage />);

    fireEvent.change(screen.getByLabelText('用户名'), {
      target: { value: 'admin' }
    });
    fireEvent.change(screen.getByLabelText('密码'), {
      target: { value: 'wrong' }
    });
    fireEvent.click(screen.getByRole('button', { name: /登\s*录/ }));

    expect(await screen.findByText('INVALID_CREDENTIALS')).toBeInTheDocument();
  });

  it('已登录时跳转到站内 redirect', async () => {
    authState.user = { id: 'u1', username: 'admin' };
    authState.redirect = 'redirect=/p/alpha/r/REQ-0001%3Ftab%3Dhistory';

    render(<LoginPage />);

    await waitFor(() => {
      expect(authState.replace).toHaveBeenCalledWith('/p/alpha/r/REQ-0001?tab=history');
    });
  });

  it('已登录时拒绝外部 redirect', async () => {
    authState.user = { id: 'u1', username: 'admin' };
    authState.redirect = 'redirect=https%3A%2F%2Fexample.com';

    render(<LoginPage />);

    await waitFor(() => {
      expect(authState.replace).toHaveBeenCalledWith('/p/default');
    });
  });
});
