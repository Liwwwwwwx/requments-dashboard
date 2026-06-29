import { useState, useMemo } from 'react';
import { Layout, Button, Space, Typography, Spin, Alert, Row, Col } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import { useRequirements } from './hooks/useRequirements';
import { ProjectSelector } from './components/ProjectSelector';
import { StatCards } from './components/StatCards';
import { RequirementList } from './components/RequirementList';
import { RequirementWorkbench } from './components/RequirementWorkbench';
import { RequirementDetail } from './components/RequirementDetail';

const { Header, Content } = Layout;
const { Title, Text } = Typography;

const DEFAULT_FILTERS = {
  query: '',
  type: 'all',
  role: 'all',
  status: 'all',
  priority: 'all',
  week: 'all'
};

function App() {
  const { project, setProject, projects, data, taskItems, loading, error, refresh } = useRequirements();
  const [selectedReqId, setSelectedReqId] = useState(null);
  const [selectedTaskKey, setSelectedTaskKey] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);

  const selectedItem = useMemo(() => {
    return data.items.find((i) => i.id === selectedReqId) || data.items[0] || null;
  }, [data.items, selectedReqId]);

  const handleSelect = (reqId, taskKey) => {
    setSelectedReqId(reqId);
    setSelectedTaskKey(taskKey || null);
  };

  const handleProjectChange = (nextProject) => {
    setProject(nextProject);
    setSelectedReqId(null);
    setSelectedTaskKey(null);
  };

  return (
    <Layout className="app">
      <Header className="topbar" style={{ height: 'auto', lineHeight: 'normal' }}>
        <Row align="middle" justify="space-between" gutter={[16, 16]}>
          <Col>
            <Title level={4} style={{ margin: 0, color: '#17212f' }}>需求看板</Title>
            <div style={{ marginTop: 4 }}>
              <StatCards data={data} />
            </div>
          </Col>
          <Col>
            <Space>
              <ProjectSelector project={project} projects={projects} onChange={handleProjectChange} />
              <Button icon={<ReloadOutlined />} loading={loading} onClick={refresh} type="primary">刷新看板</Button>
            </Space>
          </Col>
        </Row>
      </Header>

      <Content className="workspace">
        {error && (
          <Alert
            message={error}
            type="error"
            showIcon
            style={{ position: 'absolute', top: 16, right: 24, zIndex: 100 }}
          />
        )}
        <Spin spinning={loading} style={{ width: '100%', height: '100%' }}>
          <div className="workspace-grid">
            <div className="panel requirement-rail">
              <RequirementList
                data={data}
                taskItems={taskItems}
                selected={selectedItem?.id}
                onSelect={handleSelect}
                filters={filters}
                setFilters={setFilters}
              />
            </div>
            <div className="panel workbench-panel">
              <RequirementWorkbench
                item={selectedItem}
                selectedTaskKey={selectedTaskKey}
                onTaskSelect={handleSelect}
              />
            </div>
            <div className="panel inspector-panel">
              <RequirementDetail
                project={project}
                item={selectedItem}
                taskItems={taskItems}
                selectedTaskKey={selectedTaskKey}
                filters={filters}
                onTaskSelect={handleSelect}
              />
            </div>
          </div>
        </Spin>
      </Content>
    </Layout>
  );
}

export default App;
