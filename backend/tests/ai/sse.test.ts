import { describe, it, expect, vi } from 'vitest';
import { setupSse, send, comment, endSse } from '@/ai/sse';

function makeRes() {
  const res: any = {
    statusCode: 200,
    headers: {} as Record<string, string>,
    chunks: [] as string[],
    writableEnded: false,
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    write(chunk: string) {
      this.chunks.push(chunk);
    },
    end() {
      this.writableEnded = true;
    },
    flushHeaders() {}
  };
  return res;
}

describe('ai/sse', () => {
  it('setupSse 设置必要的响应头', () => {
    const res = makeRes();
    setupSse(res);
    expect(res.headers['Content-Type']).toContain('text/event-stream');
    expect(res.headers['Cache-Control']).toContain('no-store');
    expect(res.headers['Connection']).toBe('keep-alive');
  });

  it('send 输出 event + data 双行格式', () => {
    const res = makeRes();
    setupSse(res);
    send(res, 'delta', { delta: '你好' });
    expect(res.chunks.join('')).toBe('event: delta\ndata: {"delta":"你好"}\n\n');
  });

  it('send 在已结束时为 no-op', () => {
    const res = makeRes();
    res.writableEnded = true;
    send(res, 'delta', { delta: 'x' });
    expect(res.chunks).toEqual([]);
  });

  it('comment 以冒号开头，连接保活', () => {
    const res = makeRes();
    setupSse(res);
    comment(res, 'ping');
    expect(res.chunks.join('')).toBe(': ping\n\n');
  });

  it('endSse 调用 res.end', () => {
    const res = makeRes();
    setupSse(res);
    endSse(res);
    expect(res.writableEnded).toBe(true);
  });
});