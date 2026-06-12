# Epic 8 前端三端设计规格

> 对应 GitHub Issue [#2](https://github.com/starry-cpu/elder-risk-dispatch/issues/2)
> 设计日期：2026-06-12
> 分支：`epic-8/frontend-three-platforms`

---

## 1. 概述

### 1.1 背景

后端 API（Epics 1-7）已完成，包括鉴权、用户、老人、报平安、巡访、设备、风险引擎、工单、AI、通知、驾驶舱和审计模块。Epic 8 在此基础上构建三个前端平台。

### 1.2 交付范围

| 端 | 技术 | 用户角色 | 交付策略 |
|---|---|---|---|
| 老人/家属端 | uni-app (Vue 3 + wot-design-uni) | 老人、家属 | subpackage `pagesElder/` |
| 网格员/协同端 | uni-app (Vue 3 + wot-design-uni) | 网格员、社区医生、物业、志愿者 | subpackage `pagesWorker/` |
| 后台管理端 | Vue 3 + Element Plus + ECharts + UnoCSS | 社区管理者/管理员 | 完整管理 SPA |

**整体交付**：三端全部在一个 Epic 内完成，管理端核心页面完整做（驾驶舱/预警/工单/档案），辅助页面简化版（规则配置/人员排班/审计日志）。

### 1.3 技术决策

| 决策 | 选择 |
|---|---|
| 小程序架构 | 单一 uni-app 项目，通过 subpackage 隔离角色（`pagesElder/` / `pagesWorker/`） |
| 管理端起点 | 参考成熟 Vue3 管理模板（如 vue-pure-admin 风格）起步，剥离后适配 |
| 类型安全 | 后端唯一真相源 → `openapi-typescript` 从 Swagger JSON 自动生成 TS 类型到 `packages/shared-types/` → 两端消费 |
| UI 设计 | 参考现有开源模板，按需求定制 |

---

## 2. 整体架构

```
elder-risk-dispatch/
├── apps/
│   ├── api/                          # ✅ 已完成 (Epics 1-7)
│   ├── admin/                        # 🆕 Vue3 管理端
│   │   ├── src/
│   │   │   ├── views/                # 页面 (驾驶舱/预警/工单/档案/规则/人员/审计)
│   │   │   ├── components/           # 共享组件 (表格/图表/布局)
│   │   │   ├── stores/               # Pinia store (per domain)
│   │   │   ├── composables/          # 纯 TS 逻辑 (usePagination, useWebSocket...)
│   │   │   ├── router/               # 路由 + 权限守卫
│   │   │   ├── api/                  # Axios 封装 + 按域拆分
│   │   │   └── styles/               # UnoCSS 配置 + 全局变量
│   │   └── e2e/                      # Playwright E2E
│   └── miniapp/                      # 🆕 uni-app 小程序
│       ├── src/
│       │   ├── pagesElder/           # subpackage: 老人/家属页
│       │   │   ├── check-in/         # 一键报平安
│       │   │   ├── sos/              # 语音求助
│       │   │   └── order-progress/   # 工单进度查看
│       │   ├── pagesWorker/          # subpackage: 网格员/协同页
│       │   │   ├── risk-tasks/       # 风险待办列表
│       │   │   ├── visit-form/       # 巡访表单 (拍照+定位)
│       │   │   ├── work-order/       # 工单处理流程
│       │   │   └── verification/     # 电话核实记录
│       │   ├── composables/          # 纯 TS 业务逻辑 (TDD)
│       │   ├── stores/               # Pinia store
│       │   ├── api/                  # luch-request 封装
│       │   └── styles/               # 角色主题变量
│       └── __tests__/                # Vitest 单测
├── packages/
│   ├── shared-types/                 # 🆕 openapi-typescript 自动生成
│   │   ├── generate.mjs              # 生成脚本 (读 Swagger JSON → TS types)
│   │   └── index.ts                  # 输出的纯净接口
│   └── shared-validation/            # 已有，可复用
└── docker/
    └── docker-compose.yml
```

### 2.1 关键设计原则

| 原则 | 说明 |
|---|---|
| **API 层统一** | 两端的 HTTP 层都从 `@care/shared-types` 导入类型，API 调用签名类型安全 |
| **逻辑下沉** | composable/store 不依赖 `uni` 或 DOM，纯 TS 可单独单测 |
| **角色隔离** | 小程序通过 uni-app subpackage 条件编译，编译产物按 role 分离 |
| **类型生成** | `openapi-typescript` 脚本从 `http://localhost:3000/api/docs-json` 拉取 OpenAPI JSON 生成 TS 类型到 `shared-types/src/index.ts` |

---

## 3. 小程序端（uni-app）

### 3.1 页面路由

**老人/家属 subpackage (`pagesElder/`)：**

| 页面 | 路径 | 核心功能 | 交互特征 |
|---|---|---|---|
| 一键报平安 | `pagesElder/check-in/index` | 大按钮一键提交 + 语音输入 fallback | 大字号(≥36rpx)、大触控区 |
| 语音求助 | `pagesElder/sos/index` | 录音 → 上传 → 自动生成 RiskEvent | 长按录音，松开发送 |
| 工单进度 | `pagesElder/order-progress/index` | 查看与自己关联老人的工单进度 | 时间线展示，状态图标化 |

**网格员/协同 subpackage (`pagesWorker/`)：**

| 页面 | 路径 | 核心功能 |
|---|---|---|
| 风险待办列表 | `pagesWorker/risk-tasks/index` | 按优先级排序，筛选/搜索，点击进复核 |
| 风险复核 | `pagesWorker/risk-tasks/review` | 确认/忽略操作 + 备注 |
| 巡访表单 | `pagesWorker/visit-form/index` | 拍照(调相机)、自动定位、填写观察记录 |
| 巡访记录 | `pagesWorker/visit-form/records` | 历史巡访列表，按老人筛选 |
| 工单列表 | `pagesWorker/work-order/list` | 待接单/进行中/已完成 tab 切换 |
| 工单详情 | `pagesWorker/work-order/detail` | 状态流转操作(接单→到达→完成)、拍照上传、时间线 |
| 电话核实 | `pagesWorker/verification/index` | 快速记录通话结果 |

### 3.2 Composable 逻辑层（TDD 先行）

| Composable | 职责 | 测试重点 |
|---|---|---|
| `useCheckIn` | 报平安提交状态机、输入校验 | 正常提交 / 空内容拒绝 / 语音 URL 校验 |
| `useSosVoice` | 录音状态管理、上传流程 | 录音权限拒绝 / 上传失败重试 |
| `useRiskTaskList` | 待办排序(优先级→时间)、筛选 | 排序正确性 / 状态筛选 |
| `useVisitForm` | 表单校验(必填项)、定位获取、照片列表管理 | 必填校验 / 定位失败降级 |
| `useWorkOrderFlow` | 工单状态机映射(当前态→可用操作)、流转校验 | 非法转换拒绝 / 必填字段校验 |
| `useOrderProgress` | 家人视角的工单时间线格式化为可展示结构 | 状态映射 / 空状态处理 |

**设计原则**：组件层只做两件事 — (1) 调用 composable 取数据/方法 (2) 渲染。业务判断完全在 composable 内。

### 3.3 API 层

```
src/api/
├── client.ts                 # luch-request 封装：JWT 拦截、错误统一处理
├── elders.ts                 # 老人档案相关 API
├── check-ins.ts              # 报平安
├── visits.ts                 # 巡访
├── risk.ts                   # 风险事件/复核
├── work-orders.ts            # 工单
├── notifications.ts          # 通知/订阅
└── upload.ts                 # 文件/语音上传 (预签名 URL)
```

所有接口的 request/response 类型从 `@care/shared-types` 导入。

---

## 4. 管理端（Vue 3 + Element Plus）

### 4.1 页面与路由

```
/admin/
├── login                          # 手机号+密码登录
├── dashboard                      # 驾驶舱 (4 图表卡片)
├── elders/
│   ├── index                      # 老人列表 + 搜索/筛选
│   └── [id]                       # 老人详情 + 风险画像
├── risk/
│   └── index                      # 预警中心：待复核列表 + 操作抽屉
├── work-orders/
│   └── index                      # 工单管理：列表 + 派单/改派弹窗
├── rules/
│   └── index                      # 风险规则：表格 CRUD (简化版)
├── users/
│   └── index                      # 人员与排班：列表 + 角色/片区编辑 (简化版)
└── audit/
    └── index                      # 审计日志：列表 + 筛选 (简化版)
```

### 4.2 页面详细设计

**驾驶舱 Dashboard**（核心入口页）
- 顶部 4 张数字卡片：重点老人数、待处理预警数、今日工单完成率、差评数
- 图表区（ECharts）：风险分布饼图、响应时长趋势线、片区热力图、高发问题柱状图
- WebSocket 实时推送新预警（右上角 Badge + 列表弹窗）

**老人档案管理**
- 表格列：姓名、性别、年龄、片区、健康标签、服务等级、最近报平安时间
- 筛选：片区下拉、服务等级下拉、搜索框
- 详情抽屉：基本信息 + 紧急联系人 + 风险画像时间线（最近 RiskEvent）

**预警中心**
- 表格：等级色标（MEDIUM 黄 / HIGH 红）、老人、来源、分数、原因、状态、时间
- 操作：确认/忽略（HIGH 必须填写复核备注）
- WebSocket 实时追加新预警到表格顶部

**工单管理**
- 表格：工单号、老人、类型、等级、状态、负责人、截止时间
- 操作：派单弹窗（推荐列表 → 选定）、改派弹窗（记录原因）、查看流转时间线

**简化版页面**（表格 + 基础 CRUD，不做复杂交互）
- 规则配置：表格 → 新增/编辑弹窗（条件 JSON 用 textarea 输入）
- 人员排班：表格 → 新增/编辑弹窗（角色/技能/片区/在岗状态）
- 审计日志：表格 → 按时间/操作类型/资源类型筛选

### 4.3 组件树

```
components/
├── layout/
│   ├── AppLayout.vue           # 侧边栏 + 顶栏 + 内容区
│   └── SidebarMenu.vue          # 菜单 (按角色过滤)
├── common/
│   ├── StatCard.vue             # 数字卡片
│   ├── ChartCard.vue            # 图表容器 (标题+ECharts)
│   └── ConfirmDialog.vue        # 确认弹窗封装
├── elders/
│   ├── ElderTable.vue           # 老人表格
│   └── ElderDetailDrawer.vue    # 详情抽屉
├── risk/
│   ├── RiskTable.vue            # 预警表格
│   └── ReviewDialog.vue         # 复核弹窗
└── work-orders/
    ├── OrderTable.vue           # 工单表格
    ├── AssignDialog.vue         # 派单弹窗 (含推荐列表)
    └── TimelinePopover.vue      # 流转时间线
```

### 4.4 Stores（Pinia）

| Store | 职责 |
|---|---|
| `useAuthStore` | 登录态、token、角色、持久化（pinia-plugin-persistedstate） |
| `useDashboardStore` | 驾驶舱数据、WebSocket 连接 |
| `useElderStore` | 老人列表缓存、分页 |
| `useRiskStore` | 预警列表、实时追加 |
| `useWorkOrderStore` | 工单列表、派单状态 |
| `useUserStore` | 人员列表（简化版） |

### 4.5 API 层

```
api/
├── client.ts                   # Axios: JWT 拦截、401 跳登录、响应解包
├── auth.ts                     # 登录/me
├── dashboard.ts                # 驾驶舱聚合接口
├── elders.ts                   # 老人 CRUD + 风险画像
├── risk.ts                     # 预警 + 复核
├── work-orders.ts              # 工单 + 派单/改派
├── rules.ts                    # 规则 CRUD
├── users.ts                    # 人员 CRUD
└── audit.ts                    # 审计日志
```

### 4.6 WebSocket 连接

`composables/useWebSocket.ts`：
- 连接 `/dashboard` namespace (socket.io)
- 监听 `risk:new` 事件 → 更新 `useRiskStore` + Browser Notification
- 自动重连 + token 过期断连

---

## 5. shared-types 自动化生成

### 5.1 生成流水线

```
[apps/api]  NestJS Swagger 装饰器
     │
     ▼
  http://localhost:3000/api/docs-json   (OpenAPI 3.0 JSON)
     │
     ▼  packages/shared-types/generate.mjs
     │  npx openapi-typescript <url> -o src/index.ts
     │
     ▼
  packages/shared-types/src/index.ts   (纯净 TS interface/type，已提交到仓库)
     │
     ├──▶  apps/admin     import type { ... } from '@care/shared-types'
     └──▶  apps/miniapp   import type { ... } from '@care/shared-types'
```

### 5.2 generate.mjs 脚本逻辑

1. 从后端地址 `http://localhost:3000/api/docs-json` 拉取 OpenAPI JSON
2. 调用 `openapi-typescript` 生成 TS 类型
3. 输出到 `packages/shared-types/src/index.ts`（已提交到仓库，clean checkout 可用）
4. npm script: `"generate:types"` → `pnpm --filter @care/shared-types generate`

### 5.3 CI 集成

在类型生成后增加一步 `tsc --noEmit` 校验三个端对 `shared-types` 的消费没有类型错误。

---

## 6. 测试策略

### 6.1 测试矩阵

| 层 | 工具 | 覆盖目标 | 内容 |
|---|---|---|---|
| miniapp composable | Vitest + jsdom | ≥ 80% | 每个 composable 正常/边界/异常路径 |
| miniapp store | Vitest + pinia-testing | ≥ 80% | store action/state 变更 |
| admin composable | Vitest | ≥ 80% | usePagination, useWebSocket 等 |
| admin store | Vitest + pinia-testing | ≥ 80% | 每个 store 的 action/getter |
| admin component | @vue/test-utils + jsdom | 关键组件 | 表格渲染、弹窗交互 |
| admin E2E | Playwright | 关键流程 | 登录→驾驶舱→预警复核→派单 全链路 |

### 6.2 不需要测试的

- 纯渲染/样式/动画
- 第三方组件库内部逻辑
- uni-app 页面组件（仅做绑定渲染，逻辑在 composable 中覆盖）

### 6.3 页面与逻辑分离

```
miniapp/
├── src/
│   ├── pagesElder/    ← 不做单测（纯渲染）
│   ├── pagesWorker/   ← 不做单测（纯渲染）
│   ├── composables/   ← ✅ Vitest 全覆盖
│   └── stores/        ← ✅ Vitest 全覆盖

admin/
├── src/
│   ├── views/         ← 不做单测（纯渲染）
│   ├── components/    ← 关键组件 @vue/test-utils
│   ├── composables/   ← ✅ Vitest 全覆盖
│   ├── stores/        ← ✅ Vitest 全覆盖
│   └── e2e/           ← ✅ Playwright 关键流程
```

---

## 7. 开发顺序（推荐）

| 阶段 | 内容 | 依赖 |
|---|---|---|
| 1 | 脚手架：`shared-types` 生成流水线、admin/miniapp 项目骨架、lint/tsconfig | 无 |
| 2 | admin 核心页面：驾驶舱 + 预警 + 工单 + 档案 | shared-types, 后端 API |
| 3 | admin 简化页面：规则/人员/审计 + 登录 + 路由守卫 | 阶段 2 |
| 4 | miniapp 网格员端 composable + store + 页面 | shared-types, 后端 API |
| 5 | miniapp 老人端 composable + store + 页面 | 阶段 4 |
| 6 | admin E2E Playwright 流程 | 阶段 3 |
| 7 | miniapp composable/store 单测验证 | 阶段 4-5 |
| 8 | 联调、收尾 | 全部 |

---

## 8. Definition of Done

1. 三端所有页面可访问，核心流程走通
2. composable/store 单测覆盖率 ≥ 80%
3. 管理端关键流程 Playwright E2E 通过
4. `shared-types` 生成命令可正常运行
5. 三个端的 TypeScript 编译无错误
6. 组件无业务逻辑（逻辑完全在 composable/store 内）
