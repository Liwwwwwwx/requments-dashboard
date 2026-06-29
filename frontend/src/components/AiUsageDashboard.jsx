import { useMemo } from 'react';
import {
  Alert,
  Button,
  Empty,
  message,
  Spin,
  Tag
} from 'antd';
import {
  ApiOutlined,
  CalendarOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useAiUsage } from '../hooks/useAiUsage';

const PROVIDER_META = {
  kimi: { label: 'Kimi', tone: 'purple' },
  minimax: { label: 'MiniMax', tone: 'cyan' },
  deepseek: { label: 'DeepSeek', tone: 'green' }
};

function formatNumber(value, unit) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  const formatted = new Intl.NumberFormat('zh-CN', {
    maximumFractionDigits: unit === 'token' ? 0 : 2
  }).format(num);
  return unit ? `${formatted} ${unit}` : formatted;
}

function formatDate(value) {
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

function hostLabel(baseUrl) {
  if (!baseUrl) return '-';
  try {
    const url = new URL(baseUrl);
    return `${url.host}${url.pathname.replace(/\/$/, '')}`;
  } catch (_err) {
    return baseUrl;
  }
}

function formatRemainingTime(value) {
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

function compactUsage(item) {
  if (item.provider === 'kimi') {
    const remaining = item.usage?.quotaRemaining;
    if (remaining !== null && remaining !== undefined) {
      return {
        primary: formatNumber(remaining, item.quotaUnit),
        secondary: ''
      };
    }
  }

  if (item.provider === 'minimax') {
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
    primary: remaining === null || remaining === undefined
      ? '-'
      : `${formatNumber(remaining, unit)}${typeof percent === 'number' ? ` · ${percent}%` : ''}`,
    secondary: ''
  };
}

function usageBands(item) {
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
    ].filter((item) => item.percent !== null || item.resetAt);
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
    ].filter((item) => item.percent !== null || item.resetAt);
  }

  return [];
}

