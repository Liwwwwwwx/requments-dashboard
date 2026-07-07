'use client';

import { useEffect, useState } from 'react';
import { Alert, Button, Card, Input, Tag, Typography } from 'antd';
import { fetchProject, updateProject } from '@/lib/api';
import type { Project } from '@/lib/types';

const { Text } = Typography;
const { TextArea } = Input;

interface Props {
  project: string;
}

const v2Scope = [
  '登录',
  '项目切换',
  '需求看板',
  '需求详情',
  'AI 小助手'
];

const outOfScope = [
  '管理后台',
  '跨项目指挥台',
  '数据大屏',
  'Agent 执行中心',
  '周报/月报'
];

export function ProjectSettingsView({ project }: Props) {
  const [projectInfo, setProjectInfo] = useState<Project | null>(null);
  const [name, setName] = useState(project);
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setNotice(null);
    setError(null);
    fetchProject(project)
      .then((res) => {
        if (!alive) return;
        setProjectInfo(res.project);
        setName(res.project.name || res.project.id);
        setDescription(res.project.description || '');
      })
      .catch((err) => {
        if (!alive) return;
        setError(err instanceof Error ? err.message : String(err));
        setName(project);
        setDescription('');
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [project]);

  async function handleSave() {
    setSaving(true);
    setNotice(null);
    setError(null);
    try {
      const res = await updateProject(project, {
        name: name.trim(),
        description: description.trim()
      });
      setProjectInfo(res.project);
      setName(res.project.name || res.project.id);
      setDescription(res.project.description || '');
      setNotice('已保存');
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <div className="settings-eyebrow">项目设置</div>
          <h1>{projectInfo?.name || project}</h1>
          <Text type="secondary">维护当前项目的基础信息，需求和 AI 小助手都围绕这个项目展开。</Text>
        </div>
        <Tag color="blue" className="settings-project-tag">{project}</Tag>
      </header>

      <div className="settings-grid">
        <Card className="settings-card" title="项目信息" loading={loading}>
          <div className="settings-form">
            <label htmlFor="project-name">项目名称</label>
            <Input
              id="project-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={64}
            />

            <label htmlFor="project-description">项目描述</label>
            <TextArea
              id="project-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              maxLength={500}
              rows={4}
            />

            <div className="settings-actions">
              <Button
                type="primary"
                onClick={handleSave}
                loading={saving}
                disabled={!name.trim()}
              >
                保存
              </Button>
              {projectInfo?.updatedAt && (
                <span className="settings-updated">更新于 {projectInfo.updatedAt}</span>
              )}
            </div>

            {notice && <Alert type="success" showIcon message={notice} />}
            {error && <Alert type="error" showIcon message={error} />}
          </div>
        </Card>

        <Card className="settings-card" title="第一版范围">
          <div className="settings-tags">
            {v2Scope.map((item) => (
              <Tag key={item} color="blue">{item}</Tag>
            ))}
          </div>
          <p className="settings-note">
            设置页只维护项目基础信息，不引入成员权限、审批流或复杂后台配置。
          </p>
        </Card>

        <Card className="settings-card" title="暂不做">
          <div className="settings-tags">
            {outOfScope.map((item) => (
              <Tag key={item}>{item}</Tag>
            ))}
          </div>
          <p className="settings-note">
            这些能力不进入 V2 MVP，避免重新写项目时再次变成复杂后台。
          </p>
        </Card>
      </div>
    </div>
  );
}
