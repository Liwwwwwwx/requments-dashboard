'use client';

/**
 * DeepSeek API Key 的本地存储工具。
 *
 * 设计：key 存浏览器 localStorage，永不上传服务器持久化。
 * 后端通过 X-AI-Api-Key 头接收（per-user 隔离），不在 accounts.json 里共享。
 *
 * 安全提示：localStorage 不加密，对当前设备/浏览器脚本可见；
 * 任何共享设备场景请勿保存。
 */

const STORAGE_KEY = 'ai.deepseek.apiKey.v1';
const ENV_KEY = 'sk-';

function maskKey(key: string | null | undefined): string {
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}••••${key.slice(-4)}`;
}

/** 读当前用户的 DeepSeek key（如果有） */
export function getDeepSeekApiKey(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

/** 写 DeepSeek key 到 localStorage */
export function setDeepSeekApiKey(key: string): void {
  if (typeof window === 'undefined') return;
  try {
    const trimmed = key.trim();
    if (!trimmed) {
      window.localStorage.removeItem(STORAGE_KEY);
    } else {
      window.localStorage.setItem(STORAGE_KEY, trimmed);
    }
  } catch {
    // 隐私模式下可能抛错，吞掉
  }
}

/** 删除 DeepSeek key */
export function clearDeepSeekApiKey(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** 给 UI 用的遮罩显示 */
export function getDeepSeekApiKeyMasked(): string {
  return maskKey(getDeepSeekApiKey());
}

/** 快速校验 key 形态（DeepSeek 是 sk- 前缀，可选） */
export function isLikelyValidKey(key: string): boolean {
  const trimmed = key.trim();
  if (!trimmed) return false;
  // DeepSeek 当前是 sk- 前缀；其他厂商 key 也可能不是 sk-，先宽松校验
  return trimmed.length >= 20;
}

export { ENV_KEY };
