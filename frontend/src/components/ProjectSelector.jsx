import { Select, Space, Typography } from 'antd';

const { Text } = Typography;

export function ProjectSelector({ project, projects, onChange }) {
  return (
    <Space>
      <Text type="secondary">项目</Text>
      <Select
        value={project}
        onChange={onChange}
        style={{ minWidth: 160 }}
        options={projects.map((p) => ({ label: p.name, value: p.id }))}
        placeholder="选择项目"
      />
    </Space>
  );
}
