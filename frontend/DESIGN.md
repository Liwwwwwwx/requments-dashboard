# Design

TraceBoard 的视觉系统。Linear 式工程工具气质：精确、克制、信息密度高、层级清晰。亮 / 暗双主题，蓝色品牌身份。本文件是 token、字体、组件、布局、动效的唯一设计参考；`src/lib/tokens.ts`（AntD）与 `src/app/globals.css :root / [data-theme="dark"]`（自定义 UI）按此实现，命名一一对应。

## Theme

双主题，`<html data-theme="light|dark">` 切换，跟随系统 + 手动覆盖（localStorage `tb-theme`），无闪烁。色彩策略：**Restrained** —— 冷中性底 + 单一蓝色 accent，颜色仅承载语义（状态 / 优先级 / 选中 / 主操作）。

## Color

语义命名，亮暗成对。对比度按 WCAG AA 校对。

### Light

| 角色 | 值 |
|---|---|
| bg-canvas（app 底） | `#f6f7f9` |
| bg-surface（卡片/面板） | `#ffffff` |
| bg-surface-2（次级面） | `#f1f3f6` |
| bg-surface-3 / hover | `#e7eaef` / `#eef0f3` |
| border hairline/subtle/default/strong | `rgba(15,23,42,.06 / .09 / .13 / .20)` |
| text primary/secondary/tertiary/quaternary | `#0f172a` / `#334155` / `#5b6677` / `#8a94a6` |
| accent / hover / soft | `#2563eb` / `#1d4ed8` / `rgba(37,99,235,.10)` |

### Dark（近黑微蓝，非纯黑）

| 角色 | 值 |
|---|---|
| bg-canvas | `#0c0e13` |
| bg-surface | `#15181f` |
| bg-surface-2 | `#1b1f28` |
| bg-surface-3 / hover | `#232834` / `#232834` |
| border hairline/subtle/default/strong | `rgba(237,242,255,.06 / .09 / .13 / .22)` |
| text primary/secondary/tertiary/quaternary | `#eceef3` / `#b9bfcc` / `#868d9e` / `#5f6678` |
| accent / hover / soft | `#5b8cff` / `#76a0ff` / `rgba(91,140,255,.14)` |

### 语义色（status dot / priority）

| 语义 | Light | Dark |
|---|---|---|
| todo 待开始 | `#94a3b8` | `#8b93a3` |
| doing 进行中 | `#2563eb` | `#5b8cff` |
| paused 暂停 | `#d97706` | `#f0a23b` |
| done 完成 | `#16a34a` | `#3ecb7a` |
| blocked 阻塞 | `#dc2626` | `#ff6b6b` |
| P0 / P1 / P2 / P3 | `#dc2626` / `#d97706` / `#2563eb` / `#64748b` | `#ff6b6b` / `#f0a23b` / `#5b8cff` / `#8b93a3` |

## Typography

两族（去掉原 DM Serif Display）：

- **IBM Plex Sans** —— 标题、正文、标签、按钮、品牌字标。
- **IBM Plex Mono** —— 需求 ID（REQ-0007）、计数、键码类小标签。

固定 rem 刻度（product 不用流体字号），步进比 ~1.2：

- display/h1 `20px/600`，h2 `16px/600`，h3 `14px/600`
- body `13–14px/400`，label `12–12.5px/500`，caption/mono `10.5–11px`
- 行高正文 1.55；标题 1.25–1.3；字距标题 -0.01em（不超过 -0.04em 下限）。

## Spacing & Radius

- 间距刻度 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64（`--sp-*`）。
- 圆角：xs 4 / sm 6 / md 10 / lg 14 / pill 999。卡片 ≤10–14px（不过度圆角）。

## Components

每个交互元素具备 default / hover / focus / active / disabled / selected 态。

- **看板列**：列头 = 状态色圆点 + 标签 + 计数 pill，细分隔线（无重彩下划线）；列体为同底色面板。
- **需求卡**：克制 1px 边框，标题前优先级圆点，底部 mono ID + 阻塞/进行角标；hover 仅轻微 surface + 边框变化（**禁** 1px 边框叠 ≥16px 阴影的 ghost-card）；选中态用 accent 边框 + 内描边。**禁** 左侧色条（side-stripe）。
- **导航项**：图标 + 标签 + 可选计数/Soon 标记；active 用 accent-soft 底 + accent 文字。
- **主题切换**：图标按钮，亮→暗→系统循环。
- 加载用骨架 / 轻 Spin；空列给有意义的空状态而非裸 "No issues"。

## Layout

- App = 顶栏（`--toolbar-h` 52px）+ 左导航侧栏（`--sidebar-width` 232px）+ 主内容，三段式 grid，整窗高、内容区滚动。
- 看板 = `grid-template-columns: repeat(4, minmax(0,1fr))`，列内纵向滚动。
- 响应式为结构性：窄屏折叠侧栏、看板降列。

## Motion

- 150–250ms，`ease-out`（exponential 类曲线），仅表达状态/反馈，无编排式入场。
- hover/选中/主题切换为颜色与轻微位移过渡，无 bounce/elastic。
- `@media (prefers-reduced-motion: reduce)` 下全部降为即时或淡入。
