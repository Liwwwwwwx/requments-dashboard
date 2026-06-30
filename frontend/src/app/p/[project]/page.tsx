import { AppShell } from '@/components/AppShell';

interface Props {
  params: Promise<{ project: string }>;
}

export default async function ProjectPage({ params }: Props) {
  const { project } = await params;
  return <AppShell project={project} />;
}