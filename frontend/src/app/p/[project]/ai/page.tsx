'use client';

import { useParams, useSearchParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';

export default function AiPage() {
  const params = useParams<{ project: string }>();
  const searchParams = useSearchParams();
  const project = params?.project || 'default';
  const requirementId = searchParams.get('requirementId') || undefined;

  return (
    <AppShell
      project={project}
      assistantOpenOnLoad
      assistantRequirementId={requirementId}
    />
  );
}
