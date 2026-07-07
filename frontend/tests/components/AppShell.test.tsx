import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { AppShell } from '@/components/AppShell';
import { useRequirements } from '@/hooks/useRequirements';

vi.mock('next/navigation', () => ({
  useParams: () => ({ project: 'default' }),
  usePathname: () => '/p/default',
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn()
  })
}));

vi.mock('@/hooks/useRequirements', () => ({
  useRequirements: vi.fn()
}));

vi.mock('@/lib/api', () => ({
  createProject: vi.fn()
}));

describe('AppShell', () => {
  it('首次无项目时展示创建项目空状态', () => {
    vi.mocked(useRequirements).mockReturnValue({
      project: 'default',
      projects: [],
      data: { updatedAt: '', statuses: [], items: [] },
      loading: false,
      error: null,
      refresh: vi.fn(),
      loadState: vi.fn(),
      loadProjects: vi.fn()
    });

    render(<AppShell project="default" />);

    expect(screen.getByRole('heading', { name: '还没有项目' })).toBeInTheDocument();
    expect(screen.getByText(/需求看板、需求详情和 AI 小助手/)).toBeInTheDocument();

    const emptyState = screen.getByText('还没有项目').closest('.first-project-empty');
    expect(emptyState).toBeTruthy();
    fireEvent.click(within(emptyState as HTMLElement).getByRole('button', { name: '创建项目' }));

    expect(screen.getByRole('dialog', { name: '创建项目' })).toBeInTheDocument();
    expect(screen.getByLabelText('项目名称')).toBeInTheDocument();
  });
});
