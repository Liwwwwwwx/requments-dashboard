'use client';

import { useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Avatar, Dropdown, Form, Input, Modal, message, type MenuProps } from 'antd';
import { CheckOutlined, GlobalOutlined, LogoutOutlined, SkinOutlined } from '@ant-design/icons';
import type { Requirement } from '@/lib/types';
import { MANAGEMENT_NAV, MODULE_NAV, WORKSPACE_NAV, type ModuleNavItem } from '@/lib/nav';
import { useAuth } from '@/components/AuthProvider';
import { useTheme, type ThemePreference } from '@/components/ThemeProvider';
import { useLanguage } from '@/components/LanguageProvider';

interface SidebarProps {
  selectedItem: Requirement | null;
  onProjectCreate?: (project: ProjectForm) => Promise<void> | void;
  createOpen?: boolean;
  onCreateOpenChange?: (open: boolean) => void;
  assistantOpen?: boolean;
  onToggleAssistant?: () => void;
}

interface ProjectForm {
  id: string;
  name: string;
  description?: string;
}

export function Sidebar({
  selectedItem,
  onProjectCreate,
  createOpen,
  onCreateOpenChange,
  assistantOpen = false,
  onToggleAssistant
}: SidebarProps) {
  const params = useParams<{ project?: string }>();
  const pathname = usePathname() || '';
  const router = useRouter();
  const { user, logout } = useAuth();
  const { preference, setPreference } = useTheme();
  const { language, setLanguage } = useLanguage();
  const [form] = Form.useForm<ProjectForm>();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentProjectId = params?.project || 'default';
  const isCreating = createOpen ?? creating;

  const setCreateOpen = (open: boolean) => {
    if (onCreateOpenChange) onCreateOpenChange(open);
    else setCreating(open);
  };

  const handleCreate = async () => {
    const values = await form.validateFields();
    const input = {
      id: values.id.trim(),
      name: values.name.trim(),
      description: values.description?.trim() || ''
    };
    setSaving(true);
    try {
      await onProjectCreate?.(input);
      message.success('项目已创建');
      setCreateOpen(false);
      form.resetFields();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建项目失败');
    } finally {
      setSaving(false);
    }
  };

  const renderNav = (items: ModuleNavItem[]) => (
    <nav className="sidenav-list">
      {items.map((mod) => {
        const Icon = mod.icon;
        const isChat = mod.key === 'chat';
        const active = mod.match(pathname, currentProjectId) || (isChat && assistantOpen);
        const soon = mod.status === 'soon';
        return (
          <button
            key={mod.key}
            type="button"
            className={`sidenav-item ${active ? 'is-active' : ''} ${soon ? 'is-soon' : ''}`}
            disabled={soon}
            onClick={() => {
              if (isChat) onToggleAssistant?.();
              else if (!soon) router.push(mod.path(currentProjectId));
            }}
            aria-current={active ? 'page' : undefined}
            title={soon ? `${mod.label}（即将上线）` : mod.label}
          >
            <Icon className="sidenav-item-icon" />
            <span className="sidenav-item-label">{mod.label}</span>
            {soon && <span className="sidenav-soon">Soon</span>}
          </button>
        );
      })}
    </nav>
  );

  const themeItems: MenuProps['items'] = (['light', 'dark', 'system'] as ThemePreference[]).map((value) => ({
    key: value,
    label: value === 'light' ? '亮色' : value === 'dark' ? '暗色' : '跟随系统',
    icon: preference === value ? <CheckOutlined /> : undefined,
    onClick: () => setPreference(value)
  }));
  const languageItems: MenuProps['items'] = [
    { key: 'zh-CN', label: '简体中文', icon: language === 'zh-CN' ? <CheckOutlined /> : undefined, onClick: () => setLanguage('zh-CN') },
    { key: 'en-US', label: 'English', icon: language === 'en-US' ? <CheckOutlined /> : undefined, onClick: () => setLanguage('en-US') }
  ];
  const accountMenu: MenuProps['items'] = [
    { key: 'profile', label: <div className="sidenav-account-menu-name">{user?.displayName || user?.username || '当前用户'}</div>, disabled: true },
    { type: 'divider' },
    { key: 'theme', icon: <SkinOutlined />, label: '主题', children: themeItems },
    { key: 'language', icon: <GlobalOutlined />, label: '语言 / Language', children: languageItems },
    { type: 'divider' },
    { key: 'logout', icon: <LogoutOutlined />, label: '退出登录', danger: true, onClick: () => void logout() }
  ];
  const displayName = user?.displayName || user?.username || '当前用户';

  return (
    <aside className="sidenav">
      <div className="sidenav-scroll">
        <section className="sidenav-section">
          <div className="sidenav-eyebrow">工作台</div>
          {renderNav(WORKSPACE_NAV)}
        </section>

        <section className="sidenav-section">
          <div className="sidenav-eyebrow">业务模块</div>
          {renderNav(MODULE_NAV)}
        </section>

        <section className="sidenav-section">
          <div className="sidenav-eyebrow">管理</div>
          {renderNav(MANAGEMENT_NAV)}
        </section>
      </div>

      {selectedItem && (
        <div className="sidenav-current">
          <div className="sidenav-current-eyebrow">当前查看</div>
          <div className="sidenav-current-title">{selectedItem.title}</div>
          <div className="sidenav-current-meta">
            <span className="mono">{selectedItem.id}</span>
          </div>
        </div>
      )}

      {user && (
        <div className="sidenav-account">
          <Dropdown menu={{ items: accountMenu }} trigger={['click']} placement="topLeft">
            <button type="button" className="sidenav-account-button" aria-label="用户与偏好设置">
              <Avatar size={30} className="sidenav-account-avatar">{displayName.slice(0, 1).toUpperCase()}</Avatar>
              <span className="sidenav-account-details">
                <span>{displayName}</span>
                <small>{user.username}</small>
              </span>
              <span className="sidenav-account-more">•••</span>
            </button>
          </Dropdown>
        </div>
      )}

      <Modal
        title="创建项目"
        open={isCreating}
        onOk={() => void handleCreate()}
        onCancel={() => setCreateOpen(false)}
        confirmLoading={saving}
        okText="创建"
        cancelText="取消"
        destroyOnHidden
      >
        <Form form={form} layout="vertical" preserve={false}>
          <Form.Item
            label="项目名称"
            name="name"
            rules={[{ required: true, whitespace: true, message: '请输入项目名称' }]}
          >
            <Input placeholder="例如 TraceBoard V2" autoFocus />
          </Form.Item>

          <Form.Item
            label="项目 ID"
            name="id"
            rules={[
              { required: true, whitespace: true, message: '请输入项目 ID' },
              {
                pattern: /^[a-zA-Z0-9_-]+$/,
                message: '仅支持字母、数字、下划线和中划线'
              }
            ]}
          >
            <Input placeholder="例如 traceboard-v2" />
          </Form.Item>

          <Form.Item label="项目描述" name="description">
            <Input.TextArea
              rows={3}
              placeholder="记录项目目标、范围或当前阶段"
            />
          </Form.Item>
        </Form>
      </Modal>
    </aside>
  );
}
