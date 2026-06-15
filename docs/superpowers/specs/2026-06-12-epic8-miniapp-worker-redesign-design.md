# Epic 8 小程序工作人员端视觉重设计规格

> 补充 [epic8-frontend-three-platforms-design](./2026-06-12-epic8-frontend-three-platforms-design.md)
> 设计日期：2026-06-12
> 分支：`epic-8/frontend-three-platforms`

---

## 1. 概述

对 `apps/miniapp/src/pagesWorker/` 下 7 个页面进行全面视觉重设计，同步修复功能 Bug 并补充缺失功能。

### 1.1 审美方向

**「克制的人文工具」** — 温润、可靠、不喧哗。像一个用久了的木柄工具。

- **主导色**：鼠尾草绿 `#7A8B6E`，占 60% 视觉面积
- **点缀色**：陶土 `#C4856B`，严格 <8% 面积，仅用于高风险和不可逆操作
- **底色**：亚麻暖白 `#F7F3ED`，叠加 CSS 噪点模拟纸张触感
- **核心原则**：少即是多。一个页面只出现 3 种字重、4 种字号。内容决定高度，不强行对齐。

### 1.2 反 AI 感措施

| AI 感特征 | 替代方案 |
|-----------|---------|
| 圆角卡片 + 弥散阴影 | 微圆角(12rpx) + 底部 1rpx 细线 + 极轻阴影 |
| 紫色/蓝色渐变 | 纯色，无渐变 |
| 大 emoji 图标 | 纯文字标签 + 语义色彩点 |
| 均匀间距 | 有意的不对称留白 |
| 所有卡片等高 | 内容决定高度 |

### 1.3 组件策略

| 组件 | 策略 | 理由 |
|------|------|------|
| AppButton | 自建 | 视觉门面 |
| AppCard | 自建 | 页面核心单元 |
| AppTag | 自建 | wd-tag 色彩太重 |
| AppStatusDot | 自建 | wot 无此组件 |
| AppEmpty | 自建 | wot 无此组件 |
| AppNavbar | 自建 | uni-app 原生导航栏无法自定义样式 |
| wd-tabs | 复用 + 覆盖样式 | 交互复杂 |
| wd-picker | 复用 | 微信小程序原生弹窗 |
| wd-timeline | 复用 + 覆盖样式 | 结构复杂 |
| wd-message-box | 复用 | 弹窗交互复杂 |
| wd-textarea | 复用 + 覆盖样式 | 功能组件 |
| wd-input | 复用 + 覆盖样式 | 功能组件 |

---

## 2. 设计令牌

### 2.1 色彩体系

```scss
// 背景层
$color-canvas:    #F7F3ED;  // 页面底色，亚麻暖白
$color-surface:   #FEFDFB;  // 卡片表面
$color-surface-warm: #FDFAF5; // 暖调表面

// 文字层
$color-text:      #2C2B29;  // 深炭主文字
$color-text-secondary: #6B6760; // 暖灰辅助文字
$color-text-tertiary: #9E9990; // 浅暖灰占位/禁用
$color-text-inverse: #FEFDFB; // 反色文字

// 品牌色
$color-brand:     #7A8B6E;  // 鼠尾草绿 — 主按钮、标题强调
$color-brand-light: #E9EDE4; // 浅鼠尾草 — 标签背景、选中态
$color-brand-strong: #5A6B52; // 深鼠尾草 — 按下态

// 强调色
$color-accent:    #C4856B;  // 陶土 — 重要提醒、高风险
$color-accent-light: #F5EBE4; // 浅陶土 — 风险标签背景
$color-accent-strong: #A86B53; // 深陶土 — 高风险文字

// 功能色
$color-success:   #7A9A6E;  // 柔和绿
$color-warning:   #C49B5E;  // 暖琥珀
$color-error:     #C4706B;  // 柔和红
$color-info:      #6E8A9A;  // 雾蓝

// 边框/分割
$color-border:    #E8E3DA;  // 暖调边框
$color-border-light: #F0ECE5; // 浅分割
```

### 2.2 排版层级（4 级制）

```scss
$text-detail: 22rpx;  // 辅助信息、时间戳
$text-body:   28rpx;  // 正文
$text-title:  32rpx;  // 卡片标题
$text-hero:   40rpx;  // 关键数字/状态

$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-bold:   600;

$line-height-tight:  1.3;  // 标题
$line-height-normal: 1.6;  // 正文
$line-height-relaxed: 1.8; // 长文本
```

### 2.3 间距（4 级制）

```scss
$space-tight:   12rpx;
$space-base:    20rpx;
$space-wide:    32rpx;
$space-section: 48rpx;
```

### 2.4 圆角（3 级制）

```scss
$radius-tag:  6rpx;   // 标签、小按钮
$radius-card: 12rpx;  // 卡片、输入框
$radius-pill: 9999rpx; // 胶囊按钮、状态点
```

