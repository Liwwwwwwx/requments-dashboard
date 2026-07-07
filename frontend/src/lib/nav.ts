import type { ComponentType } from 'react';
import {
  ApartmentOutlined,
  SettingOutlined,
  TableOutlined,
  FieldTimeOutlined,
  RobotOutlined
} from '@ant-design/icons';

/** 模块上线状态：ready 可用，soon 预留（导航中可见但不可进入）。 */
export type ModuleStatus = 'ready' | 'soon';

/** 图标组件（AntD 图标兼容），允许传 className。 */
type IconComponent = ComponentType<{ className?: string }>;

export interface ModuleNavItem {
  key: string;
  label: string;
  icon: IconComponent;
  status: ModuleStatus;
  /** 由当前项目 id 构造目标路由。 */
  path: (projectId: string) => string;
  /** 判断给定路径是否落在此模块内（用于高亮 active）。 */
  match: (pathname: string, projectId: string) => boolean;
}

/**
 * V2 应用级模块导航：只保留需求看板、AI 小助手和设置。
 * 项目入口由左侧项目列表承担，复杂后台能力不进入第一版导航。
 */
export const MODULE_NAV: ModuleNavItem[] = [
  {
    key: 'board',
    label: '需求看板',
    icon: ApartmentOutlined,
    status: 'ready',
    path: (p) => `/p/${p}`,
    match: (pathname, p) => pathname === `/p/${p}` || pathname.startsWith(`/p/${p}/r/`)
  },
  {
    key: 'ai',
    label: 'AI 小助手',
    icon: RobotOutlined,
    status: 'ready',
    path: (p) => `/p/${p}/ai`,
    match: (pathname, p) => pathname.startsWith(`/p/${p}/ai`)
  },
  {
    key: 'settings',
    label: '设置',
    icon: SettingOutlined,
    status: 'ready',
    path: (p) => `/p/${p}/settings`,
    match: (pathname, p) => pathname.startsWith(`/p/${p}/settings`)
  }
];

/** 看板内的视图切换（“更多项目视图”预留）。 */
export interface BoardViewItem {
  key: string;
  label: string;
  icon: IconComponent;
  status: ModuleStatus;
}

export const BOARD_VIEWS: BoardViewItem[] = [
  { key: 'board', label: '看板', icon: ApartmentOutlined, status: 'ready' },
  { key: 'list', label: '列表', icon: TableOutlined, status: 'ready' },
  { key: 'timeline', label: '时间线', icon: FieldTimeOutlined, status: 'ready' }
];
