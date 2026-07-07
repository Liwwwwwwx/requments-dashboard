import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { buildSystemPrompt } from '@/ai/context';
import { appendEvents } from '@/events';
import { ensureProjectMetadata, projectPaths } from '@/projects';

let tmpDir: string;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-context-test-'));
});

afterEach(() => {
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('ai/context', () => {
  it('项目级上下文包含当前需求列表概览', () => {
    const paths = projectPaths(tmpDir, 'default');
    ensureProjectMetadata(tmpDir, 'default', {
      name: 'TraceBoard V2',
      description: '第一阶段只做项目、需求和 AI 上下文主链'
    });
    appendEvents(paths.eventsPath, [
      {
        eventId: 'E1',
        ts: 100,
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: '登录页',
        summary: '最小登录体验',
        priority: 'P0',
        owner: 'pm'
      },
      {
        eventId: 'E2',
        ts: 200,
        kind: 'req.new',
        requirementId: 'REQ-0002',
        title: 'AI 小助手',
        summary: '基于项目上下文回答问题',
        priority: 'P1',
        owner: 'dev'
      },
      {
        eventId: 'E3',
        ts: 300,
        kind: 'req.status',
        requirementId: 'REQ-0002',
        status: 'doing'
      }
    ]);

    const prompt = buildSystemPrompt(tmpDir, {
      projectId: 'default'
    });

    expect(prompt).toContain('项目需求概览（2 条）');
    expect(prompt).toContain('default · TraceBoard V2');
    expect(prompt).toContain('描述: 第一阶段只做项目、需求和 AI 上下文主链');
    expect(prompt).toContain('REQ-0001 · 登录页 · 状态=todo · 优先级=P0 · 负责人=pm · 最小登录体验');
    expect(prompt).toContain('REQ-0002 · AI 小助手 · 状态=doing · 优先级=P1 · 负责人=dev · 基于项目上下文回答问题');
  });

  it('只向模型暴露 V2 需求上下文事件', () => {
    const paths = projectPaths(tmpDir, 'default');
    appendEvents(paths.eventsPath, [
      {
        eventId: 'E1',
        ts: 100,
        kind: 'req.new',
        requirementId: 'REQ-0001',
        title: '登录页',
        summary: '最小登录体验',
        priority: 'P1'
      },
      {
        eventId: 'E2',
        ts: 200,
        kind: 'task.new',
        requirementId: 'REQ-0001',
        taskId: 'FE-1',
        role: 'frontend',
        title: '旧任务'
      },
      {
        eventId: 'E3',
        ts: 300,
        kind: 'contract.set',
        requirementId: 'REQ-0001',
        endpoints: [{ method: 'GET', path: '/api/legacy' }]
      },
      {
        eventId: 'E4',
        ts: 400,
        kind: 'req.status',
        requirementId: 'REQ-0001',
        status: 'doing'
      },
      {
        eventId: 'E5',
        ts: 500,
        kind: 'note.add',
        requirementId: 'REQ-0001',
        text: '先补登录错误提示'
      }
    ]);

    const prompt = buildSystemPrompt(tmpDir, {
      projectId: 'default',
      requirementId: 'REQ-0001'
    });

    expect(prompt).toContain('REQ-0001 · 登录页');
    expect(prompt).toContain('最近 3 条相关事件');
    expect(prompt).toContain('[req.new] REQ-0001');
    expect(prompt).toContain('[req.status] REQ-0001 status=doing');
    expect(prompt).toContain('[note.add] REQ-0001');
    expect(prompt).not.toContain('[task.new]');
    expect(prompt).not.toContain('FE-1');
    expect(prompt).not.toContain('### 接口契约');
    expect(prompt).not.toContain('/api/legacy');
  });
});
