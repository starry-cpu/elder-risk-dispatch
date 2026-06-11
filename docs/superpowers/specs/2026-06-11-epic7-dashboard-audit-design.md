# Epic 7 — Dashboard、AuditLog 与 WebSocket 通知中心设计

> 日期：2026-06-11 | 分支：`epic-7/dashboard-and-audit` | Issue：[#3](https://github.com/starry-cpu/elder-risk-dispatch/issues/3)

## 1. 背景

驾驶舱统计报表、全链路审计日志、实时 WebSocket 推送三合一。支撑异常分布、响应时长/瓶颈分析与管理端回溯，TDD 保障统计口径/权限/实时一致性。

## 2. 目标范围

- **In scope**：Dashboard 四个聚合接口 + 预聚合定时任务、AuditLog 全局拦截器 + 按模块分级接入、WebSocket 实时推送 + 通知中心（落盘/重放）
- **Out of scope**：前端页面实现（归属 Epic 8）、数据清洗/ETL、第三方报表工具集成

---

## 3. Dashboard 驾驶舱报表

### 3.1 模块结构

```
apps/api/src/modules/dashboard/
├── dashboard.module.ts
├── dashboard.controller.ts
├── dashboard.service.ts
├── dashboard.service.spec.ts
├── dashboard.e2e-spec.ts
├── dto/
│   ├── dashboard-query.dto.ts
│   ├── risk-overview.dto.ts
│   ├── work-order-efficiency.dto.ts
│   ├── elder-coverage.dto.ts
│   └── grid-worker-performance.dto.ts
└── processors/
    └── dashboard-aggregate.processor.ts
```

### 3.2 四个聚合接口

| 接口 | 路径 | 说明 |
|------|------|------|
| 风险概览 | `GET /api/v1/dashboard/risk-overview` | 各等级（LOW/MEDIUM/HIGH）/来源（MISSED_CHECKIN/ABNORMAL_TEXT/DEVICE/HISTORY/MANUAL）分布饼图、近 7 天趋势折线图（`period` 参数可选 7d/30d，默认 7d） |
| 工单效率 | `GET /api/v1/dashboard/work-order-efficiency` | 各状态（PENDING/ASSIGNED/IN_PROGRESS/COMPLETED/CANCELLED）积压量、平均响应时长（创建→指派→完成）、各类型（HEALTH/LIFE/REPAIR/ESCORT/COMPANION/ERRAND）占比、超时工单数 |
| 老人覆盖 | `GET /api/v1/dashboard/elder-coverage` | 按片区（district）服务覆盖率、报平安率（今日/本周/异常率）、重点关注老人列表（高服务等级 + 近期高风险） |
| 网格员效能 | `GET /api/v1/dashboard/grid-worker-performance` | 各网格员处理工单数、平均响应时间、在岗状态 |

### 3.3 权限模型

| 角色 | 数据范围 |
|------|---------|
| `ADMIN` | 全量数据 |
| `COMMUNITY_DOCTOR` / `GRID_WORKER` / `PROPERTY` | 仅本片区 |
| `FAMILY` | 仅关联老人 |
| `VOLUNTEER` | 仅关联老人 |

权限逻辑复用现有 `RolesGuard` + 片区/老人绑定关系，各 Service 方法注入 `CurrentUser` 后通过 Prisma where 过滤。

### 3.4 预聚合策略

- BullMQ repeatable job（每小时执行），计算聚合值写入 Redis 缓存（TTL 1h）
- API 优先读 Redis，缓存 miss 时退化为实时 DB 查询（以 `Promise.race` 控制超时 5s）
- 避免 OLAP 查询影响主业务库 OLTP 性能
- 定时任务记录 `SchedulerRun` 日志（复用现有表）

### 3.5 实时查询退避

- 缓存 key 格式：`dashboard:{metric}:{role}:{userId}:{period}`，如 `dashboard:risk-overview:ADMIN:u123:2026-06-11`
- 缓存 miss 后实时查询 Prisma 聚合（`groupBy`、`count`、`avg`），结果回写 Redis
- 查询超时 5s，超时返回 HTTP 202 提示稍后重试

---

## 4. AuditLog 审计日志

### 4.1 模块结构

```
apps/api/src/modules/audit/
├── audit.module.ts
├── audit.service.ts
├── audit.service.spec.ts
├── audit.interceptor.ts
├── audit.interceptor.spec.ts
├── dto/
│   ├── audit-log-query.dto.ts
│   └── audit-log-response.dto.ts
├── decorators/
│   └── auditable.decorator.ts
└── filters/
    └── audit-sensitive.filter.ts
```

### 4.2 架构决策

**拦截器 + 装饰器模式**，不改动业务代码：

```
Controller method 执行
  │
  ├── @Auditable('WORK_ORDER', 'ASSIGN', { resourceIdParam: 'id', sensitiveFields: ['phone'] })
  │
  ├── AuditInterceptor (Post-request)
  │     ├── 从 request context 提取 userId、ip、方法参数
  │     ├── 调用 AuditService.log({ ... })
  │     ├── detail 中敏感字段由 AuditSensitiveFilter 自动脱敏
  │     └── 异步写入，不阻塞响应（try-catch 确保审计失败不打断主流程）
  │
  └── 返回正常响应
```

复用 Prisma 已有 `AuditLog` 模型（userId、action、resourceType、resourceId、detail、ip、createdAt），不新增字段。

### 4.3 按模块分级接入清单

| 优先级 | 模块 | 审计动作 | 触发点 |
|--------|------|---------|--------|
| P0 | Auth | LOGIN / LOGIN_FAILED / LOGOUT | AuthController |
| P0 | Risk | CONFIRM / IGNORE / DISPATCH | RiskController 状态变更 |
| P0 | WorkOrder | ASSIGN / COMPLETE / CANCEL | WorkOrderService 状态流转 |
| P0 | Elder | CREATE / UPDATE / DELETE | ElderController |
| P0 | User | ROLE_CHANGE / ENABLE / DISABLE | UsersController |
| P1 | CheckIn | CREATE（仅 PROXY 代理模式）| CheckInController/Service |
| P1 | Notification | MANUAL_SEND | NotificationsController |

后续模块按需在 Controller 方法上加 `@Auditable` 装饰器即可扩展。

### 4.4 `@Auditable` 装饰器定义

```typescript
@Auditable(resourceType: string, action: string, options?: {
  resourceIdParam?: string;    // 从 request.params 提取资源 ID，默认 'id'
  sensitiveFields?: string[];   // 自动脱敏字段名列表
  logRequestBody?: boolean;     // 是否记录完整请求体，默认 false
})
```

### 4.5 脱敏策略（AuditSensitiveFilter）

| 字段类型 | 规则 | 示例 |
|---------|------|------|
| 手机号 (phone*) | 保留首尾各 1 位 | `1*********2` |
| 身份证 (idCard / idNumber) | 保留后 4 位 | `****************1234` |
| 密码/secret 类 | 完全移除 | `***REDACTED***` |
| 其他字段 | 保持不变 | — |

脱敏发生在 `detail` JSON 写入前，原始值不落库。

### 4.6 审计日志查询

- `GET /api/v1/audit/logs` — 仅 ADMIN 角色可访问
- 查询参数：`userId`, `action`, `resourceType`, `resourceId`, `startDate`, `endDate`, `page`, `limit`
- 响应含分页 meta（total、page、limit）

---

## 5. WebSocket 实时推送 + 通知中心

### 5.1 技术选型

**Socket.IO + Redis Adapter**。不引入 BullMQ 队列用于 WS 推送（Service 层直接调用 gateway.server.emit()），理由：
- 消息触发点分散在多个 Service，各自 emit 比统一走队列简单
- Socket.IO Redis adapter 已解决多实例广播问题
- 落盘（Notification 表）在 emit 同时完成，无需队列重试保障

### 5.2 新增依赖

```json
{
  "@nestjs/websockets": "^11.0.0",
  "@nestjs/platform-socket.io": "^11.0.0",
  "@socket.io/redis-adapter": "^10.0.0"
}
```

### 5.3 架构

```
Service Layer
  ├── RiskService ──── emit('risk:alert', { riskEvent })
  ├── WorkOrderService ─── emit('workorder:update', { status, ... })
  ├── CheckInsService ─── emit('dashboard:change', { summary })
  └── NotificationService ─── emit('notification:new', { notification })
                      │
                      ▼
NotificationService (增强)
  ├── 写 Notification 表（落盘）
  └── gateway.server.emit()（实时广播）
                      │
                      ▼
DashboardGateway (@WebSocketGateway)
  ├── namespace: /dashboard
  ├── Redis Adapter（多实例广播）
  ├── auth: 握手时验证 JWT (query param: auth.token)
  └── rooms: user:{userId}, role:{role}, district:{districtId}
```

### 5.4 模块结构

```
apps/api/src/modules/notifications/
├── notifications.module.ts           # 已有，扩展
├── notifications.service.ts          # 已有，增强 emit() + 查询未读/历史
├── notifications.service.spec.ts
├── gateway/
│   ├── dashboard.gateway.ts          # NEW
│   ├── dashboard.gateway.spec.ts     # NEW
│   ├── ws-auth.guard.ts              # NEW — WS 握手 JWT 验证
│   └── ws-roles.guard.ts             # NEW — WS 房间级角色过滤
├── dto/
│   ├── notification-query.dto.ts     # NEW
│   └── notification-response.dto.ts  # NEW
└── [... 已有文件保留]
```

### 5.5 事件与广播规则

| 事件 | 触发方 | 广播房间 |
|------|--------|---------|
| `risk:alert` — HIGH 级别风险事件 | RiskService | `role:ADMIN` + `district:{该老人片区}` |
| `workorder:update` — 工单状态流转 | WorkOrderService | `user:{assigneeId}` + `user:{creatorId}` + `role:ADMIN` |
| `dashboard:change` — 数据增量更新 | 各变更 Service | `role:ADMIN` |
| `notification:new` — 新通知 | NotificationService | `user:{targetUserId}` |

### 5.6 通知中心 API

| 接口 | 说明 |
|------|------|
| `GET /api/v1/notifications/inbox` | 当前用户通知列表（支持 status/type 过滤 + 分页） |
| `POST /api/v1/notifications/:id/read` | 标记单条已读 |
| `GET /api/v1/notifications/unread-count` | 当前用户未读计数 |

### 5.7 Prisma Schema 变更

```prisma
model Notification {
  // ... 已有字段不变 (id, targetType, targetId, channel, templateId, payload, status, sentAt, createdAt)
  readAt DateTime?  // NEW — 已读时间，NULL 表示未读
}
```

### 5.8 WS 鉴权

- 握手阶段从 `handshake.auth.token` 提取 JWT
- `WsAuthGuard` 验证 token 有效性，无效则 `socket.disconnect()`
- 连接建立后，根据 role 订阅对应房间
- 断开连接时自动清理房间订阅（Socket.IO 原生行为）

### 5.9 落盘与重放

- 所有 `emit()` 同时写入 `Notification` 表（同步异步均可，不阻塞 WebSocket 推送）
- 用户离线：消息持久化在 DB，上线后通过 `/notifications/inbox` 拉取历史
- 用户在线：实时推送 + 同时落盘，保证不丢失
- 重放机制：拉取历史通知时按 `createdAt DESC` 排序，前端可标记已读

---

## 6. 模块依赖图

```
AppModule
├── DashboardModule
│     ├── imports: [RiskModule, WorkOrdersModule, EldersModule, UsersModule]  # 只读依赖
│     └── providers: [DashboardService, DashboardAggregateProcessor]
│
├── AuditModule (Global)
│     ├── imports: [PrismaModule]
│     ├── providers: [AuditService, AuditInterceptor]
│     └── exports: [AuditInterceptor, Auditable decorator]
│
└── NotificationsModule (增强)
      ├── imports: [PrismaModule, BullModule]
      ├── providers: [NotificationService, DashboardGateway, WsAuthGuard, WsRolesGuard]
      └── exports: [NotificationService]  # 其他模块注入用于 emit
```

无循环依赖：
- DashboardModule → 只读依赖 Risk/WorkOrders/Elders/Users
- AuditModule → 仅依赖 PrismaModule，被所有需要审计的模块 import
- NotificationsModule → 被其他模块 import 用于 emit，依赖 PrismaModule

---

## 7. 测试策略

### 7.1 Dashboard

| # | 场景 | 测试类型 |
|---|------|----------|
| 1 | 各角色/权限下数据范围正确 | 单元 |
| 2 | 缓存 miss 时实时查询降级 | 单元 |
| 3 | 预聚合定时任务正确写入 Redis | 单元（mock BullMQ） |
| 4 | 四个接口全角色 E2E | 集成 |
| 5 | 空数据/边界值（无老人/无工单）响应正确 | 单元 |

### 7.2 AuditLog

| # | 场景 | 测试类型 |
|---|------|----------|
| 1 | `@Auditable` 装饰器元数据正确提取 | 单元 |
| 2 | AuditInterceptor 正常写入 AuditLog | 单元（mock Prisma） |
| 3 | 敏感字段脱敏正确（手机号、身份证、密码） | 单元 |
| 4 | 审计写入失败不阻塞业务响应 | 单元 |
| 5 | P0 模块全链路审计（登录→风险确认→工单指派） | 集成 |
| 6 | 非 ADMIN 角色无法查询审计日志 | 集成 |

### 7.3 WebSocket / 通知中心

| # | 场景 | 测试类型 |
|---|------|----------|
| 1 | WS 握手 JWT 有效/无效 | 单元（mock socket handshake） |
| 2 | 各角色加入正确房间 | 单元 |
| 3 | 事件广播落地到 Notification 表 | 单元 |
| 4 | 通知中心查询/标记已读/未读计数 | 单元 |
| 5 | 全链路 WS 连接→事件→落盘→拉取历史 | 集成 |
| 6 | 多角色房间隔离（GRID_WORKER 不收到 ADMIN 专属事件） | 集成 |

---

## 8. 文件变更清单

| 文件 | 操作 | 说明 |
|------|------|------|
| `apps/api/prisma/schema.prisma` | 修改 | Notification 表加 `readAt` 字段 |
| `apps/api/src/modules/dashboard/*` | **新增** | Dashboard 模块全部文件 |
| `apps/api/src/modules/audit/*` | **新增** | Audit 模块全部文件 |
| `apps/api/src/modules/notifications/gateway/*` | **新增** | WebSocket Gateway + Guards |
| `apps/api/src/modules/notifications/notifications.service.ts` | 修改 | 增强 emit() + 新增通知中心查询方法 |
| `apps/api/src/modules/notifications/notifications.module.ts` | 修改 | 注册 Gateway、导出 NotificationService |
| `apps/api/src/app.module.ts` | 修改 | 注册 DashboardModule、AuditModule |
| `apps/api/src/modules/auth/auth.controller.ts` | 修改 | 加 `@Auditable` 装饰器（LOGIN/LOGOUT） |
| `apps/api/src/modules/risk/risk.controller.ts` | 修改 | 加 `@Auditable` 装饰器（CONFIRM/IGNORE/DISPATCH） |
| `apps/api/src/modules/work-orders/work-orders.controller.ts` | 修改 | 加 `@Auditable` 装饰器（ASSIGN/COMPLETE/CANCEL） |
| `apps/api/src/modules/elders/elders.controller.ts` | 修改 | 加 `@Auditable` 装饰器（CREATE/UPDATE/DELETE） |
| `apps/api/src/modules/users/users.controller.ts` | 修改 | 加 `@Auditable` 装饰器（ROLE_CHANGE/ENABLE/DISABLE） |
| `apps/api/package.json` | 修改 | 加 socket.io 依赖 |

---

## 9. 验收标准

- [ ] Dashboard 四个接口返回数据准确、权限隔离正确（ADMIN 全量 vs 片区限制 vs 家属绑定）
- [ ] 预聚合定时任务正常运行，缓存命中后响应 < 100ms
- [ ] P0 审计接入模块（Auth/Risk/WorkOrder/Elder/User）所有写操作有迹可循
- [ ] 敏感字段（手机号、身份证）在 AuditLog.detail 中正确脱敏
- [ ] 审计写入失败不阻塞业务主流程
- [ ] WebSocket 连接建立、断线重连正常
- [ ] 各事件按角色/房间正确推送，无越权广播
- [ ] 通知落盘 + 已读/未读 + 历史拉取完整
- [ ] 所有新增测试通过，Dashboard/Audit/WS 覆盖率 ≥ 80%
- [ ] CI 不打真实 Redis/WS 连接（mock 隔离）
