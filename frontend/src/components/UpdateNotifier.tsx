'use client';

import { Button, notification } from 'antd';
import { useEffect } from 'react';
import { useAppUpdate } from '@/hooks/useAppUpdate';

export function UpdateNotifier() {
  const { hasUpdate, reload } = useAppUpdate();

  useEffect(() => {
    if (!hasUpdate) return;

    notification.info({
      message: '发现新版本',
      description: '系统已更新，建议刷新页面以使用最新功能。',
      btn: (
        <Button type="primary" size="small" onClick={reload}>
          立即刷新
        </Button>
      ),
      duration: 0,
      placement: 'topRight',
      key: 'app-update',
    });
  }, [hasUpdate, reload]);

  return null;
}
