'use client';

import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ChatPanel } from '@/components/ai/ChatPanel';

export default function AiPage() {
  const params = useParams<{ project: string }>();
  const project = params?.project || 'default';
  return (
    <AppShell project={project}>
      <ChatPanel project={project} />
    </AppShell>
  );
}
