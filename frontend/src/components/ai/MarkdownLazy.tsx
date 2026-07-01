'use client';

import { memo } from 'react';
import { Markdown } from './Markdown';

/**
 * Markdown 渲染的稳定入口。
 *
 * - `Markdown` 自身已用 `React.memo` + `useDeferredValue`，无需再包一层
 * - 不做 lazy：首条消息显示时间 < 200ms 可接受；提前加载避免"原文→富文本"切换抖动
 * - 流式阶段 content 不完整时，react-markdown 对未闭合标记回退为字面量，不崩溃
 */
export const MarkdownLazy = memo(Markdown);
MarkdownLazy.displayName = 'MarkdownLazy';