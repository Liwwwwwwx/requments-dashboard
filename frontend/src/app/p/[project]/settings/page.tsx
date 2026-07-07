'use client';

import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ProjectSettingsView } from '@/components/ProjectSettingsView';

export default function SettingsPage() {
  const params = useParams<{ project: string }>();
  const project = params?.project || 'default';
  return (
    <AppShell project={project}>
      <ProjectSettingsView project={project} />
    </AppShell>
  );
}
