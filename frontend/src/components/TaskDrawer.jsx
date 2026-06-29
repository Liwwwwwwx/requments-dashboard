import { Drawer, Descriptions, Tag, Typography, List, Divider } from 'antd';
import { statusLabel, roleColor, roleLabel } from '../utils';

const { Text, Paragraph, Title } = Typography;

export function TaskDrawer({ task, onClose }) {
  if (!task) return null;

  return (
    <Drawer
      title={task.title || task.taskId}
      width={560}
      open={Boolean(task)}
      onClose={onClose}
      bodyStyle={{ background: '#f8fafc' }}
    >
      <Descriptions column={2} size="small" bordered style={{ marginBottom: 16 }}>
        <Descriptions.Item label="任务 ID">{task.taskId}</Descriptions.Item>
        <Descriptions.Item label="角色">
          <Tag color={roleColor(task.role)}>{roleLabel(task.role)}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <Tag color={statusLabel(task.status).color}>{statusLabel(task.status).label}</Tag>
        </Descriptions.Item>
        <Descriptions.Item label="Agent">{task.agent || <Text type="secondary">未领取</Text>}</Descriptions.Item>
        <Descriptions.Item label="所属需求" span={2}>{task.requirementTitle}</Descriptions.Item>
        <Descriptions.Item label="负责人" span={2}>{task.requirementOwner || <Text type="secondary">未分配</Text>}</Descriptions.Item>
      </Descriptions>

      <Divider style={{ borderColor: '#dfe5ee' }} />

      <Title level={5}>任务说明</Title>
      <Paragraph style={{ color: '#475467' }}>{task.scope || task.title || '暂无说明'}</Paragraph>

      <Title level={5}>验证结果</Title>
      <Paragraph style={{ color: '#475467' }}>{task.verify || '暂无验证结果'}</Paragraph>

      <Title level={5}>备注</Title>
      <Paragraph style={{ color: '#475467' }}>{task.notes || '暂无备注'}</Paragraph>

      <Divider style={{ borderColor: '#dfe5ee' }} />

      <Title level={5}>同需求其他任务</Title>
      <List
        size="small"
        dataSource={task.requirement?.tasks || []}
        renderItem={(t) => (
          <List.Item style={{ borderColor: '#dfe5ee' }}>
            <div>
              <Tag color={roleColor(t.role)}>{roleLabel(t.role)}</Tag>
              <Text style={{ marginLeft: 8 }}>{t.taskId}</Text>
              <Text type="secondary" style={{ marginLeft: 8 }}>{t.title}</Text>
            </div>
          </List.Item>
        )}
      />
    </Drawer>
  );
}
