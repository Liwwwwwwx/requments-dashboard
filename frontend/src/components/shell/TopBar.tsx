'use client';

import { Avatar, Button, Dropdown, Input, Tooltip, type MenuProps } from 'antd';
import {
  LogoutOutlined,
  ReloadOutlined,
  RobotOutlined,
  SearchOutlined
} from '@ant-design/icons';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { ThemeToggle } from './ThemeToggle';

interface TopBarProps {
  total: number;
  showSearch: boolean;
  query: string;
  onQueryChange: (q: string) => void;
  loading: boolean;
  onRefresh: () => void;
  /** 当前项目 id，用于「AI 小助手」按钮跳转 */
  projectId?: string;
}

export function TopBar({
  total,
  showSearch,
  query,
  onQueryChange,
  loading,
  onRefresh,
  projectId,
}: TopBarProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const isMac = typeof navigator !== 'undefined' && /Mac|iPhone|iPad/.test(navigator.platform);
  const shortcutLabel = isMac ? '⌘K' : 'Ctrl+K';

  const openAi = () => {
    const id = projectId || 'default';
    router.push(`/p/${id}/ai`);
  };

  const displayName = user?.displayName || user?.username || '';
  const initial = displayName ? displayName.slice(0, 1).toUpperCase() : 'U';

  const menuItems: MenuProps['items'] = [
    {
      key: 'name',
      label: (
        <div className="topbar-user-card">
          <span className="topbar-user-card-name">{displayName}</span>
          {user?.username && user.displayName && (
            <span className="topbar-user-card-sub">@{user.username}</span>
          )}
        </div>
      ),
      disabled: true
    },
    { type: 'divider' },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: () => void logout()
    }
  ];

  return (
    <header className="topbar">
      <div className="topbar-brand" aria-label="TraceBoard">
        <span className="topbar-brand-mark" />
        Trace<span className="topbar-brand-accent">Board</span>
      </div>

      <div className="topbar-actions">
        {showSearch && (
          <Input
            className="topbar-search"
            prefix={<SearchOutlined />}
            placeholder={`搜索 ${total} 条需求`}
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            allowClear
          />
        )}

        <Tooltip title={`刷新`} placement="bottom">
          <Button
            className="topbar-icon-btn"
            icon={<ReloadOutlined />}
            loading={loading}
            onClick={onRefresh}
            type="text"
            aria-label="刷新"
          />
        </Tooltip>

        <Tooltip title={`AI 小助手 (${shortcutLabel})`} placement="bottom">
          <Button
            className="topbar-icon-btn"
            icon={<RobotOutlined />}
            onClick={openAi}
            type="text"
            aria-label="AI 小助手"
          >
            <span className="topbar-ai-shortcut">{shortcutLabel}</span>
          </Button>
        </Tooltip>

        <ThemeToggle />

        {user && (
          <Dropdown menu={{ items: menuItems }} trigger={['click']} placement="bottomRight">
            <button type="button" className="topbar-user" aria-label="用户菜单">
              <Avatar size={26} className="topbar-avatar">
                {initial}
              </Avatar>
              <span className="topbar-user-name">{displayName}</span>
            </button>
          </Dropdown>
        )}
      </div>
    </header>
  );
}
