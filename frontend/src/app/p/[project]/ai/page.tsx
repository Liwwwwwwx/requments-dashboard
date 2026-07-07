'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ChatPanel } from '@/components/ai/ChatPanel';

export default function AiPage() {
  const params = useParams<{ project: string }>();
  const searchParams = useSearchParams();
  const project = params?.project || 'default';
  const requirementId = searchParams.get('requirementId') || undefined;

  return (
    <AppShell project={project}>
      <ChatPanel project={project} requirementId={requirementId} />
    </AppShell>
  );
}
