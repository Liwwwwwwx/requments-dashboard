import { AppShell } from '@/components/AppShell';
import { AiUsageDashboard } from '@/components/AiUsageDashboard';

export default function AiUsagePage() {
  return (
    <AppShell workspace="ai-usage">
      <AiUsageDashboard />
    </AppShell>
  );
}