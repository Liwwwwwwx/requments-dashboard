'use client';

import { Input, Button, Tooltip } from 'antd';
import { AppstoreOutlined, UnorderedListOutlined, PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { Filters, RequirementStatus } from '@/lib/types';

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  viewMode: 'grid' | 'list';
  setViewMode: (m: 'grid' | 'list') => void;
  totalCount: number;
}

const STATUS_SHORTCUTS: { key: RequirementStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'doing', label: '进行中' },
  { key: 'todo', label: '待开始' },
  { key: 'paused', label: '暂停' },
];

export function QuickActionBar({ filters, setFilters, viewMode, setViewMode, totalCount }: Props) {
  return (
    <div className="quick-action-bar">
      <div className="qa-left">
        <Input
          className="qa-search"
          prefix={<SearchOutlined style={{ color: '#94a3b8' }} />}
          placeholder={`搜索 ${totalCount} 条需求...`}
          value={filters.query}
          onChange={(e) => setFilters({ ...filters, query: e.target.value })}
          allowClear
          style={{ width: 240, height: 36, borderRadius: 8 }}
        />
        <div className="qa-shortcuts">
          {STATUS_SHORTCUTS.map((s) => (
            <button
              key={s.key}
              type="button"
              className={`qa-shortcut ${filters.status === s.key ? 'active' : ''}`}
              onClick={() => setFilters({ ...filters, status: s.key })}
            >
              {s.label}
            </button>
          ))}
        </div>
      </div>
      <div className="qa-right">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          style={{ height: 36, borderRadius: 8, fontWeight: 500, fontSize: 13 }}
        >
          新建需求
        </Button>
        <div className="qa-view-toggle">
          <Tooltip title="网格视图">
            <button
              type="button"
              className={`qa-toggle-btn ${viewMode === 'grid' ? 'active' : ''}`}
              onClick={() => setViewMode('grid')}
            >
              <AppstoreOutlined />
            </button>
          </Tooltip>
          <Tooltip title="列表视图">
            <button
              type="button"
              className={`qa-toggle-btn ${viewMode === 'list' ? 'active' : ''}`}
              onClick={() => setViewMode('list')}
            >
              <UnorderedListOutlined />
            </button>
          </Tooltip>
        </div>
      </div>
    </div>
  );
}
