import { AppShell } from '@/components/AppShell';

interface Props {
  params: Promise<{ project: string; reqId: string }>;
}

export default async function RequirementDetailPage({ params }: Props) {
  const { project, reqId } = await params;
  return <AppShell project={project} reqId={reqId} />;
}