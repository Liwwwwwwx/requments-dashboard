'use client';

import { memo, useDeferredValue } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';

const components: Components = {
  h1: ({ children }) => <h1 className="md-h1">{children}</h1>,
  h2: ({ children }) => <h2 className="md-h2">{children}</h2>,
  h3: ({ children }) => <h3 className="md-h3">{children}</h3>,
  h4: ({ children }) => <h4 className="md-h4">{children}</h4>,
  p: ({ children }) => <p className="md-p">{children}</p>,
  ul: ({ children }) => <ul className="md-ul">{children}</ul>,
  ol: ({ children }) => <ol className="md-ol">{children}</ol>,
  li: ({ children }) => <li className="md-li">{children}</li>,
  code: ({ className, children, ...rest }) => {
    // react-markdown v9: inline code 没有 className（除非用户写了 ```）
    const isInline = !className;
    return isInline ? (
      <code className="md-code-inline" {...rest}>
        {children}
      </code>
    ) : (
      <code className={className}>{children}</code>
    );
  },
  pre: ({ children }) => <pre className="md-pre">{children}</pre>,
  a: ({ href, children }) => (
    <a href={href} target="_blank" rel="noreferrer" className="md-a">
      {children}
    </a>
  ),
  blockquote: ({ children }) => <blockquote className="md-quote">{children}</blockquote>,
  table: ({ children }) => (
    <div className="md-table-wrap">
      <table className="md-table">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="md-thead">{children}</thead>,
  tbody: ({ children }) => <tbody className="md-tbody">{children}</tbody>,
  th: ({ children }) => <th className="md-th">{children}</th>,
  td: ({ children }) => <td className="md-td">{children}</td>,
  hr: () => <hr className="md-hr" />,
  strong: ({ children }) => <strong className="md-strong">{children}</strong>,
  em: ({ children }) => <em className="md-em">{children}</em>
};

interface Props {
  content: string;
}

/**
 * 渲染 Markdown 文本。
 *
 * 性能：
 * - React.memo 让 props.content 不变时不重渲染（流式场景父组件每 delta 都会 re-render）
 * - useDeferredValue 让 Markdown 解析在 React 18+ 调度中作为低优先级任务，
 *   不阻塞输入框打字 / 滚动 / 停止按钮等高优先级交互
 */
function MarkdownInner({ content }: Props) {
  const deferredContent = useDeferredValue(content);
  if (!deferredContent) return null;
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[[rehypeHighlight, { ignoreMissing: true }]]}
      components={components}
    >
      {deferredContent}
    </ReactMarkdown>
  );
}

export const Markdown = memo(MarkdownInner);
Markdown.displayName = 'Markdown';