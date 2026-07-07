import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import LoginPage from '@/app/login/page';

const authState = vi.hoisted(() => ({
  user: null as null | { id: string; username: string },
  login: vi.fn()
}));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams()
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
    authState.login.mockReset();
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
});
