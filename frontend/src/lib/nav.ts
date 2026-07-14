import type { ComponentType } from 'react';
import {
  ApartmentOutlined,
  BarChartOutlined,
  FileTextOutlined,
  HomeOutlined,
  MessageOutlined,
  ProjectOutlined,
  SettingOutlined,
  TableOutlined
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
 * 全局侧栏只表达产品能力，不把项目列表混入其中。
 * 项目是各业务模块内的工作范围，由模块页面自行切换。
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
    key: 'documents',
    label: '文档中心',
    icon: FileTextOutlined,
    status: 'soon',
    path: () => '#',
    match: () => false
  },
  {
    key: 'insights',
    label: '数据分析',
    icon: BarChartOutlined,
    status: 'soon',
    path: () => '#',
    match: () => false
  }
];

export const WORKSPACE_NAV: ModuleNavItem[] = [
  {
    key: 'overview',
    label: '概览',
    icon: HomeOutlined,
    status: 'soon',
    path: () => '#',
    match: () => false
  },
  {
    key: 'chat',
    label: '聊天',
    icon: MessageOutlined,
    status: 'ready',
    path: () => '#',
    match: () => false
  }
];

export const MANAGEMENT_NAV: ModuleNavItem[] = [
  {
    key: 'projects',
    label: '项目管理',
    icon: ProjectOutlined,
    status: 'soon',
    path: () => '#',
    match: () => false
  },
  {
    key: 'project-settings',
    label: '项目设置',
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
  { key: 'list', label: '列表', icon: TableOutlined, status: 'ready' }
];
