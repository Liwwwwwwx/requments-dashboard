import type { ComponentType } from 'react';
import {
  ApartmentOutlined,
  BarChartOutlined,
  SettingOutlined,
  TableOutlined,
  FieldTimeOutlined
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
 * 应用级模块导航。新增业务模块 = 在此追加一条 + 提供对应路由页面。
 * 看板已可用；仪表盘、管理后台先占位（status: 'soon'）。
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
    key: 'dashboard',
    label: '数据仪表盘',
    icon: BarChartOutlined,
    status: 'soon',
    path: (p) => `/p/${p}/dashboard`,
    match: (pathname, p) => pathname.startsWith(`/p/${p}/dashboard`)
  },
  {
    key: 'admin',
    label: '管理后台',
    icon: SettingOutlined,
    status: 'soon',
    path: (p) => `/p/${p}/admin`,
    match: (pathname, p) => pathname.startsWith(`/p/${p}/admin`)
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
