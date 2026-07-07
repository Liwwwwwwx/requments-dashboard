'use client';

import { useState } from 'react';
import { useParams } from 'next/navigation';
import { AppShell } from '@/components/AppShell';
import { ProjectSettingsView } from '@/components/ProjectSettingsView';

export default function SettingsPage() {
  const params = useParams<{ project: string }>();
  const project = params?.project || 'default';
  const [projectListRefreshKey, setProjectListRefreshKey] = useState(0);
  return (
    <AppShell project={project} projectListRefreshKey={projectListRefreshKey}>
      <ProjectSettingsView
        project={project}
        onSaved={() => setProjectListRefreshKey((key) => key + 1)}
      />
    </AppShell>
  );
}
