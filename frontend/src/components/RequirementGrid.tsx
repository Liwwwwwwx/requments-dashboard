'use client';

import { useMemo, useState } from 'react';
import { PlusOutlined } from '@ant-design/icons';
import { Button, Form, Input, Modal, Select, message } from 'antd';
import { useRouter } from 'next/navigation';
import { createRequirement } from '@/lib/api';
import { statusLabel, unique } from '@/lib/utils';
import type { BoardState, Filters, Priority, RequirementStatus } from '@/lib/types';
import { BOARD_VIEWS } from '@/lib/nav';
import { BoardColumns } from './board/BoardColumns';
import { ListView } from './board/ListView';

interface Props {
  data: BoardState;
  project: string;
  filters: Filters;
  onFiltersChange?: (filters: Filters) => void;
  selectedId: string | null;
  loading?: boolean;
  onCreated?: () => Promise<void> | void;
}

interface CreateRequirementForm {
  title: string;
  description?: string;
  next?: string;
  status: RequirementStatus;
  priority: Priority;
  owner?: string;
}

const STATUS_OPTIONS: { value: 'all' | RequirementStatus; label: string }[] = [
  { value: 'all', label: '全部状态' },
  { value: 'todo', label: statusLabel('todo').label },
  { value: 'doing', label: statusLabel('doing').label },
  { value: 'blocked', label: statusLabel('blocked').label },
  { value: 'done', label: statusLabel('done').label }
];

const PRIORITY_OPTIONS: { value: 'all' | Priority; label: string }[] = [
  { value: 'all', label: '全部优先级' },
  { value: 'P0', label: 'P0' },
  { value: 'P1', label: 'P1' },
  { value: 'P2', label: 'P2' }
];

export function RequirementGrid({
  data,
  project,
  filters,
  onFiltersChange,
  selectedId,
  loading,
  onCreated
}: Props) {
  const router = useRouter();
  const [activeView, setActiveView] = useState('board');
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form] = Form.useForm<CreateRequirementForm>();

  const query = filters.query.toLowerCase();
  const ownerFilter = filters.owner || 'all';
  const items = useMemo(() => {
    return data.items.filter((item) => {
      if (filters.status !== 'all' && item.status !== filters.status) return false;
      if (filters.priority !== 'all' && item.priority !== filters.priority) return false;
      if (ownerFilter !== 'all' && item.owner !== ownerFilter) return false;
      if (query) {
        const text = [item.id, item.title, item.summary, item.owner].join(' ').toLowerCase();
        if (!text.includes(query)) return false;
      }
      return true;
    });
  }, [data.items, filters.priority, filters.status, ownerFilter, query]);

  const owners = useMemo(() => unique(data.items.map((item) => item.owner)), [data.items]);

  const isInitialLoading = !!loading && data.items.length === 0;
  const isProjectEmpty = !isInitialLoading && data.items.length === 0;
  const isFilteredEmpty = !isInitialLoading && data.items.length > 0 && items.length === 0;
  const open = (id: string) => router.push(`/p/${project}/r/${id}`);

  const updateFilters = (patch: Partial<Filters>) => {
    onFiltersChange?.({ ...filters, ...patch });
  };

  const clearFilters = () => {
    onFiltersChange?.({ query: '', status: 'all', priority: 'all', owner: 'all' });
  };

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
          <div className="board-filters" aria-label="需求筛选">
            <label>
              <span>状态</span>
              <select
                value={filters.status}
                onChange={(e) => updateFilters({ status: e.target.value as Filters['status'] })}
              >
                {STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>优先级</span>
              <select
                value={filters.priority}
                onChange={(e) => updateFilters({ priority: e.target.value as Filters['priority'] })}
              >
                {PRIORITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              <span>负责人</span>
              <select
                value={ownerFilter}
                onChange={(e) => updateFilters({ owner: e.target.value })}
              >
                <option value="all">全部负责人</option>
                {owners.map((owner) => (
                  <option key={owner} value={owner}>
                    {owner}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="board-count">
            共 <strong>{items.length}</strong> 条需求
          </div>
          <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
            新建需求
          </Button>
        </div>
      </div>

      {isProjectEmpty ? (
        <section className="requirements-empty">
          <div className="requirements-empty-inner">
            <div className="requirements-empty-kicker">需求看板</div>
            <h2>这个项目还没有需求</h2>
            <p>先创建第一条需求，后续可以在详情页维护状态、备注、变更历史，并让 AI 小助手基于当前项目提供建议。</p>
            <Button type="primary" icon={<PlusOutlined />} onClick={() => setCreateOpen(true)}>
              新建需求
            </Button>
          </div>
        </section>
      ) : isFilteredEmpty ? (
        <section className="requirements-empty requirements-empty-filtered">
          <div className="requirements-empty-inner">
            <div className="requirements-empty-kicker">筛选结果</div>
            <h2>没有匹配的需求</h2>
            <p>调整筛选条件，或清空筛选后查看当前项目的全部需求。</p>
            <Button onClick={clearFilters}>
              清空筛选
            </Button>
          </div>
        </section>
      ) : (
        <>
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
        </>
      )}
      <Modal
        title="新建需求"
        open={createOpen}
        onOk={() => void handleCreate()}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={creating}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form
          form={form}
          layout="vertical"
          initialValues={{ status: 'todo', priority: 'P1' }}
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
          <Form.Item label="下一步" name="next">
            <Input.TextArea rows={2} placeholder="例如：确认登录失败提示文案" />
          </Form.Item>
          <Form.Item
            label="状态"
            name="status"
            rules={[{ required: true, message: '请选择状态' }]}
          >
            <Select
              aria-label="状态"
              options={[
                { value: 'todo', label: '待开始' },
                { value: 'doing', label: '进行中' },
                { value: 'blocked', label: '阻塞' },
                { value: 'done', label: '完成' }
              ]}
            />
          </Form.Item>
          <Form.Item label="优先级" name="priority">
            <Select
              aria-label="优先级"
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
