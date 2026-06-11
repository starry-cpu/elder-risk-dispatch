# Epic 4: 工单与协同调度 — 设计规格

> 对应 GitHub Issue [#6](https://github.com/starry-cpu/elder-risk-dispatch/issues/6)
> 关联开发计划 §11 阶段 4

## 1. 概述

建立工单系统，支撑跨角色协同与标准化处置。实现状态机流转、派单/接单/改派、服务评价及全部历史时间线。TDD 驱动状态变迁规则。

## 2. 模块结构

新增 `WorkOrdersModule` 于 `apps/api/src/modules/work-orders/`：

```
work-orders/
├── work-orders.module.ts
├── work-orders.controller.ts
├── work-orders.controller.spec.ts
├── work-orders.service.ts
├── work-orders.service.spec.ts
├── work-orders.state-machine.ts          # 纯 TS 状态机，无 NestJS 依赖
├── work-orders.state-machine.spec.ts
├── evaluations/
│   ├── evaluations.controller.ts
│   ├── evaluations.controller.spec.ts
│   ├── evaluations.service.ts
│   └── evaluations.service.spec.ts
└── dto/
    ├── create-work-order.dto.ts
    ├── query-work-orders.dto.ts
    ├── assign-work-order.dto.ts
    ├── complete-work-order.dto.ts
    ├── reassign-work-order.dto.ts
    └── create-evaluation.dto.ts
```

**依赖**：
- `PrismaModule` — 数据访问
- `RiskModule` — 导入 `DispatchRecommendationService` 用于派单推荐
- `AuthModule` — JWT + RBAC 守卫（已全局注册）

**无循环依赖**：`RiskModule` 不导入 `WorkOrdersModule`。工单创建时将 `RiskEvent.status` 设为 `DISPATCHED` 由 `WorkOrdersService` 直接通过 Prisma 操作。

## 3. 状态机设计

纯 TypeScript 类 `WorkOrderStateMachine`，无运行时依赖，可独立单元测试。

### 状态

`PENDING → ASSIGNED → IN_PROGRESS → COMPLETED`，外加 `CANCELLED`（终态）

### 允许的状态转移

| 从 | 到 | 条件 |
|---|---|---|
| PENDING | ASSIGNED | `assigneeId` 必须提供 |
| PENDING | CANCELLED | 无额外条件（可选原因） |
| ASSIGNED | IN_PROGRESS | 仅当前接单者可操作 |
| ASSIGNED | CANCELLED | 可选原因 |
| ASSIGNED | ASSIGNED | 改派，必须提供 `reason` |
| IN_PROGRESS | COMPLETED | 必须提供 `result` |
| IN_PROGRESS | CANCELLED | **必须提供 `reason`** |
| COMPLETED | (任意) | ❌ 禁止 — 终态 |
| CANCELLED | (任意) | ❌ 禁止 — 终态 |

### 非法转移（必须抛出错误）

- `PENDING → IN_PROGRESS`（跳过 ASSIGNED）
- `PENDING → COMPLETED`（跳过全部）
- `IN_PROGRESS → PENDING`（回退）
- 从 COMPLETED / CANCELLED 出发的任何转移
- ASSIGNED → IN_PROGRESS 由非接单者操作

### 接口

```typescript
interface TransitionContext {
  isAssignee?: boolean;
  hasReason?: boolean;
}

interface TransitionResult {
  allowed: boolean;
  error?: string;
}

class WorkOrderStateMachine {
  static canTransition(
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    context: TransitionContext
  ): TransitionResult;

  static transition(
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    context: TransitionContext
  ): WorkOrderStatus; // throws BadRequestException on illegal transition
}
```

## 4. API 端点

全部 `/api/v1` 前缀，JWT 鉴权，统一响应 `{ code, data, message }`。

### 4.1 工单 CRUD

| 方法 | 路径 | 说明 | 角色 |
|---|---|---|---|
| `POST` | `/work-orders` | 创建工单，返回派单推荐作为建议 | ADMIN, GRID_WORKER |
| `GET` | `/work-orders` | 分页列表（status/type/district/elderId/assigneeId 过滤） | 全部（按角色范围过滤） |
| `GET` | `/work-orders/:id` | 详情 + 完整时间线 + 评价 | 全部（片区隔离） |

### 4.2 工单操作

| 方法 | 路径 | 说明 | 角色 |
|---|---|---|---|
| `POST` | `/work-orders/:id/assign` | 指定接单人员（操作员确认/覆盖推荐） | ADMIN, GRID_WORKER |
| `POST` | `/work-orders/:id/start` | 开始处理（→ IN_PROGRESS） | 仅接单者 |
| `POST` | `/work-orders/:id/complete` | 提交处理结果（→ COMPLETED） | 仅接单者 |
| `POST` | `/work-orders/:id/cancel` | 取消工单（IN_PROGRESS 须填原因） | ADMIN, GRID_WORKER, 或接单者 |
| `POST` | `/work-orders/:id/reassign` | 改派给其他人员（须填原因，→ ASSIGNED） | ADMIN, GRID_WORKER |

### 4.3 评价

| 方法 | 路径 | 说明 | 角色 |
|---|---|---|---|
| `POST` | `/work-orders/:id/evaluation` | 提交评价（1-5分+评论+标签） | 工单创建者 |
| `GET` | `/work-orders/:id/evaluation` | 查看评价 | 全部（片区隔离） |
| `GET` | `/work-orders/:id/timeline` | 查看完整时间线 | 全部（片区隔离） |

### 4.4 DTO 关键字段

**CreateWorkOrderDto**：
```typescript
{
  elderId: string;            // 必填，老人 ID
  riskEventId?: string;       // 可选，关联风险事件
  type: WorkOrderType;        // 必填，工单类型
  level?: RiskLevel;          // 可选，默认继承自风险事件
  deadline?: string;          // 可选，ISO datetime
  dispatchReason?: string;    // 可选，创建原因
}
```

**AssignWorkOrderDto**：`{ assigneeId: string }`

**CompleteWorkOrderDto**：`{ result: string; photos?: string[] }`

**ReassignWorkOrderDto**：`{ newAssigneeId: string; reason: string }`

**CancelWorkOrderDto**：`{ reason?: string }`

**CreateEvaluationDto**：`{ rating: number; comment?: string; tags?: string[] }`

## 5. 数据流

### 创建流程（最复杂路径）

```
POST /work-orders
  → WorkOrdersService.create()
    → 验证 elder 存在
    → 如果关联 riskEventId，验证风险事件存在且状态为 CONFIRMED
    → 状态机：起始 PENDING
    → 创建 WorkOrder + 初始时间线条目
    → 如果关联 riskEventId，更新 RiskEvent.status → DISPATCHED
    → 调用 DispatchRecommendationService.recommend(riskEventId, type)
    → 返回 { workOrder, recommendation: [...candidates] }
```

### 派单流程

```
POST /work-orders/:id/assign { assigneeId }
  → 验证接单者存在且角色为可接单角色（GRID_WORKER / COMMUNITY_DOCTOR / PROPERTY / VOLUNTEER）
  → 状态机：PENDING → ASSIGNED
  → 更新 assigneeId + 时间线条目
```

### 改派流程

```
POST /work-orders/:id/reassign { newAssigneeId, reason }
  → 验证 reason 非空
  → 验证 newAssigneeId 存在且角色合法
  → 状态机：当前状态 → ASSIGNED（guard: hasReason）
  → 更新 assigneeId + 时间线条目（保留历史上下文）
```

### 完成流程

```
POST /work-orders/:id/complete { result, photos? }
  → 验证请求者为当前接单者
  → 状态机：IN_PROGRESS → COMPLETED（guard: result 非空）
  → 更新 WorkOrder.result + completedAt + 时间线条目
  → 重新计算 User.avgResponseMin
```

### 评价流程

```
POST /work-orders/:id/evaluation { rating, comment?, tags? }
  → 验证请求者为工单创建者
  → 验证工单已 COMPLETED
  → 验证未重复评价（unique workOrderId）
  → 创建 ServiceEvaluation
```

## 6. 错误处理

遵循既有模式（`NotFoundException` / `BadRequestException` / `ForbiddenException`）：

| 场景 | 异常类型 | 消息 |
|---|---|---|
| Elder/风险事件/工单不存在 | `NotFoundException` | 对应实体不存在 |
| 非法状态转移 | `BadRequestException` | 状态机返回的错误描述 |
| 非接单者试图开始/完成 | `ForbiddenException` | "只有接单人员可执行此操作" |
| IN_PROGRESS 取消无原因 | `BadRequestException` | "进行中的工单取消时必须填写原因" |
| 改派无原因 | `BadRequestException` | "改派时必须填写原因" |
| 完成无结果 | `BadRequestException` | "完成工单必须填写处理结果" |
| 重复评价 | `BadRequestException` | "该工单已评价" |
| 未完成即评价 | `BadRequestException` | "仅可对已完成的工单进行评价" |
| 非创建者评价 | `ForbiddenException` | "仅工单创建者可提交评价" |

## 7. 测试策略

### TDD 顺序

1. **`WorkOrderStateMachine`**（纯函数，最先测试）
   - 全部合法转移 → 返回 allowed: true
   - 全部非法转移 → 返回 allowed: false + error
   - 边界：COMPLETED/CANCELLED 作为终态不可再转移
   - 边界：IN_PROGRESS 取消必须提供 reason
   - 边界：非接单者无法 start

2. **`WorkOrdersService`**（集成 Prisma mock）
   - 创建工单 + 推荐返回
   - 各操作成功路径
   - 各操作权限/状态拒绝路径
   - 改派保留时间线
   - 关联风险事件状态同步

3. **`EvaluationsService`**
   - 评价提交成功
   - 重复评价拒绝
   - 未完成工单评价拒绝
   - 非创建者评价拒绝

4. **`WorkOrdersController`** + **`EvaluationsController`**（Supertest E2E）
   - 完整生命周期：创建→派单→接单→开始→完成→评价
   - 改派分支：创建→派单→改派→接单→开始→完成
   - 取消分支：创建→取消 / 创建→派单→取消 / 创建→派单→开始→取消（含原因）
   - 越权测试：非接单者操作被拒
   - 片区隔离：跨片区不可见

### 覆盖率目标

- `WorkOrderStateMachine`：100%（纯函数，全部路径覆盖）
- `WorkOrdersService`：≥ 95%
- 整体 work-orders 模块：≥ 95%

## 8. 不在范围内（YAGNI）

- ❌ BullMQ 定时任务 / 超时升级（Epic 5）
- ❌ 微信订阅消息推送（Epic 5）
- ❌ 前端页面（Epic 8）
- ❌ 自动派单 / 批量派发
- ❌ SLA 追踪 / 响应时间保证
- ❌ AuditLog 审计集成（Epic 7）
- ❌ 工单模板 / 重复工单

## 9. 设计决策记录

- **决策 1**：派单推荐为建议，操作员确认/覆盖后方生效（人机协同，不可全自动）
- **决策 2**：改派重置为 ASSIGNED，保留全部历史时间线供新接单者参考
- **决策 3**：评价与完成解耦，评价可选、可独立提交
- **决策 4**：取消从任意非终态允许，但从 IN_PROGRESS 取消须提供原因
- **决策 5**：状态机实现为纯 TypeScript 类，零框架依赖，保证可测试性
- **决策 6**：复用 `DispatchRecommendationService`（已在 RiskModule 中），无需重复实现
