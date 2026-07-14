'use client';

import { Button, Tooltip } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { ChatPanel } from './ChatPanel';

interface Props {
  project: string;
  requirementId?: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function AiAssistantWidget({ project, requirementId, open, onOpenChange }: Props) {
  return (
    open ? (
      <div className="ai-assistant-widget is-open">
        <section className="ai-assistant-popover" role="dialog" aria-label="AI 助手">
          <Tooltip title="关闭 AI 助手">
            <Button
              type="text"
              shape="circle"
              className="ai-assistant-close"
              icon={<CloseOutlined />}
              onClick={() => onOpenChange(false)}
              aria-label="关闭 AI 助手"
            />
          </Tooltip>
          <ChatPanel project={project} requirementId={requirementId} />
        </section>
      </div>
    ) : null
  );
}
