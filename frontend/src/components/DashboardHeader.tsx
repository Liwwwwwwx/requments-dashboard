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
      { label: '总需求', value: summary.health.total, color: 'var(--text-primary)', dot: 'var(--text-tertiary)', hint: '所有需求总数' },
      { label: '进行中', value: summary.byStatus.doing, color: 'var(--status-doing-text)', dot: 'var(--status-doing-dot)', hint: '当前推进中' },
      { label: '待开始', value: summary.byStatus.todo, color: 'var(--status-todo-text)', dot: 'var(--status-todo-dot)', hint: '尚未启动' },
      { label: '已阻塞', value: summary.blockedItems.length, color: summary.blockedItems.length > 0 ? 'var(--status-blocked-text)' : 'var(--text-tertiary)', dot: summary.blockedItems.length > 0 ? 'var(--status-blocked-dot)' : 'var(--text-tertiary)', hint: '存在阻塞任务' },
    ];
  }, [summary]);

  if (loading && !summary) {
    return (
      <div className="dashboard-header">
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

  if (!summary || summary.health.total === 0) {
    return summary ? (
      <div className="dashboard-header">
        <div className="dashboard-header__inner">
          <div className="dash-stat-card dash-welcome">
            <div className="dash-welcome-icon">🚀</div>
            <div className="dash-welcome-text">
              <strong>欢迎来到 TraceBoard</strong>
              <span>你还没有任何需求，点击「新建需求」开始吧</span>
            </div>
          </div>
        </div>
      </div>
    ) : null;
  }

  const circumference = 2 * Math.PI * 38;
  const offset = circumference - (summary.completionRate / 100) * circumference;

  return (
    <div className="dashboard-header">
      <div className="dashboard-header__inner">
        {stats?.map((stat) => (
          <div key={stat.label} className="dash-stat-card" title={stat.hint}>
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
            <div className="dash-stat-label" style={{ marginBottom: 2 }}>完成率</div>
            <div className="dash-stat-value" style={{ color: 'var(--accent)', fontSize: 22 }}>
              {summary.completionRate}%
            </div>
            <div className="dash-sub-label">
              {summary.byStatus.done} / {summary.health.total}
            </div>
          </div>
          <svg className="dash-ring" width="52" height="52" viewBox="0 0 52 52">
            <circle cx="26" cy="26" r="38" fill="none" stroke="var(--border-subtle)" strokeWidth="4" />
            <circle
              cx="26" cy="26" r="38"
              fill="none"
              stroke="var(--accent)"
              strokeWidth="4"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              transform="rotate(-90 26 26)"
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
            {summary.blockedItems.length} 个需求存在阻塞任务，需关注
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
