'use client';

import { useState } from 'react';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { Button, Form, Input, Modal, message } from 'antd';
import type { Project, Requirement } from '@/lib/types';
import { MODULE_NAV } from '@/lib/nav';

interface SidebarProps {
  projects: Project[];
  selectedItem: Requirement | null;
  onProjectChange?: (project: string) => void;
  onProjectCreate?: (project: ProjectForm) => Promise<void> | void;
}

interface ProjectForm {
  id: string;
  name: string;
  description?: string;
}

export function Sidebar({ projects, selectedItem, onProjectChange, onProjectCreate }: SidebarProps) {
  const params = useParams<{ project?: string }>();
  const pathname = usePathname() || '';
  const router = useRouter();
  const [form] = Form.useForm<ProjectForm>();
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const currentProjectId = params?.project || 'default';

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
      setCreating(false);
      form.resetFields();
    } catch (error) {
      message.error(error instanceof Error ? error.message : '创建项目失败');
    } finally {
      setSaving(false);
    }
  };

  return (
    <aside className="sidenav">
      <div className="sidenav-scroll">
        <section className="sidenav-section">
          <div className="sidenav-section-head">
            <div className="sidenav-eyebrow">项目</div>
            <Button size="small" type="text" className="sidenav-create" onClick={() => setCreating(true)}>
              创建项目
            </Button>
          </div>
          <nav className="sidenav-list">
            {projects.map((p) => {
              const active = currentProjectId === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  className={`sidenav-item ${active ? 'is-active' : ''}`}
                  onClick={() => onProjectChange?.(p.id)}
                  aria-current={active ? 'page' : undefined}
                >
                  <span className={`sidenav-dot ${active ? 'is-active' : ''}`} />
                  <span className="sidenav-project-text">
                    <span className="sidenav-item-label">{p.name || p.id}</span>
                    {p.name && p.name !== p.id && <span className="sidenav-project-id">{p.id}</span>}
                  </span>
                </button>
              );
            })}
            {projects.length === 0 && <div className="sidenav-empty">暂无项目</div>}
          </nav>
        </section>

        <section className="sidenav-section">
          <div className="sidenav-eyebrow">模块</div>
          <nav className="sidenav-list">
            {MODULE_NAV.map((mod) => {
              const Icon = mod.icon;
              const active = mod.match(pathname, currentProjectId);
              const soon = mod.status === 'soon';
              return (
                <button
                  key={mod.key}
                  type="button"
                  className={`sidenav-item ${active ? 'is-active' : ''} ${soon ? 'is-soon' : ''}`}
                  disabled={soon}
                  onClick={() => !soon && router.push(mod.path(currentProjectId))}
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

      <Modal
        title="创建项目"
        open={creating}
        onOk={() => void handleCreate()}
        onCancel={() => setCreating(false)}
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
