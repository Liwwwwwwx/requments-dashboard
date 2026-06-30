'use client';

import { Input, Button } from 'antd';
import { PlusOutlined, SearchOutlined } from '@ant-design/icons';
import type { Filters, RequirementStatus } from '@/lib/types';

interface Props {
  filters: Filters;
  setFilters: (f: Filters) => void;
  totalCount: number;
}

const STATUS_SHORTCUTS: { key: RequirementStatus | 'all'; label: string }[] = [
  { key: 'all', label: '全部' },
  { key: 'doing', label: '进行中' },
  { key: 'todo', label: '待开始' },
  { key: 'paused', label: '暂停' },
];

export function QuickActionBar({ filters, setFilters, totalCount }: Props) {
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
          style={{ width: 260, height: 36, borderRadius: 8 }}
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
      </div>
    </div>
  );
}
