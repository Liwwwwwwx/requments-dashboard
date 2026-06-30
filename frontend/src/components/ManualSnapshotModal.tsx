'use client';

import { useEffect, useMemo, useState } from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import {
  Alert,
  DatePicker,
  Form,
  InputNumber,
  Input,
  Modal,
  Select
} from 'antd';
import type { AiUsageAccount } from '@/lib/types';

interface Props {
  open: boolean;
  accounts: AiUsageAccount[];
  saving: boolean;
  onCancel: () => void;
  onSubmit: (payload: Record<string, unknown>) => Promise<void> | void;
}

const TOKEN_PLAN_PROVIDERS = new Set(['kimi', 'minimax']);

function getDefaultUnit(account: AiUsageAccount | null | undefined): string {
  if (!account) return 'quota';
  if (account.accountType === 'balance') return account.quotaUnit || 'CNY';
  if (TOKEN_PLAN_PROVIDERS.has(account.provider)) return 'quota';
  return account.quotaUnit || 'token';
}

interface FormValues {
  accountId?: string;
  collectedAt?: Dayjs;
  balanceAmount?: number | null;
  quotaTotal?: number | null;
  quotaRemaining?: number | null;
  quotaUsed?: number | null;
  quotaUnit?: string;
  note?: string;
}

export function ManualSnapshotModal({ open, accounts, saving, onCancel, onSubmit }: Props) {
  const [form] = Form.useForm<FormValues>();
  const [accountId, setAccountId] = useState<string | null>(null);

  const selectedAccount = useMemo(
    () => accounts.find((a) => a.id === accountId) || null,
    [accounts, accountId]
  );

  const isBalance = selectedAccount?.accountType === 'balance';

  useEffect(() => {
    if (!open) {
      form.resetFields();
      setAccountId(null);
      return;
    }
    const initial = accounts.find((a) => a.enabled !== false) || accounts[0];
    const initialId: string | null = initial?.id || null;
    setAccountId(initialId);
    form.setFieldsValue({
      accountId: initialId ?? undefined,
      collectedAt: dayjs(),
      balanceAmount: null,
      quotaTotal: null,
      quotaRemaining: null,
      quotaUsed: null,
      quotaUnit: getDefaultUnit(initial),
      note: ''
    });
  }, [open, accounts, form]);

  useEffect(() => {
    if (!accountId) return;
    const unit = getDefaultUnit(selectedAccount);
    form.setFieldsValue({ quotaUnit: unit });
  }, [accountId, selectedAccount, form]);

  const handleAccountChange = (nextId: string) => {
    setAccountId(nextId);
    const next = accounts.find((a) => a.id === nextId) || null;
    form.setFieldsValue({
      accountId: nextId,
      quotaUnit: getDefaultUnit(next)
    });
  };

  const handleOk = async () => {
    try {
      const values = await form.validateFields();
      const collectedAt = values.collectedAt
        ? values.collectedAt.toDate().toISOString()
        : new Date().toISOString();
      const payload: Record<string, unknown> = {
        accountId: values.accountId,
        collectedAt,
        note: values.note || '',
        sourceType: 'manual',
        status: 'ok'
      };
      if (isBalance) {
        payload.balanceAmount = values.balanceAmount ?? null;
        payload.quotaUnit = values.quotaUnit || getDefaultUnit(selectedAccount);
      } else {
        payload.quotaTotal = values.quotaTotal ?? null;
        payload.quotaRemaining = values.quotaRemaining ?? null;
        payload.quotaUsed = values.quotaUsed ?? null;
        payload.quotaUnit = values.quotaUnit || getDefaultUnit(selectedAccount);
      }
      await onSubmit(payload);
    } catch {
      // antd validateFields shows validation errors automatically
    }
  };

  return (
    <Modal
      title="手动录入快照"
      open={open}
      onCancel={onCancel}
      onOk={handleOk}
      confirmLoading={saving}
      okText="保存"
      cancelText="取消"
      destroyOnClose
      width={520}
    >
      {!selectedAccount ? (
        <Alert type="warning" showIcon message="还没有可用的账号，请先添加账号。" />
      ) : (
        <Form<FormValues> form={form} layout="vertical" requiredMark="optional">
          <Form.Item
            name="accountId"
            label="账号"
            rules={[{ required: true, message: '请选择账号' }]}
          >
            <Select
              options={accounts
                .filter((a) => a.enabled !== false)
                .map((a) => ({ label: `${a.accountName}（${a.provider}）`, value: a.id }))}
              onChange={handleAccountChange}
              placeholder="选择账号"
            />
          </Form.Item>

          <Form.Item
            name="collectedAt"
            label="采集时间"
            rules={[{ required: true, message: '请选择采集时间' }]}
          >
            <DatePicker showTime style={{ width: '100%' }} format="YYYY-MM-DD HH:mm" />
          </Form.Item>

          {isBalance ? (
            <Form.Item
              name="balanceAmount"
              label={`余额（${selectedAccount.quotaUnit || 'CNY'}）`}
              rules={[{ required: true, message: '请输入余额' }]}
            >
              <InputNumber style={{ width: '100%' }} step={0.01} placeholder="例如 50.00" />
            </Form.Item>
          ) : (
            <>
              <Form.Item
                name="quotaRemaining"
                label="剩余次数"
                rules={[{ required: true, message: '请输入剩余次数' }]}
              >
                <InputNumber style={{ width: '100%' }} step={1} placeholder="例如 1200" />
              </Form.Item>
              <Form.Item name="quotaTotal" label="总额度（可选）">
                <InputNumber style={{ width: '100%' }} step={1} placeholder="例如 5000" />
              </Form.Item>
              <Form.Item name="quotaUsed" label="已用次数（可选）">
                <InputNumber style={{ width: '100%' }} step={1} placeholder="例如 3800" />
              </Form.Item>
            </>
          )}

          <Form.Item name="quotaUnit" label="单位" hidden={isBalance}>
            <Input placeholder="例如 quota / 次 / token" />
          </Form.Item>

          <Form.Item name="note" label="备注">
            <Input.TextArea rows={2} maxLength={200} placeholder="可选，写点上下文" />
          </Form.Item>
        </Form>
      )}
    </Modal>
  );
}