### 2.5 阴影（极克制）

```scss
$shadow-card:  0 1rpx 0 $color-border; // 底部细线模拟纸张叠放
$shadow-raised: 0 2rpx 12rpx rgba(44,43,41,0.04); // 极轻浮起
```

---

## 3. 组件规格

### 3.1 AppButton

```
Props:
  type: 'primary' | 'secondary' | 'text' | 'danger'
  size: 'full' | 'auto' | 'compact'
  disabled: boolean
  loading: boolean

样式：
  primary:  $color-brand 填充, $color-text 文字, 字重 500
  secondary: 1.5px $color-border 边框, 透明背景
  text: $color-text-secondary 文字, 无背景无边框
  danger: $color-accent 填充, 白色文字

  全宽: width 100%, height 88rpx (表单提交)
  随内容: padding 24rpx 32rpx, height 64rpx (卡片内操作)
  紧凑: padding 16rpx 24rpx, height 48rpx (标签旁操作)

  按下态: filter brightness(0.92)
  禁用态: opacity 0.45
```

### 3.2 AppCard

```
Props:
  accentColor: string  // 左边缘色条颜色
  clickable: boolean

样式：
  白色表面 + 底部 1rpx 暖色细线
  左边缘 4rpx 宽色条（按优先级/状态变色）
  圆角 $radius-card
  内边距 $space-base
  卡片间距 $space-base
  不使用圆角弥散阴影
```

### 3.3 AppTag

```
Props:
  level: 'high' | 'medium' | 'low'

样式：
  圆角 $radius-tag (6rpx)
  文字 $text-detail (22rpx)
  内边距 4rpx 12rpx

  high:   $color-accent-light 背景, $color-accent-strong 文字
  medium: $color-warning-light 背景, $color-warning-strong 文字
  low:    $color-info-light 背景, $color-info-strong 文字
```

### 3.4 AppStatusDot

```
Props:
  status: 'high' | 'medium' | 'low' | 'success' | 'info'
  filled: boolean

样式：
  12rpx 直径圆点
  颜色按 status 映射
  filled=false 为空心圆
```

### 3.5 AppEmpty

```
Props:
  message: string
  hint: string
  actionLabel?: string
  actionRoute?: string

样式：
  垂直居中
  message: $text-title, $color-text
  hint: $text-body, $color-text-secondary
  action: AppButton text 样式
```

### 3.6 AppNavbar

```
样式：
  白色背景（无底色、无阴影、无品牌 Logo）
  标题居中，字重 500，$text-title
  底部 1rpx $color-border 分割线
  返回箭头左侧
```

---

## 4. 页面布局

### 4.1 风险待办列表 `risk-tasks/index`

```
顶部筛选器：单行文字 + 下箭头，点击弹出 wd-picker
  选项：全部 / HIGH / MEDIUM / LOW

列表卡片 (AppCard):
  [左边缘色条] ● 等级英文 风险标题
                老人姓名 · 性别 · 年龄
                评分 XX · 触发原因（单行截断）
                时间戳（右对齐）     [去处理 按钮]

底部哨兵：已加载全部 / 加载中...
空状态：AppEmpty ("暂无待处理风险")
```

### 4.2 风险复核 `risk-tasks/review`

```
HEADER: 等级 + 风险标题（无卡片包裹）
DIVIDER
详情区（label: value 两列，label 用 $color-text-tertiary）:
  触发老人 / 风险评分 / 触发来源 / 触发时间 / 风险描述
DIVIDER
复核备注: 底部线型 textarea（至少 5 行）
  占位文字："请记录您的复核意见..."
  若 HIGH 级别，必填
操作区:
  [确认预警] primary full (主操作)
  忽略预警 text (次要操作，降低误触)
```

### 4.3 巡访记录表单 `visit-form/index`

```
老人信息区:
  输入老人编号或姓名 (底部线型 input)

巡访观察区:
  多行 textarea（至少 6 行）
  占位文字："记录巡访中观察到的情况..."

现场照片区:
  3 列网格，每格 160rpx 见方
  添加按钮：虚线边框
  已添加照片：无边距叠加
  最多 9 张

补充说明区:
  多行 textarea（3 行高度）

底部固定:
  [提交巡访记录] primary full
```

### 4.4 巡访历史 `visit-form/records`

```
列表卡片 (AppCard):
  老人姓名（$text-title, 字重 500）
  时间戳（右对齐, $text-detail）
  内容摘要（最多 3 行截断, $text-body）
  照片数量（如有）

底部哨兵：没有更多记录了
空状态：AppEmpty ("暂无巡访记录")
```

### 4.5 工单列表 `work-order/list`