export function AiUsageDashboard() {
  const {
    data,
    loading,
    syncingAccountId,
    error,
    syncAccount,
    syncAllAccounts
  } = useAiUsage();

  const accounts = data.accounts || [];
  const summary = data.summary || {};

  const providerGroups = useMemo(() => {
    return accounts.reduce((acc, account) => {
      const provider = account.provider || 'unknown';
      if (!acc[provider]) {
        acc[provider] = { provider, total: 0, warning: 0, stale: 0 };
      }
      acc[provider].total += 1;
      if (account.risk === 'warning') acc[provider].warning += 1;
      if (account.risk === 'stale') acc[provider].stale += 1;
      return acc;
    }, {});
  }, [accounts]);

  const handleSyncAll = async () => {
    if (accounts.length === 0) return;
    const results = await syncAllAccounts(accounts.map((account) => account.id));
    const failed = results.filter((item) => !item.ok);
    if (failed.length > 0) {
      message.warning(`已刷新 ${results.length - failed.length} 个，失败 ${failed.length} 个`);
    } else {
      message.success(`已刷新 ${results.length} 个账号`);
    }
  };

  const handleSyncOne = async (account) => {
    await syncAccount(account.id);
    message.success(`${account.accountName} 已刷新`);
  };

  const renderAccountCard = (item) => {
    const usage = compactUsage(item);
    const bands = usageBands(item);
    const showPrimaryUsage = bands.length === 0;
    const syncLoading = syncingAccountId === item.id || syncingAccountId === 'all';
    return (
      <article className={`usage-account-card risk-${item.risk} ${bands.length === 0 ? 'is-balance-card' : 'is-plan-card'}`} key={item.id}>
        <div className="usage-account-card-head">
          <div className="usage-account-name">
            <span className="usage-status-dot" />
            <strong>{item.accountName}</strong>
          </div>
        </div>

        <div className="usage-account-card-tags">
          <span className={item.enabled === false ? 'usage-pill muted' : 'usage-pill ok'}>
            {item.enabled === false ? '未启用' : '已启用'}
          </span>
          <span className={item.hasApiKey ? 'usage-pill locked' : 'usage-pill warning'}>
            {item.hasApiKey ? 'Key 已配置' : '缺少 Key'}
          </span>
          {item.latestSnapshot?.collectedAt && (
            <span className="usage-pill plain">{formatDate(item.latestSnapshot.collectedAt)}</span>
          )}
        </div>

        <div className="usage-account-card-quota">
          <div className={`usage-account-card-quota-content ${bands.length === 0 ? 'balance-layout' : ''}`}>
            <span className="usage-quota-label">
              {item.accountType === 'balance' ? '余额' : '剩余额度'}
            </span>
            {showPrimaryUsage ? <strong>{usage.primary}</strong> : null}
            {usage.secondary ? <p>{usage.secondary}</p> : null}
            {bands.length > 0 ? (
              <div className="usage-band-list">
                {bands.map((band) => {
                  const tone = typeof band.percent === 'number' && band.percent <= 40 ? 'warning' : 'ok';
                  const remainingTime = formatRemainingTime(band.resetAt);
                  return (
                    <div className="usage-band" key={band.key}>
                      <div className="usage-band-head">
                        <div className="usage-band-label">
                          {band.key === 'interval' ? <ClockCircleOutlined /> : <CalendarOutlined />}
                          <span>{band.label}</span>
                        </div>
                        <strong className={`usage-band-percent ${tone}`}>
                          {typeof band.percent === 'number' ? `${band.percent}%` : '-'}
                        </strong>
                      </div>
                      <div className="usage-band-track">
                        <div
                          className={`usage-band-fill ${tone}`}
                          style={{ width: `${typeof band.percent === 'number' ? Math.max(0, Math.min(band.percent, 100)) : 0}%` }}
                        />
                      </div>
                      <div className="usage-band-reset">
                        {band.resetAt
                          ? `还剩 ${remainingTime || '-'} 重置 · ${formatDate(band.resetAt)}`
                          : '重置时间未知'}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>

        <div className="usage-account-card-foot">
          <div className="usage-account-meta-inline">
            <span className="usage-account-meta-label">Base URL</span>
            <span className="usage-account-meta-value">{hostLabel(item.baseUrl)}</span>
          </div>
          <Button
            size="small"
            icon={<ReloadOutlined />}
            className="usage-inline-refresh"
            loading={syncLoading}
            disabled={syncingAccountId === 'all'}
            onClick={() => handleSyncOne(item)}
          >
            刷新
          </Button>
        </div>
      </article>
    );
  };

  return (
    <div className="usage-view">
      <header className="usage-head">
        <div>
          <div className="view-detail-eyebrow">
            <span>AI Usage</span>
            <span>·</span>
            <span>账号套餐看板</span>
          </div>
          <h1 className="usage-title">AI 账号用量</h1>
          <div className="view-list-meta">
            <span>统一记录 Kimi、MiniMax、DeepSeek 的余额与套餐额度</span>
          </div>
        </div>
        <div className="usage-actions">
          <Button
            icon={<ReloadOutlined />}
            type="primary"
            disabled={accounts.length === 0 || Boolean(syncingAccountId)}
            loading={syncingAccountId === 'all'}
            onClick={handleSyncAll}
          >
            全部刷新额度
          </Button>
        </div>
      </header>

      {error && (
        <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />
      )}

      <Spin spinning={loading}>
        <section className="usage-summary-grid">
          <div className="usage-summary-item">
            <span className="usage-summary-label">账号数</span>
            <strong>{summary.totalAccounts || 0}</strong>
          </div>
          <div className="usage-summary-item">
            <span className="usage-summary-label">风险账号</span>
            <strong>{summary.warningAccounts || 0}</strong>
          </div>
          <div className="usage-summary-item">
            <span className="usage-summary-label">待刷新</span>
            <strong>{summary.staleAccounts || 0}</strong>
          </div>
          <div className="usage-summary-item">
            <span className="usage-summary-label">最近采集</span>
            <strong>{formatDate(summary.lastCollectedAt)}</strong>
          </div>
        </section>

        <section className="usage-provider-grid">
          {Object.values(providerGroups).map((group) => {
            const meta = PROVIDER_META[group.provider] || {};
            return (
              <div className="usage-provider-card" key={group.provider}>
                <div className="usage-provider-icon">
                  <ApiOutlined />
                </div>
                <div>
                  <div className="usage-provider-title">
                    {meta.label || group.provider}
                    <Tag color={meta.tone || 'default'}>{group.total}</Tag>
                  </div>
                  <div className="usage-provider-meta">
                    风险 {group.warning} · 待刷新 {group.stale}
                  </div>
                </div>
              </div>
            );
          })}
        </section>

        <section className="usage-section">
          <div className="usage-section-head">
            <div>
              <h2>账号状态</h2>
              <p>账号配置保存 Base URL、模型和 Key；状态接口只返回脱敏 Key，不回显明文。</p>
            </div>
            {summary.warningAccounts > 0 && (
              <Tag icon={<WarningOutlined />} color="error">
                有账号接近阈值
              </Tag>
            )}
          </div>
          {accounts.length === 0 ? (
            <Empty description="暂无账号" />
          ) : (
            <div className="usage-account-card-grid">
              {accounts.map(renderAccountCard)}
            </div>
          )}
        </section>

      </Spin>
    </div>
  );
}
