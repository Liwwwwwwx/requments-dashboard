import { Drawer, Descriptions, Typography, List, Divider, Space } from 'antd';
import { statusLabel, statusChipClass, roleColor, roleLabel } from '../utils';

const { Text, Paragraph, Title } = Typography;

export function TaskDrawer({ task, onClose }) {
  if (!task) return null;

  const taskStatus = statusLabel(task.status);

  return (
    <Drawer
      title={
        <Space size={10} align="center">
          <span className="chip chip-mono">{task.taskId}</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 400 }}>
            {task.title || task.taskId}
          </span>
        </Space>
      }
      width={560}
      open={Boolean(task)}
      onClose={onClose}
    >
      <Descriptions column={2} size="small" bordered style={{ marginBottom: 20 }}>
        <Descriptions.Item label="编号">
          <Text style={{ fontFamily: 'var(--font-mono)' }}>{task.taskId}</Text>
        </Descriptions.Item>
        <Descriptions.Item label="角色">
          <span
            className="chip"
            style={{
              color: roleColor(task.role),
              borderColor: 'transparent',
              background: 'var(--bg-surface-2)'
            }}
          >
            <span className="chip-dot" />
            {roleLabel(task.role)}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="状态">
          <span className={`chip ${statusChipClass(task.status)}`}>
            <span className="chip-dot" />
            {taskStatus.label}
          </span>
        </Descriptions.Item>
        <Descriptions.Item label="负责人">
          {task.agent || <Text type="secondary">未领取</Text>}
        </Descriptions.Item>
        <Descriptions.Item label="所属需求" span={2}>
          {task.requirementTitle}
        </Descriptions.Item>
        <Descriptions.Item label="需求负责人" span={2}>
          {task.requirementOwner || <Text type="secondary">未分配</Text>}
        </Descriptions.Item>
      </Descriptions>

      <Divider style={{ borderColor: 'var(--border-subtle)', margin: '12px 0 16px' }} />

      <section style={{ marginBottom: 18 }}>
        <Title level={5}>任务说明</Title>
        <Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
          {task.scope || task.title || '暂无说明'}
        </Paragraph>
      </section>

      <section style={{ marginBottom: 18 }}>
        <Title level={5}>验证结果</Title>
        <Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
          {task.verify || '暂无验证结果'}
        </Paragraph>
      </section>

      <section style={{ marginBottom: 18 }}>
        <Title level={5}>备注</Title>
        <Paragraph style={{ color: 'var(--text-secondary)', marginBottom: 0 }}>
          {task.notes || '暂无备注'}
        </Paragraph>
      </section>

      <Divider style={{ borderColor: 'var(--border-subtle)', margin: '12px 0 16px' }} />

      <section>
        <Title level={5}>同需求其他任务</Title>
        <List
          size="small"
          dataSource={task.requirement?.tasks || []}
          renderItem={(t) => (
            <List.Item>
              <Space size={8} wrap>
                <span
                  className="chip"
                  style={{
                    color: roleColor(t.role),
                    borderColor: 'transparent',
                    background: 'var(--bg-surface-2)'
                  }}
                >
                  <span className="chip-dot" />
                  {roleLabel(t.role)}
                </span>
                <Text style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>{t.taskId}</Text>
                <Text type="secondary" style={{ fontSize: 12 }}>{t.title}</Text>
              </Space>
            </List.Item>
          )}
        />
      </section>
    </Drawer>
  );
}
