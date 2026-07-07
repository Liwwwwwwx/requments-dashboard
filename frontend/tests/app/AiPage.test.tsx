import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import AiPage from '@/app/p/[project]/ai/page';

const chatPanel = vi.fn();

vi.mock('next/navigation', () => ({
  useParams: () => ({ project: 'alpha' }),
  useSearchParams: () => new URLSearchParams('requirementId=REQ-0001')
}));

vi.mock('@/components/AppShell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>
}));

vi.mock('@/components/ai/ChatPanel', () => ({
  ChatPanel: (props: { project: string; requirementId?: string }) => {
    chatPanel(props);
    return <div>AI Panel</div>;
  }
}));

describe('AiPage', () => {
  it('passes requirementId from search params to ChatPanel', () => {
    render(<AiPage />);

    expect(screen.getByText('AI Panel')).toBeInTheDocument();
    expect(chatPanel).toHaveBeenCalledWith({
      project: 'alpha',
      requirementId: 'REQ-0001'
    });
  });
});
