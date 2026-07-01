import { describe, it, expect } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';

import { MarkdownLazy } from '../../src/components/ai/MarkdownLazy';

describe('MarkdownLazy', () => {
  it('渲染纯文本', () => {
    render(<MarkdownLazy content="hello world" />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('渲染 GFM 标题', async () => {
    render(<MarkdownLazy content={'# 标题\n## 副标题'} />);
    await waitFor(() => expect(screen.getByRole('heading', { level: 1, name: '标题' })).toBeInTheDocument());
    expect(screen.getByRole('heading', { level: 2, name: '副标题' })).toBeInTheDocument();
  });

  it('渲染 GFM 列表', async () => {
    const { container } = render(<MarkdownLazy content={'- 一\n- 二\n- 三'} />);
    await waitFor(() => expect(container.querySelectorAll('.md-li').length).toBe(3));
    expect(container.querySelectorAll('.md-li')[0].textContent).toBe('一');
  });

  it('渲染行内 code + 加粗 + 链接', async () => {
    const { container } = render(
      <MarkdownLazy
        content={'这是 **粗体** 和 `inline code` 还有 [link](https://example.com)'}
      />
    );
    await waitFor(() => expect(container.querySelector('.md-strong')).not.toBeNull());
    expect(container.querySelector('.md-strong')?.textContent).toBe('粗体');
    expect(container.querySelector('.md-code-inline')?.textContent).toBe('inline code');
    expect(container.querySelector('.md-a')?.getAttribute('href')).toBe('https://example.com');
  });

  it('渲染代码块', async () => {
    const code = '```js\nconst x = 1;\n```';
    const { container } = render(<MarkdownLazy content={code} />);
    await waitFor(() => expect(container.querySelector('pre.md-pre')).not.toBeNull());
    expect(container.querySelector('pre code')).toBeInTheDocument();
  });

  it('空内容返回 null', () => {
    const { container } = render(<MarkdownLazy content="" />);
    expect(container.querySelector('.md-p')).toBeNull();
  });

  it('未闭合的 markdown 不崩溃', () => {
    // 流式场景：用户发 "**" 后只跟了一半
    expect(() => render(<MarkdownLazy content="**half-open bold" />)).not.toThrow();
  });
});