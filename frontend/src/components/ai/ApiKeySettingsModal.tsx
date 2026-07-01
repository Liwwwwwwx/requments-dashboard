'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Form, Input, Modal, Space, Typography, message as antdMessage } from 'antd';
import { DeleteOutlined, EyeInvisibleOutlined, EyeOutlined, KeyOutlined } from '@ant-design/icons';
import {
  getDeepSeekApiKey,
  getDeepSeekApiKeyMasked,
  isLikelyValidKey,
  setDeepSeekApiKey,
  clearDeepSeekApiKey
} from '@/lib/ai-key-store';

const { Text } = Typography;

interface Props {
  open: boolean;
  onClose: () => void;
}

/**
 * DeepSeek Key 配置对话框。
 *
 * 用户在浏览器本地输入 key，存 localStorage。
 * 关闭 / 打开：自动从 localStorage 恢复当前 mask。
 */
export function ApiKeySettingsModal({ open, onClose }: Props) {
  const [draft, setDraft] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [hasKey, setHasKey] = useState(false);

  // 打开时同步当前本地 key 状态
  useState(() => {
    if (typeof window !== 'undefined') {
      setHasKey(Boolean(getDeepSeekApiKey()));
    }
    return null;
  });

  // 每次 modal 打开时刷新（支持在打开期间外部修改）
  useEffect(() => {
    if (!open) return;
    setHasKey(Boolean(getDeepSeekApiKey()));
    setDraft('');
    setShowKey(false);
  }, [open]);

  const handleSave = () => {
    const trimmed = draft.trim();
    if (!isLikelyValidKey(trimmed)) {
      antdMessage.error('key 长度异常，请确认是否完整复制');
      return;
    }
    setDeepSeekApiKey(trimmed);
    setHasKey(true);
    setDraft('');
    antdMessage.success('已保存到本地浏览器（不上传到服务器）');
  };

  const handleClear = () => {
    Modal.confirm({
      title: '删除 DeepSeek Key？',
      content: '本地浏览器中存储的 key 会被清除，下次对话需重新输入。',
      okText: '删除',
      okType: 'danger',
      cancelText: '取消',
      onOk: () => {
        clearDeepSeekApiKey();
        setHasKey(false);
        setDraft('');
        antdMessage.success('已删除');
      }
    });
  };

  const masked = getDeepSeekApiKeyMasked();

  return (
    <Modal
      title={
        <Space>
          <KeyOutlined />
          <span>DeepSeek API Key</span>
        </Space>
      }
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      destroyOnClose
    >
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="key 仅保存在你当前浏览器的 localStorage，不上传服务器"
          description="每个用户的 key 相互隔离。需要新 key 时到 DeepSeek 控制台申请。"
        />

        {hasKey && (
          <Form layout="vertical">
            <Form.Item label="当前 Key">
              <Input
                value={showKey ? (getDeepSeekApiKey() || '') : masked}
                readOnly
                suffix={
                  <Button
                    type="text"
                    size="small"
                    icon={showKey ? <EyeInvisibleOutlined /> : <EyeOutlined />}
                    onClick={() => setShowKey((v) => !v)}
                  />
                }
              />
            </Form.Item>
            <Space>
              <Button danger icon={<DeleteOutlined />} onClick={handleClear}>
                删除本地 Key
              </Button>
              <Text type="secondary" style={{ fontSize: 12 }}>
                删除后下一次提问会先用「临时输入」对话框，或重新粘贴
              </Text>
            </Space>
          </Form>
        )}

        <Form layout="vertical">
          <Form.Item
            label={hasKey ? '替换为新 Key' : '粘贴 DeepSeek Key'}
            help="形如 sk-xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx"
          >
            <Input.Password
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="sk-..."
              autoFocus
            />
          </Form.Item>
          <Space>
            <Button type="primary" onClick={handleSave} disabled={!draft.trim()}>
              保存到本地
            </Button>
            <Button onClick={onClose}>关闭</Button>
          </Space>
        </Form>
      </Space>
    </Modal>
  );
}