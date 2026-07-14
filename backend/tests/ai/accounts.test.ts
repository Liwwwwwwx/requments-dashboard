import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readAccounts } from '@/ai-usage/store';

let tmpDir: string;
let previousDeepSeekKey: string | undefined;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-accounts-test-'));
  previousDeepSeekKey = process.env.DEEPSEEK_API_KEY;
});

afterEach(() => {
  if (previousDeepSeekKey === undefined) delete process.env.DEEPSEEK_API_KEY;
  else process.env.DEEPSEEK_API_KEY = previousDeepSeekKey;
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('AI accounts', () => {
  it('injects DEEPSEEK_API_KEY into the default account without persisting it', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-server-env';

    const accounts = readAccounts(tmpDir);

    expect(accounts[0]).toMatchObject({
      id: 'deepseek-balance',
      provider: 'deepseek',
      apiKey: 'sk-server-env'
    });

    const accountsFile = path.join(tmpDir, 'data', 'ai-usage', 'accounts.json');
    const persisted = JSON.parse(fs.readFileSync(accountsFile, 'utf8'));
    expect(persisted[0]).not.toHaveProperty('apiKey');
  });
});
