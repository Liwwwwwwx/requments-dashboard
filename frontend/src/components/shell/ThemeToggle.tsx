'use client';

import type { ReactElement } from 'react';
import { Tooltip } from 'antd';
import { useTheme, type ThemePreference } from '@/components/ThemeProvider';

const LABELS: Record<ThemePreference, string> = {
  light: '亮色',
  dark: '暗色',
  system: '跟随系统'
};

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <circle cx="12" cy="12" r="4" stroke="currentColor" strokeWidth="1.6" />
      <path
        d="M12 2.5v2.2M12 19.3v2.2M21.5 12h-2.2M4.7 12H2.5M18.4 5.6l-1.6 1.6M7.2 16.8l-1.6 1.6M18.4 18.4l-1.6-1.6M7.2 7.2 5.6 5.6"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
      />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <path
        d="M20 13.2A8 8 0 1 1 10.8 4a6.4 6.4 0 0 0 9.2 9.2Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="12" rx="1.6" stroke="currentColor" strokeWidth="1.6" />
      <path d="M9 20h6M12 16.5V20" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  );
}

const ICONS: Record<ThemePreference, () => ReactElement> = {
  light: SunIcon,
  dark: MoonIcon,
  system: SystemIcon
};

export function ThemeToggle() {
  const { preference, cycle } = useTheme();
  const Icon = ICONS[preference];

  return (
    <Tooltip title={`主题：${LABELS[preference]}（点击切换）`} placement="bottom">
      <button
        type="button"
        className="theme-toggle"
        onClick={cycle}
        aria-label={`切换主题，当前${LABELS[preference]}`}
      >
        <Icon />
      </button>
    </Tooltip>
  );
}
