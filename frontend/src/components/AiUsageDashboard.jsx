import {
  Alert,
  Button,
  Empty,
  Tooltip,
  message,
  Spin,
  Tag
} from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  ReloadOutlined,
  WarningOutlined
} from '@ant-design/icons';
import { useAiUsage } from '../hooks/useAiUsage';
import { resolveDailyUsed } from './DailyUsageChart';

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

  const todayUsage = data.dailyUsage?.today || {};
  const todayUnit = {
    kimi: 'quota',
    minimax: 'quota',
    deepseek: 'CNY'
  };

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
            <div className="usage-quota-main">
              {showPrimaryUsage ? (
                <span className="usage-quota-headline">
                  <strong>{usage.primary}</strong>
                  <span className="usage-quota-label">
                    {item.accountType === 'balance' ? '余额' : '剩余额度'}
                  </span>
                </span>
              ) : (
                <span className="usage-quota-label">
                  {item.accountType === 'balance' ? '余额' : '剩余额度'}
                </span>
              )}
              {(() => {
                const daily = resolveDailyUsed(todayUsage, item.provider);
                if (daily === null) return null;
                return (
                  <span className="usage-quota-daily">
                    <span className="usage-quota-daily-label">今日消耗</span>
                    <b>{formatNumber(daily, todayUnit[item.provider])}</b>
                  </span>
                );
              })()}
            </div>
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
          <Tooltip title="刷新额度">
            <Button
              size="small"
              type="text"
              shape="circle"
              icon={<ReloadOutlined />}
              className="usage-inline-refresh"
              loading={syncLoading}
              disabled={syncingAccountId === 'all'}
              onClick={() => handleSyncOne(item)}
            />
          </Tooltip>
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
        {accounts.length === 0 ? (
          <Empty description="暂无账号" />
        ) : (
          <div className="usage-account-card-grid">
            {accounts.map(renderAccountCard)}
          </div>
        )}
      </Spin>
    </div>
  );
}
