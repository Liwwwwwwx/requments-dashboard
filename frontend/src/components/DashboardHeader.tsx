'use client';

import { useMemo } from 'react';
import { useRouter } from 'next/navigation';
import type { DashboardSummary } from '@/lib/types';

interface Props {
  summary: DashboardSummary | null;
  loading: boolean;
  currentProject: string;
}

export function DashboardHeader({ summary, loading, currentProject }: Props) {
  const router = useRouter();

  const stats = useMemo(() => {
    if (!summary) return null;
    return [
      { label: '总需求', value: summary.health.total, color: 'var(--text-primary)', dot: 'var(--text-tertiary)' },
      { label: '进行中', value: summary.byStatus.doing, color: 'var(--status-doing-text)', dot: 'var(--status-doing-dot)' },
      { label: '待开始', value: summary.byStatus.todo, color: 'var(--status-todo-text)', dot: 'var(--status-todo-dot)' },
      { label: '阻塞任务', value: summary.blockedCount, color: summary.blockedCount > 0 ? 'var(--status-blocked-text)' : 'var(--status-todo-text)', dot: summary.blockedCount > 0 ? 'var(--status-blocked-dot)' : 'var(--status-todo-dot)' },
    ];
  }, [summary]);

  if (loading && !summary) {
    return (
      <div className="dashboard-header dashboard-header--loading">
        <div className="dashboard-header__inner">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="dash-stat-card dash-stat-card--skeleton">
              <div className="dash-stat-skeleton" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!summary) return null;

  const circumference = 2 * Math.PI * 42;
  const offset = circumference - (summary.completionRate / 100) * circumference;

  return (
    <div className="dashboard-header">
      <div className="dashboard-header__inner">
        {stats?.map((stat) => (
          <div key={stat.label} className="dash-stat-card">
            <div className="dash-stat-card__top">
              <span className="dash-stat-dot" style={{ background: stat.dot }} />
              <span className="dash-stat-label">{stat.label}</span>
            </div>
            <div className="dash-stat-value" style={{ color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}

        <div className="dash-stat-card dash-ring-card">
          <div className="dash-ring-card__left">
            <div className="dash-stat-label" style={{ marginBottom: 4 }}>完成率</div>
            <div className="dash-stat-value" style={{ color: 'var(--accent)' }}>
              {summary.completionRate}%
            </div>
            <div className="dash-sub-label">
              {summary.byStatus.done} / {summary.health.total} 已完成
            </div>
          </div>
          <svg className="dash-ring" width="56" height="56" viewBox="0 0 56 56">
            <circle cx="28" cy="28" r="42" fill="none" stroke="var(--border-subtle)" strokeWidth="5" />
            <circle
              cx="28" cy="28" r="42"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 28 28)"
              style={{ transition: 'stroke-dashoffset 0.8s ease' }}
            />
          </svg>
        </div>
      </div>

      {summary.blockedItems.length > 0 && (
        <div
          className="dash-blocked-banner"
          onClick={() => {
            const first = summary.blockedItems[0];
            router.push(`/p/${currentProject}/r/${first.id}`);
          }}
          style={{ cursor: 'pointer' }}
        >
          <span className="dash-blocked-icon">!</span>
          <span className="dash-blocked-text">
            {summary.blockedItems.length} 个需求存在阻塞任务
          </span>
          <span className="dash-blocked-items">
            {summary.blockedItems.map((b) => b.id).join(' / ')}
          </span>
          <span className="dash-blocked-arrow">→</span>
        </div>
      )}
    </div>
  );
}
