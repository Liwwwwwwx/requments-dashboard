import { Card, Row, Col, Statistic } from 'antd';

const STATUS_COLORS = {
  todo: '#667085',
  doing: '#0f9f8f',
  paused: '#f4a24c',
  done: '#16a34a'
};

export function StatCards({ data }) {
  const total = data.items.length;
  const done = data.items.filter((i) => i.status === 'done').length;
  const doing = data.items.filter((i) => i.status === 'doing').length;
  const paused = data.items.filter((i) => i.status === 'paused').length;
  const todo = data.items.filter((i) => i.status === 'todo').length;

  return (
    <Row gutter={[12, 12]} style={{ marginBottom: 0 }}>
      <Col flex="auto">
        <Card size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
          <Statistic title="全部需求" value={total} valueStyle={{ color: '#17212f' }} />
        </Card>
      </Col>
      <Col flex="auto">
        <Card size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
          <Statistic title="待开始" value={todo} valueStyle={{ color: STATUS_COLORS.todo }} />
        </Card>
      </Col>
      <Col flex="auto">
        <Card size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
          <Statistic title="进行中" value={doing} valueStyle={{ color: STATUS_COLORS.doing }} />
        </Card>
      </Col>
      <Col flex="auto">
        <Card size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
          <Statistic title="暂停" value={paused} valueStyle={{ color: STATUS_COLORS.paused }} />
        </Card>
      </Col>
      <Col flex="auto">
        <Card size="small" style={{ background: '#ffffff', borderColor: '#dfe5ee' }}>
          <Statistic title="完成" value={done} valueStyle={{ color: STATUS_COLORS.done }} />
        </Card>
      </Col>
    </Row>
  );
}
