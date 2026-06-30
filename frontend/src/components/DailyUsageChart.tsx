import type { AiUsageAccount } from '@/lib/types';

const PROVIDER_KEY: Record<string, string> = {
  kimi: 'kimiWeeklyUsed',
  minimax: 'minimaxWeeklyUsed',
  deepseek: 'deepseekCost'
};

export function resolveDailyUsed(
  today: Record<string, number> | undefined,
  provider: string
): number | null {
  if (!today || !provider) return null;
  const key = PROVIDER_KEY[provider];
  if (!key) return null;
  const value = Number(today[key]);
  return Number.isFinite(value) ? value : null;
}

export function formatNumber(value: unknown, unit?: string): string {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  const formatted = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: unit === 'token' ? 0 : 2
  }).format(num);
  return unit ? `${formatted} ${unit}` : formatted;
}

export function formatDate(value: string | undefined | null): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  }).format(date);
}

export function hostLabel(baseUrl?: string): string {
  if (!baseUrl) return '-';
  try {
    const url = new URL(baseUrl);
    return `${url.host}${url.pathname.replace(/\/$/, '')}`;
  } catch {
    return baseUrl;
  }
}

export function formatRemainingTime(value: string | undefined | null): string | null {
  if (!value) return null;
  const target = new Date(value);
  if (Number.isNaN(target.getTime())) return null;
  const diff = target.getTime() - Date.now();
  if (diff <= 0) return '即将';

  const totalMinutes = Math.floor(diff / (1000 * 60));
  const days = Math.floor(totalMinutes / (60 * 24));
  const hours = Math.floor((totalMinutes % (60 * 24)) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days}天${hours > 0 ? `${hours}小时` : ''}`;
  if (hours > 0) return `${hours}小时${minutes > 0 ? `${minutes}分` : ''}`;
  return `${Math.max(minutes, 1)}分`;
}

export function compactUsage(item: AiUsageAccount): { primary: string; secondary: string } {
  if (item.provider === 'kimi' || item.provider === 'minimax') {
    const remaining = item.usage?.quotaRemaining;
    if (remaining !== null && remaining !== undefined) {
      return {
        primary: formatNumber(remaining, item.quotaUnit),
        secondary: ''
      };
    }
  }

  const unit = item.quotaUnit;
  if (item.accountType === 'balance') {
    return {
      primary: formatNumber(item.latestSnapshot?.balanceAmount, unit),
      secondary: ''
    };
  }
  const remaining = item.usage?.quotaRemaining;
  const percent = item.usage?.remainingPercent;
  return {
    primary:
      remaining === null || remaining === undefined
        ? '-'
        : `${formatNumber(remaining, unit)}${typeof percent === 'number' ? ` · ${percent}%` : ''}`,
    secondary: ''
  };
}

export interface UsageBand {
  key: string;
  label: string;
  percent: number | null;
  resetAt: string | null;
}

export function usageBands(item: AiUsageAccount): UsageBand[] {
  if (item.provider === 'kimi') {
    const metrics = item.latestSnapshot?.metrics?.kimi;
    return [
      {
        key: 'interval',
        label: '5h',
        percent: metrics?.interval?.remainingPercent ?? null,
        resetAt: metrics?.interval?.resetTime || null
      },
      {
        key: 'weekly',
        label: 'Weekly',
        percent: metrics?.period?.remainingPercent ?? null,
        resetAt: metrics?.period?.resetTime || null
      }
    ].filter((it) => it.percent !== null || it.resetAt);
  }

  if (item.provider === 'minimax') {
    const metrics = item.latestSnapshot?.metrics?.minimax;
    return [
      {
        key: 'interval',
        label: '5h',
        percent: metrics?.interval?.remainingPercent ?? null,
        resetAt: metrics?.interval?.endTime || null
      },
      {
        key: 'weekly',
        label: 'Weekly',
        percent: metrics?.weekly?.remainingPercent ?? null,
        resetAt: metrics?.weekly?.endTime || null
      }
    ].filter((it) => it.percent !== null || it.resetAt);
  }

  return [];
}