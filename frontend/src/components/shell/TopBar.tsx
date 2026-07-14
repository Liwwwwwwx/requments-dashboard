'use client';

import { Avatar, Dropdown, type MenuProps } from 'antd';
import { LogoutOutlined } from '@ant-design/icons';
import { useAuth } from '@/components/AuthProvider';

export function TopBar() {
  const { user, logout } = useAuth();

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
