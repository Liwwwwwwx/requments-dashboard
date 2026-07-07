'use client';

import { Card, Tag, Typography } from 'antd';

const { Text } = Typography;

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
  return (
    <div className="settings-page">
      <header className="settings-header">
        <div>
          <div className="settings-eyebrow">项目设置</div>
          <h1>当前项目</h1>
          <Text type="secondary">V2 第一版只保留项目、需求看板和 AI 小助手这条主链。</Text>
        </div>
        <Tag color="blue" className="settings-project-tag">{project}</Tag>
      </header>

      <div className="settings-grid">
        <Card className="settings-card" title="第一版范围">
          <div className="settings-tags">
            {v2Scope.map((item) => (
              <Tag key={item} color="blue">{item}</Tag>
            ))}
          </div>
          <p className="settings-note">
            设置页先作为产品边界说明和项目配置入口，后续再接入项目名称、
            描述和成员等可编辑字段。
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
