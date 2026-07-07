'use client';

import { useMemo, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, message } from 'antd';
import { useRouter } from 'next/navigation';
import { createRequirement } from '@/lib/api';
import type { BoardState, Filters, Priority } from '@/lib/types';
import { BOARD_VIEWS } from '@/lib/nav';
import { BoardColumns } from './board/BoardColumns';
import { ListView } from './board/ListView';
import { TimelineView } from './board/TimelineView';

interface Props {
  data: BoardState;
  project: string;
  filters: Filters;
  selectedId: string | null;
  loading?: boolean;
  onCreated?: () => Promise<void> | void;
}

interface CreateRequirementForm {
  title: string;
  description?: string;
  priority: Priority;
  owner?: string;
}

export function RequirementGrid({ data, project, filters, selectedId, loading, onCreated }: Props) {
  const router = useRouter();
  const [activeView, setActiveView] = useState('board');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<CreateRequirementForm>();

  const query = filters.query.toLowerCase();
  const items = useMemo(() => {
    return data.items.filter((item) => {
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (query && !item.title.toLowerCase().includes(query) && !item.id.toLowerCase().includes(query))
        return false;
      return true;
    });
  }, [data.items, filters.status, query]);

  const isInitialLoading = !!loading && data.items.length === 0;
  const open = (id: string) => router.push(`/p/${project}/r/${id}`);

  const handleCreate = async () => {
    const values = await form.validateFields();
    setCreating(true);
    try {
      const res = await createRequirement(project, values);
      message.success('需求已创建');
      form.resetFields();
      setCreateOpen(false);
      await onCreated?.();
      if (res.requirement?.id) {
        router.push(`/p/${project}/r/${res.requirement.id}`);
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建需求失败');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="board-wrap">
      <div className="board-toolbar">
        <div className="viewtabs" role="tablist" aria-label="视图切换">
          {BOARD_VIEWS.map((view) => {
            const Icon = view.icon;
            const active = activeView === view.key;
            const soon = view.status === 'soon';
            return (
              <button
                key={view.key}
                type="button"
                role="tab"
                aria-selected={active}
                disabled={soon}
                className={`viewtab ${active ? 'is-active' : ''} ${soon ? 'is-soon' : ''}`}
                onClick={() => !soon && setActiveView(view.key)}
                title={soon ? `${view.label}视图（即将上线）` : `${view.label}视图`}
              >
                <Icon className="viewtab-icon" />
                <span>{view.label}</span>
                {soon && <span className="viewtab-soon">Soon</span>}
              </button>
            );
          })}
        </div>
        <div className="board-toolbar-actions">
          {activeView !== 'timeline' && (
            <div className="board-count">
              共 <strong>{items.length}</strong> 条需求
            </div>
          )}
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建需求
          </Button>
        </div>
      </div>

      {activeView === 'board' && (
        <BoardColumns
          items={items}
          selectedId={selectedId}
          isInitialLoading={isInitialLoading}
          onOpen={open}
        />
      )}
      {activeView === 'list' && (
        <ListView
          items={items}
          selectedId={selectedId}
          isInitialLoading={isInitialLoading}
          onOpen={open}
        />
      )}
      {activeView === 'timeline' && (
        <TimelineView project={project} requirements={data.items} onOpen={open} />
      )}

      <Modal
        title="新建需求"
        open={createOpen}
        onOk={() => void handleCreate()}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        destroyOnClose
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ priority: 'P1' }}
          preserve={false}
        >
          <Form.Item
            label="标题"
            name="title"
            rules={[{ required: true, message: '请输入需求标题' }]}
          >
            <Input placeholder="例如：登录页支持手机号登录" />
          </Form.Item>
          <Form.Item label="描述" name="description">
            <Input.TextArea rows={4} placeholder="补充背景、目标或范围" />
          </Form.Item>
          <Form.Item label="优先级" name="priority">
            <Select
              options={[
                { value: 'P0', label: 'P0' },
                { value: 'P1', label: 'P1' },
                { value: 'P2', label: 'P2' }
              ]}
            />
          </Form.Item>
          <Form.Item label="负责人" name="owner">
            <Input placeholder="例如：pm / frontend / backend" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
}