```
wd-tabs: 待处理 / 进行中 / 已完成
  激活态：4rpx $color-brand 下划线，无背景色块

列表卡片 (AppCard):
  [状态圆点] 工单标题 + 老人姓名·年龄
             优先级
             创建/完成时间（右对齐）  [操作按钮]

  待处理 tab: ● 暖琥珀 / 按钮文案"开始处理"
  进行中 tab: ● 雾蓝   / 按钮文案"继续处理"
  已完成 tab: ● 鼠尾草绿 / 按钮文案"查看详情"(secondary)
             显示完成时间而非创建时间

空 tab: AppEmpty
```

### 4.6 工单详情 `work-order/detail`

```
状态指示: ● 状态文字（页面顶部，醒目但不夸张）

工单标题（$text-hero）

信息区（label: value 两列）:
  关联老人 / 优先级 / 负责人 / 创建时间 / 开始时间

DIVIDER + "处理记录"

wd-timeline (覆盖样式):
  圆点颜色匹配状态
  连接线 $color-border

底部固定操作区:
  [完成处理] primary full
  取消工单 danger text (次要)
```

### 4.7 电话核实 `verification/index`

```
老人信息区:
  输入老人编号或姓名 (底部线型 input)

核实结果区:
  多行 textarea（6 行）
  占位文字："记录电话核实的内容和结果..."

底部固定:
  [提交核实记录] primary full

提交时自动添加 [电话核实] 前缀（保留现有逻辑）
```

---

## 5. 功能修复与补充

### 5.1 首页路由分发 `pages/index/index`

```
检查 auth.user.role:
  isWorker → 跳转 pagesWorker/risk-tasks/index
  isElder → 跳转 pagesElder/check-in/index
  未登录 → 触发微信登录
```

### 5.2 API 调用一致性

将所有页面中直接使用 `uni.request` 的调用替换为对应的 API 客户端模块：

| 页面 | 当前方式 | 改为 |
|------|---------|------|
| risk-tasks/index | `uni.request` | `riskApi.listEvents` |
| risk-tasks/review | `uni.request` | `riskApi.review` |
| visit-form/index | `uni.request` | `visitsApi.create` |
| visit-form/records | `uni.request` | `visitsApi.list` |
| work-order/list | `workOrdersApi.list` ✅ | 保持不变 |
| work-order/detail | `uni.request` | `workOrdersApi.getById` / `workOrdersApi.start` / `workOrdersApi.complete` |
| verification/index | `uni.request` | `visitsApi.create` |

### 5.3 加载/空/错误状态

每个数据获取页面必须处理三种状态：

```
加载中: 页面级 loading（非全屏 spinner，区域骨架屏或文字提示）
空数据: AppEmpty 组件
错误: 顶部 toast "加载失败，下拉重试" + 手动下拉刷新
```

### 5.4 角色权限守卫

在页面 `onLoad` 中检查 `auth.isWorker`：
- 非工作人员访问 worker 页面 → redirect 到首页
- 非老人/家属访问 elder 页面 → redirect 到首页

---

## 6. 文件结构变更

```
apps/miniapp/src/
├── components/                  # 🆕 自建组件目录
│   ├── AppButton.vue
│   ├── AppCard.vue
│   ├── AppTag.vue
│   ├── AppStatusDot.vue
│   ├── AppEmpty.vue
│   └── AppNavbar.vue
├── styles/                      # 🆕 全局样式
│   ├── tokens.scss              # 设计令牌（CSS 变量 + SCSS 变量）
│   ├── reset.scss               # 组件库样式覆盖
│   └── global.scss              # 全局工具类
├── pages/
│   └── index/
│       └── index.vue            # 🔧 添加角色路由分发
├── pagesWorker/                 # 🔧 7 个页面视觉重写
│   ├── risk-tasks/
│   │   ├── index.vue
│   │   └── review.vue
│   ├── visit-form/
│   │   ├── index.vue
│   │   └── records.vue
│   ├── work-order/
│   │   ├── list.vue
│   │   └── detail.vue
│   └── verification/
│       └── index.vue
└── uni.scss                     # 🔧 更新设计令牌引用
```

---

## 7. 实现约束

1. **不可变性**：所有状态更新使用展开运算符，不直接修改对象
2. **文件规模**：组件/页面文件 ≤ 400 行，超过则拆分
3. **函数规模**：每个函数 < 50 行
4. **嵌套深度**：模板/逻辑 ≤ 4 层嵌套
5. **零 console.log**：生产代码使用 proper error handling
6. **组件纯渲染**：页面组件只调用 composable + 渲染，不含业务判断
7. **类型安全**：API 调用使用 `@care/shared-types` 中的类型（如已有）

---

## 8. 不在范围内

- 老人端（pagesElder）页面视觉改造
- 管理端（admin）开发
- 新增业务功能（如新页面、新 API）
- wot-design-uni 组件库升级
- E2E 测试编写
