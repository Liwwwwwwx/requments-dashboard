import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { Sidebar } from '@/components/Sidebar';

vi.mock('next/navigation', () => ({
  useParams: () => ({ project: 'alpha' }),
  usePathname: () => '/p/alpha',
  useRouter: () => ({
    push: vi.fn()
  })
}));

describe('Sidebar', () => {
  it('uses product capability navigation instead of a project list', () => {
    render(
      <Sidebar
        selectedItem={null}
      />
    );

    expect(screen.getByText('工作台')).toBeInTheDocument();
    expect(screen.getByText('业务模块')).toBeInTheDocument();
    expect(screen.getByText('需求看板')).toBeInTheDocument();
    expect(screen.getByText('项目管理')).toBeInTheDocument();
    expect(screen.queryByText('AI 小助手')).not.toBeInTheDocument();
  });
});
