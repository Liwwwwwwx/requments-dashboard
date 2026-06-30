'use client';

import { useState } from 'react';
import { Alert, Button, Empty, Tooltip, App, Spin } from 'antd';
import {
  CalendarOutlined,
  ClockCircleOutlined,
  ReloadOutlined
} from '@ant-design/icons';
import { useAiUsage } from '@/hooks/useAiUsage';
import {
  compactUsage,
  formatDate,
  formatNumber,
  formatRemainingTime,
  hostLabel,
  resolveDailyUsed,
  usageBands
} from './DailyUsageChart';
import { ManualSnapshotModal } from './ManualSnapshotModal';

const TODAY_UNIT: Record<string, string> = {
  kimi: 'quota',
  minimax: 'quota',
  deepseek: 'CNY'
};

export function AiUsageDashboard() {
  const { message } = App.useApp();
  const {
    data,
    loading,
    saving,
    syncingAccountId,
    error,
    syncAccount,
    syncAllAccounts,
    saveSnapshot
  } = useAiUsage();
  const [snapshotOpen, setSnapshotOpen] = useState(false);

  const accounts = data.accounts || [];
  const todayUsage = data.dailyUsage?.today || {};

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

  const handleSyncOne = async (account: (typeof accounts)[number]) => {
    await syncAccount(account.id);
    message.success(`${account.accountName} 已刷新`);
  };

  const handleSnapshotSubmit = async (payload: Record<string, unknown>) => {
    await saveSnapshot(payload);
    setSnapshotOpen(false);
    message.success('快照已保存');
  };

  const renderAccountCard = (item: (typeof accounts)[number]) => {
    const usage = compactUsage(item);
    const bands = usageBands(item);
    const showPrimaryUsage = bands.length === 0;
    const syncLoading = syncingAccountId === item.id || syncingAccountId === 'all';
    return (
      <article
        className={`usage-account-card risk-${item.risk} ${
          bands.length === 0 ? 'is-balance-card' : 'is-plan-card'
        }`}
        key={item.id}
      >
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
          <div
            className={`usage-account-card-quota-content ${
              bands.length === 0 ? 'balance-layout' : ''
            }`}
          >
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
                    <b>{formatNumber(daily, TODAY_UNIT[item.provider])}</b>
                  </span>
                );
              })()}
            </div>
            {usage.secondary ? <p>{usage.secondary}</p> : null}
            {bands.length > 0 ? (
              <div className="usage-band-list">
                {bands.map((band) => {
                  const tone =
                    typeof band.percent === 'number' && band.percent <= 40 ? 'warning' : 'ok';
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
                          style={{
                            width: `${
                              typeof band.percent === 'number'
                                ? Math.max(0, Math.min(band.percent, 100))
                                : 0
                            }%`
                          }}
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
          <Button onClick={() => setSnapshotOpen(true)} disabled={accounts.length === 0}>
            手动录入快照
          </Button>
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

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 16 }} />}

      <Spin spinning={loading}>
        {accounts.length === 0 ? (
          <Empty description="暂无账号" />
        ) : (
          <div className="usage-account-card-grid">{accounts.map(renderAccountCard)}</div>
        )}
      </Spin>

      <ManualSnapshotModal
        open={snapshotOpen}
        accounts={accounts}
        saving={saving}
        onCancel={() => setSnapshotOpen(false)}
        onSubmit={handleSnapshotSubmit}
      />
    </div>
  );
}