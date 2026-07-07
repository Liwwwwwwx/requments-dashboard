import { fireEvent, render, screen, waitFor } from '@testing-library/react';
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
  it('creates a project from the project section', async () => {
    const onProjectCreate = vi.fn().mockResolvedValue(undefined);

    render(
      <Sidebar
        projects={[{ id: 'alpha', name: 'alpha' }]}
        selectedItem={null}
        onProjectCreate={onProjectCreate}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: '创建项目' }));
    fireEvent.change(screen.getByLabelText('项目 ID'), {
      target: { value: 'beta' }
    });
    const createButtons = screen.getAllByRole('button', { name: /创\s*建/ });
    fireEvent.click(createButtons[createButtons.length - 1]);

    await waitFor(() => expect(onProjectCreate).toHaveBeenCalledWith('beta'));
  });
});
