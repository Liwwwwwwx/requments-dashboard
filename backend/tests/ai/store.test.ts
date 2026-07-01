import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  createConversation,
  appendMessage,
  updateMessageContent,
  listMessages,
  getConversation,
  autoTitleFromText,
  setConversationTitleIfEmpty,
  renameConversation,
  findDuplicateTitle,
  deleteConversation
} from '@/ai/store';

const baseConv = {
  userId: 'user-1',
  projectId: 'default',
  requirementId: null,
  title: null,
  model: 'deepseek-chat',
  accountId: null
};

function freshRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-store-'));
  fs.mkdirSync(path.join(dir, 'data', 'default'), { recursive: true });
  return dir;
}

describe('ai/store', () => {
  let rootDir: string;
  beforeEach(() => {
    rootDir = freshRoot();
  });
  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('appendMessage + updateMessageContent 覆写占位', () => {
    const conv = createConversation(rootDir, 'default', baseConv);
    const user = appendMessage(rootDir, 'default', {
      conversationId: conv.id,
      role: 'user',
      content: 'hi'
    });
    const assistant = appendMessage(rootDir, 'default', {
      conversationId: conv.id,
      role: 'assistant',
      content: '',
      tokensIn: 0,
      tokensOut: 0
    });

    // 流式收尾：覆写
    const final = updateMessageContent(rootDir, 'default', assistant.id, {
      content: '你好，世界',
      tokensIn: 5,
      tokensOut: 8
    });
    expect(final?.content).toBe('你好，世界');
    expect(final?.tokensIn).toBe(5);
    expect(final?.tokensOut).toBe(8);

    const msgs = listMessages(rootDir, 'default', conv.id);
    expect(msgs).toHaveLength(2);
    expect(msgs[0]).toMatchObject({ role: 'user', content: 'hi' });
    expect(msgs[1]).toMatchObject({ role: 'assistant', content: '你好，世界' });
  });

  it('updateMessageContent 不存在的消息返回 null', () => {
    const result = updateMessageContent(rootDir, 'default', 'MSG-nope', {
      content: 'x'
    });
    expect(result).toBeNull();
  });
});

describe('ai/store 自动命名', () => {
  let rootDir: string;
  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-store-title-'));
    fs.mkdirSync(path.join(rootDir, 'data', 'default'), { recursive: true });
  });
  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('autoTitleFromText 截断长文本', () => {
    expect(autoTitleFromText('短')).toBe('短');
    const long = 'a'.repeat(50);
    expect(autoTitleFromText(long)).toBe('a'.repeat(30) + '…');
    expect(autoTitleFromText('  多个   空白  折叠  ')).toBe('多个 空白 折叠');
    expect(autoTitleFromText('')).toBeNull();
  });

  it('setConversationTitleIfEmpty 只在 title 为空时生效', () => {
    const conv = createConversation(rootDir, 'default', {
      userId: 'u1',
      projectId: 'default',
      requirementId: null,
      title: null,
      model: 'deepseek-chat',
      accountId: null
    });

    // 第一次设置应成功
    expect(setConversationTitleIfEmpty(rootDir, 'default', conv.id, '首条消息')).toBe(true);
    expect(getConversation(rootDir, 'default', conv.id)?.title).toBe('首条消息');

    // 第二次被拒绝（已有 title）
    expect(setConversationTitleIfEmpty(rootDir, 'default', conv.id, '另一个')).toBe(false);
    expect(getConversation(rootDir, 'default', conv.id)?.title).toBe('首条消息');
  });

  it('createConversation 后立即 appendMessage + 设 title 不影响已有 title', () => {
    const conv = createConversation(rootDir, 'default', {
      userId: 'u1',
      projectId: 'default',
      requirementId: null,
      title: '用户已命名',
      model: 'deepseek-chat',
      accountId: null
    });
    appendMessage(rootDir, 'default', {
      conversationId: conv.id,
      role: 'user',
      content: '一些内容'
    });
    // 用户已命名，setConversationTitleIfEmpty 应返回 false
    expect(
      setConversationTitleIfEmpty(rootDir, 'default', conv.id, autoTitleFromText('一些内容'))
    ).toBe(false);
    expect(getConversation(rootDir, 'default', conv.id)?.title).toBe('用户已命名');
  });
});

describe('ai/store 改名 / 去重 / 删除', () => {
  let rootDir: string;
  beforeEach(() => {
    rootDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-store-rename-'));
    fs.mkdirSync(path.join(rootDir, 'data', 'default'), { recursive: true });
  });
  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('renameConversation 强制覆盖空 / 非空 title', () => {
    const c1 = createConversation(rootDir, 'default', {
      userId: 'u1',
      projectId: 'default',
      requirementId: null,
      title: '原始',
      model: 'deepseek-chat',
      accountId: null
    });
    expect(renameConversation(rootDir, 'default', c1.id, '  新名字  ')).toBe(true);
    expect(getConversation(rootDir, 'default', c1.id)?.title).toBe('新名字');
  });

  it('renameConversation 空标题抛错', () => {
    const c1 = createConversation(rootDir, 'default', {
      userId: 'u1',
      projectId: 'default',
      requirementId: null,
      title: '原始',
      model: 'deepseek-chat',
      accountId: null
    });
    expect(() => renameConversation(rootDir, 'default', c1.id, '   ')).toThrow(/TITLE_EMPTY/);
  });

  it('findDuplicateTitle 大小写 / 空格不敏感', () => {
    const a = createConversation(rootDir, 'default', {
      userId: 'u1',
      projectId: 'default',
      requirementId: null,
      title: 'Hello World',
      model: 'deepseek-chat',
      accountId: null
    });
    expect(findDuplicateTitle(rootDir, 'default', 'hello   world', a.id)).toBeNull();
    expect(findDuplicateTitle(rootDir, 'default', 'Hello World', a.id)).toBeNull();
    expect(findDuplicateTitle(rootDir, 'default', '你好', a.id)).toBeNull();

    // 同名（不同 id）
    const b = createConversation(rootDir, 'default', {
      userId: 'u1',
      projectId: 'default',
      requirementId: null,
      title: '另一个',
      model: 'deepseek-chat',
      accountId: null
    });
    const dup = findDuplicateTitle(rootDir, 'default', 'Hello World', b.id);
    expect(dup).not.toBeNull();
    expect(dup!.id).toBe(a.id);
  });

  it('deleteConversation 级联删除 messages / proposals', () => {
    const c1 = createConversation(rootDir, 'default', {
      userId: 'u1',
      projectId: 'default',
      requirementId: null,
      title: '待删',
      model: 'deepseek-chat',
      accountId: null
    });
    appendMessage(rootDir, 'default', { conversationId: c1.id, role: 'user', content: 'a' });
    appendMessage(rootDir, 'default', { conversationId: c1.id, role: 'assistant', content: 'b' });

    const result = deleteConversation(rootDir, 'default', c1.id);
    expect(result).toEqual({ messages: 2, proposals: 0, conversations: 1 });
    expect(getConversation(rootDir, 'default', c1.id)).toBeNull();
    expect(listMessages(rootDir, 'default', c1.id)).toEqual([]);
  });
});