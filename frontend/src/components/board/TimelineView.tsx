'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import { InboxOutlined } from '@ant-design/icons';
import { fetchProjectEvents } from '@/lib/api';
import { statusLabel } from '@/lib/utils';
import type { ProjectEvent, Requirement } from '@/lib/types';

interface Props {
  project: string;
  requirements: Requirement[];
  onOpen: (id: string) => void;
}

const PAGE = 50;

function statusTone(s?: string): string {
  switch (s) {
    case 'done':
    case 'accepted':
      return 'done';
    case 'blocked':
      return 'blocked';
    case 'doing':
    case 'working':
      return 'doing';
    case 'paused':
      return 'paused';
    case 'claimed':
      return 'claimed';
    default:
      return 'todo';
  }
}

function toneFor(ev: ProjectEvent): string {
  if ((ev.kind === 'req.status' || ev.kind === 'task.status') && ev.status) return statusTone(ev.status);
  switch (ev.kind) {
    case 'req.new':
    case 'contract.set':
      return 'doing';
    case 'note.add':
      return 'note';
    default:
      return 'todo';
  }
}

function headText(ev: ProjectEvent): string {
  const sl = ev.status ? statusLabel(ev.status).label : '';
  switch (ev.kind) {
    case 'req.new':
      return '新建需求';
    case 'req.status':
      return `状态变更 → ${sl}`;
    case 'req.patch':
      return '更新需求';
    case 'task.new':
      return `新建任务${ev.taskId ? ` ${ev.taskId}` : ''}`;
    case 'task.status':
      return `任务${ev.taskId ? ` ${ev.taskId}` : ''} → ${sl}`;
    case 'contract.set':
      return '设置契约';
    case 'note.add':
      return '添加备注';
    default:
      return String(ev.kind);
  }
}

function dayLabel(ts: number): string {
  const d = dayjs(ts);
  const today = dayjs().startOf('day');
  if (d.isSame(today, 'day')) return '今天';
  if (d.isSame(today.subtract(1, 'day'), 'day')) return '昨天';
  return d.format('YYYY 年 M 月 D 日');
}

export function TimelineView({ project, requirements, onOpen }: Props) {
  const [events, setEvents] = useState<ProjectEvent[]>([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleOf = useMemo(() => {
    const m = new Map<string, string>();
    requirements.forEach((r) => m.set(r.id, r.title));
    return (id?: string) => (id ? m.get(id) : undefined);
  }, [requirements]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setEvents([]);
    setOffset(0);
    fetchProjectEvents(project, { limit: PAGE, offset: 0 })
      .then((res) => {
        if (cancelled) return;
        setEvents(res.events);
        setHasMore(res.hasMore);
        setOffset(res.events.length);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e instanceof Error ? e.message : String(e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [project]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const res = await fetchProjectEvents(project, { limit: PAGE, offset });
      setEvents((prev) => [...prev, ...res.events]);
      setHasMore(res.hasMore);
      setOffset((o) => o + res.events.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoadingMore(false);
    }
  }, [project, offset]);

  const groups = useMemo(() => {
    const out: { label: string; items: ProjectEvent[] }[] = [];
    events.forEach((ev) => {
      const label = dayLabel(ev.ts);
      const last = out[out.length - 1];
      if (!last || last.label !== label) out.push({ label, items: [ev] });
      else last.items.push(ev);
    });
    return out;
  }, [events]);

  if (loading) {
    return (
      <div className="timeline-wrap">
        <div className="timeline-skeleton">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="timeline-sk-row">
              <span className="sk-line sk-dot" />
              <span className="sk-line sk-grow" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error && events.length === 0) {
    return (
      <div className="timeline-empty">
        <span>加载活动记录失败：{error}</span>
      </div>
    );
  }

  if (events.length === 0) {
    return (
      <div className="timeline-empty">
        <InboxOutlined className="timeline-empty-icon" />
        <span>暂无活动记录</span>
      </div>
    );
  }

  return (
    <div className="timeline-wrap">
      <ol className="timeline">
        {groups.map((group) => (
          <li key={group.label} className="timeline-group">
            <div className="timeline-day">{group.label}</div>
            <ul className="timeline-items">
              {group.items.map((ev) => {
                const title = titleOf(ev.requirementId);
                const note = ev.kind === 'note.add' ? ev.text : null;
                return (
                  <li key={ev.eventId} className="tl-item">
                    <time className="tl-time">{dayjs(ev.ts).format('HH:mm')}</time>
                    <span className={`tl-dot tone-${toneFor(ev)}`} />
                    <div className="tl-content">
                      <div className="tl-head">
                        <span className="tl-kind">{headText(ev)}</span>
                        {ev.actor && <span className="tl-actor">{ev.actor}</span>}
                      </div>
                      {ev.requirementId && (
                        <button
                          type="button"
                          className="tl-req"
                          onClick={() => onOpen(ev.requirementId as string)}
                        >
                          <span className="tl-req-id">{ev.requirementId}</span>
                          {title && <span className="tl-req-title">{title}</span>}
                        </button>
                      )}
                      {note && <p className="tl-note">{note}</p>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </li>
        ))}
      </ol>

      {hasMore && (
        <div className="timeline-more">
          <button type="button" className="timeline-more-btn" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? '加载中…' : '加载更多'}
          </button>
        </div>
      )}
      {error && events.length > 0 && <div className="timeline-more-error">加载失败：{error}</div>}
    </div>
  );
}
