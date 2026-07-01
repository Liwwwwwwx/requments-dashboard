import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {
  recordChatUsage,
  readChatUsage,
  chatUsageTotals
} from '@/ai-usage/store';

function freshRoot() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-usage-test-'));
  fs.mkdirSync(path.join(dir, 'data', 'ai-usage'), { recursive: true });
  return dir;
}

describe('ai-usage chat 用量', () => {
  let rootDir: string;
  beforeEach(() => {
    rootDir = freshRoot();
  });
  afterEach(() => {
    fs.rmSync(rootDir, { recursive: true, force: true });
  });

  it('recordChatUsage 追加 + readChatUsage 读取', () => {
    recordChatUsage(rootDir, {
      accountId: 'deepseek-balance',
      provider: 'deepseek',
      model: 'deepseek-chat',
      userId: 'u1',
      projectId: 'default',
      conversationId: 'CONV-1',
      inputTokens: 10,
      outputTokens: 20
    });
    const list = readChatUsage(rootDir);
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({
      accountId: 'deepseek-balance',
      inputTokens: 10,
      outputTokens: 20,
      totalTokens: 30
    });
  });

  it('totalTokens 自动从 input+output 计算', () => {
    recordChatUsage(rootDir, {
      accountId: 'a1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      inputTokens: 5,
      outputTokens: 7
    });
    const list = readChatUsage(rootDir);
    expect(list[0].totalTokens).toBe(12);
  });

  it('recordChatUsage 拒绝空 accountId', () => {
    expect(() =>
      recordChatUsage(rootDir, {
        accountId: '',
        provider: 'deepseek',
        model: 'deepseek-chat',
        inputTokens: 1,
        outputTokens: 1
      })
    ).toThrow(/accountId/);
  });

  it('chatUsageTotals 按账号 + 总和聚合', () => {
    recordChatUsage(rootDir, {
      accountId: 'a1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      inputTokens: 10,
      outputTokens: 20
    });
    recordChatUsage(rootDir, {
      accountId: 'a1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      inputTokens: 5,
      outputTokens: 5
    });
    recordChatUsage(rootDir, {
      accountId: 'a2',
      provider: 'deepseek',
      model: 'deepseek-chat',
      inputTokens: 100,
      outputTokens: 200
    });
    const totals = chatUsageTotals(rootDir);
    expect(totals.total).toEqual({
      inputTokens: 115,
      outputTokens: 225,
      totalTokens: 340,
      count: 3
    });
    expect(totals.byAccount.a1).toEqual({
      inputTokens: 15,
      outputTokens: 25,
      totalTokens: 40,
      count: 2
    });
    expect(totals.byAccount.a2).toEqual({
      inputTokens: 100,
      outputTokens: 200,
      totalTokens: 300,
      count: 1
    });
  });

  it('sinceMs 过滤历史', () => {
    recordChatUsage(rootDir, {
      accountId: 'a1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      inputTokens: 1,
      outputTokens: 1,
      collectedAt: new Date(Date.now() - 48 * 3600 * 1000).toISOString()
    });
    recordChatUsage(rootDir, {
      accountId: 'a1',
      provider: 'deepseek',
      model: 'deepseek-chat',
      inputTokens: 2,
      outputTokens: 3
    });
    const totals = chatUsageTotals(rootDir, {
      sinceMs: Date.now() - 24 * 3600 * 1000
    });
    expect(totals.total.count).toBe(1);
    expect(totals.total.totalTokens).toBe(5);
  });
});