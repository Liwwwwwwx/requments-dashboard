import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AiPage from '@/app/p/[project]/ai/page';

const appShell = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ project: 'alpha' }),
  useSearchParams: () => new URLSearchParams('requirementId=REQ-0001')
}));

vi.mock('@/components/AppShell', () => ({
  AppShell: (props: { project: string; assistantOpenOnLoad?: boolean; assistantRequirementId?: string }) => {
    appShell(props);
    return <div>Workspace</div>;
  }
}));

describe('AiPage', () => {
  it('opens the floating assistant with requirement context from search params', () => {
    render(<AiPage />);

    expect(screen.getByText('Workspace')).toBeInTheDocument();
    expect(appShell).toHaveBeenCalledWith({
      project: 'alpha',
      assistantOpenOnLoad: true,
      assistantRequirementId: 'REQ-0001'
    });
  });
});
