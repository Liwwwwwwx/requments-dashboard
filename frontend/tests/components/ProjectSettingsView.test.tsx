import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ProjectSettingsView } from '@/components/ProjectSettingsView';
import { fetchProject, updateProject } from '@/lib/api';

vi.mock('@/lib/api', () => ({
  fetchProject: vi.fn(),
  updateProject: vi.fn()
}));

describe('ProjectSettingsView', () => {
  beforeEach(() => {
    vi.mocked(fetchProject).mockReset();
    vi.mocked(updateProject).mockReset();
  });

  it('loads project metadata and saves edits', async () => {
    const onSaved = vi.fn();
    vi.mocked(fetchProject).mockResolvedValueOnce({
      ok: true,
      project: {
        id: 'alpha',
        name: 'Alpha 项目',
        description: '第一阶段需求',
        createdAt: '2026-07-07T00:00:00.000Z',
        updatedAt: '2026-07-07T00:00:00.000Z'
      }
    });
    vi.mocked(updateProject).mockResolvedValueOnce({
      ok: true,
      project: {
        id: 'alpha',
        name: 'Alpha 新名称',
        description: '更新后的说明',
        createdAt: '2026-07-07T00:00:00.000Z',
        updatedAt: '2026-07-07T01:00:00.000Z'
      }
    });

    render(<ProjectSettingsView project="alpha" onSaved={onSaved} />);

    expect(await screen.findByDisplayValue('Alpha 项目')).toBeInTheDocument();
    expect(screen.getByDisplayValue('第一阶段需求')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('项目名称'), {
      target: { value: 'Alpha 新名称' }
    });
    fireEvent.change(screen.getByLabelText('项目描述'), {
      target: { value: '更新后的说明' }
    });
    fireEvent.click(screen.getByRole('button', { name: /保\s*存/ }));

    await waitFor(() => {
      expect(updateProject).toHaveBeenCalledWith('alpha', {
        name: 'Alpha 新名称',
        description: '更新后的说明'
      });
    });
    expect(screen.getByText('已保存')).toBeInTheDocument();
    expect(screen.getByDisplayValue('Alpha 新名称')).toBeInTheDocument();
    expect(onSaved).toHaveBeenCalledWith({
      id: 'alpha',
      name: 'Alpha 新名称',
      description: '更新后的说明',
      createdAt: '2026-07-07T00:00:00.000Z',
      updatedAt: '2026-07-07T01:00:00.000Z'
    });
  });
});
