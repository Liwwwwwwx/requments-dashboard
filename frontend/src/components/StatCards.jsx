import { Space, Tag, Typography } from 'antd';

const { Text } = Typography;

const STATUS_ITEMS = [
  { key: 'doing', label: '进行中', color: '#0f9f8f' },
  { key: 'todo', label: '待开始', color: '#667085' },
  { key: 'paused', label: '暂停', color: '#f4a24c' },
  { key: 'done', label: '完成', color: '#16a34a' }
];

export function StatCards({ data }) {
  const items = data.items || [];
  const total = items.length;
  const blocked = items.reduce((acc, item) => acc + (item.taskStats?.blocked || 0), 0);
  const counts = STATUS_ITEMS.reduce((acc, status) => {
    acc[status.key] = items.filter((i) => i.status === status.key).length;
    return acc;
  }, {});

  return (
    <div className="summary-bar">
      <Space size={16} wrap>
        <Text strong className="summary-total">全部 {total}</Text>
        {STATUS_ITEMS.map((status) => (
          <Space key={status.key} size={6}>
            <span className="summary-dot" style={{ background: status.color }} />
            <Text type="secondary">{status.label}</Text>
            <Text strong>{counts[status.key] || 0}</Text>
          </Space>
        ))}
        <Space size={6}>
          <span className="summary-dot" style={{ background: '#cf3636' }} />
          <Text type="secondary">阻塞</Text>
          <Text strong>{blocked}</Text>
        </Space>
        {blocked > 0 && <Tag color="error">需要关注</Tag>}
      </Space>
    </div>
  );
}
