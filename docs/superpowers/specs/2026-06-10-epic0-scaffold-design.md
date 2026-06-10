# Epic 0：工程脚手架设计文档

> 日期：2026-06-10
> 关联：GitHub Issue [#9](https://github.com/starry-cpu/elder-risk-dispatch/issues/9) | DEVELOPMENT_PLAN.md §11 阶段 0

---

## 1. 概述

搭建社区独居老人照护风险预警与服务调度系统的工程脚手架，确保所有后续 Epic 在 TDD 门禁环境下开发。

### 1.1 方案选择

采用 **方案 A：线性搭建**，按依赖顺序逐层构建：

```
Monorepo + pnpm workspace
  → Docker Compose（PG/Redis/MinIO）
    → NestJS 骨架（PrismaService + 异常过滤器 + 拦截器 + Swagger）
      → Prisma schema + migration + seed
        → CI（GitHub Actions）
```

### 1.2 范围边界

- **`apps/api`**（NestJS 后端）：完整搭建
- **`apps/admin`**（Vue3 管理端）与 **`apps/miniapp`**（uni-app 小程序）：仅占位 `package.json`，后续 Epic 填充
- **`packages/shared-types`**：占位

---

## 2. 目录结构

```
care-dispatch-system/
├── pnpm-workspace.yaml
├── package.json                  # root: scripts + devDependencies
├── .npmrc
├── .nvmrc                        # 22
├── .gitignore
├── .prettierrc
├── eslint.config.mjs             # flat config
├── commitlint.config.js
├── tsconfig.base.json            # 共享 TS 配置
├── apps/
│   ├── api/                      # NestJS 后端（完整搭建）
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   ├── nest-cli.json
│   │   ├── src/
│   │   │   ├── main.ts
│   │   │   ├── app.module.ts
│   │   │   ├── common/
│   │   │   │   ├── prisma/
│   │   │   │   │   ├── prisma.module.ts
│   │   │   │   │   └── prisma.service.ts
│   │   │   │   ├── filters/
│   │   │   │   │   └── all-exceptions.filter.ts
│   │   │   │   ├── interceptors/
│   │   │   │   │   └── response.interceptor.ts
│   │   │   │   └── dto/
│   │   │   │       └── api-response.dto.ts
│   │   │   └── modules/
│   │   │       └── health/
│   │   │           ├── health.module.ts
│   │   │           ├── health.controller.ts
│   │   │           └── health.controller.spec.ts
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   └── seed.ts
│   │   └── test/
│   │       ├── app.e2e-spec.ts
│   │       └── jest-e2e.json
│   ├── admin/                    # 占位
│   │   └── package.json
│   └── miniapp/                  # 占位
│       └── package.json
├── packages/
│   └── shared-types/             # 占位
│       ├── package.json
│       └── src/
│           └── index.ts
├── docker/
│   └── docker-compose.yml
└── .github/
    └── workflows/
        └── ci.yml
```

---

## 3. Docker Compose

### 3.1 服务清单

| 服务 | 镜像 | 端口 | 凭证 | 持久化 |
|------|------|------|------|--------|
| postgres | `postgres:16-alpine` | 5432 | `app`:`app`@`care` | `pgdata` volume |
| redis | `redis:7-alpine` | 6379 | — | `redisdata` volume |
| minio | `minio/minio:latest` | 9000 (API), 9001 (Console) | `minioadmin`/`minioadmin` | `miniodata` volume |

### 3.2 MinIO 初始化

通过 `/usr/bin/docker-entrypoint.sh` + `minio-client` 自动创建 `care` bucket。

### 3.3 健康检查

- postgres：`pg_isready`
- redis：`redis-cli ping`
- minio：curl 管理端口

### 3.4 验证方式

```bash
docker compose up -d
docker compose ps   # 三个服务 Up + healthy
```

---

## 4. NestJS 骨架

### 4.1 核心模块

**PrismaModule / PrismaService**
- `@Global()` 模块，全局单例
- `PrismaService extends PrismaClient implements OnModuleInit`
- `onModuleInit()` → `this.$connect()`

**AllExceptionsFilter**
- `implements ExceptionFilter`
- `HttpException` → 取其 status/message 返回
- 未知异常 → `500` + 通用消息，详情感通过 pino 记录
- 响应格式：`{ code: number, data: null, message: string }`

**ResponseInterceptor**
- `implements NestInterceptor`
- 拦截成功响应（`response.statusCode < 400`）
- 包装为 `{ code: 0, data: <response>, message: "ok" }`
- 已包装格式透传

**ApiResponseDto**
```typescript
class ApiResponseDto<T> {
  code: number;
  data?: T;
  message: string;
}
```

### 4.2 Swagger

- `@nestjs/swagger` 8.x
- Title："社区独居老人照护风险预警与服务调度系统"
- 仅在非 production 环境启用
- 路径：`/api/docs`

### 4.3 Health 模块

`GET /api/v1/health`：
- Prisma `$queryRaw` 验证数据库连通性
- 返回 `{ status: "ok", db: true }`
- 作为 E2E 测试的验证入口

### 4.4 技术栈版本

| 包 | 版本 |
|---|------|
| nestjs (core/common/platform-express) | 11.x |
| @nestjs/swagger | 8.x |
| @prisma/client / prisma | 6.x |
| class-validator / class-transformer | 0.14.x / 0.5.x |
| nestjs-pino / pino | 4.x / 9.x |
| @nestjs/throttler | 6.x |
| typescript | 5.7.x |
| ts-jest / jest | 29.x |
| supertest | 7.x |

---

## 5. Prisma Schema + Seed

### 5.1 模型范围

完整的 Prisma schema（来自 DEVELOPMENT_PLAN.md §3），包含全部模型：

- **核心业务**：`User`、`Elder`、`EmergencyContact`、`ElderFamilyLink`
- **数据采集**：`CheckIn`、`VisitRecord`、`DeviceData`
- **风险与工单**：`RiskEvent`、`RiskRule`、`WorkOrder`、`WorkOrderTimeline`
- **评价与审计**：`ServiceEvaluation`、`AiInferenceLog`、`AuditLog`
- **通知**：`Notification`

### 5.2 枚举

```prisma
Role: GRID_WORKER | COMMUNITY_DOCTOR | PROPERTY | VOLUNTEER | ADMIN | FAMILY
DutyStatus: ON_DUTY | OFF_DUTY
ServiceLevel: NORMAL | KEY | HIGH
CheckInMethod: ONE_TAP | VOICE | TEXT | PROXY
CheckInStatus: NORMAL | ABNORMAL | MISSED
RiskLevel: LOW | MEDIUM | HIGH
RiskSource: MISSED_CHECKIN | ABNORMAL_TEXT | DEVICE | HISTORY | MANUAL
RiskStatus: PENDING_REVIEW | CONFIRMED | IGNORED | DISPATCHED
WorkOrderType: HEALTH | LIFE | REPAIR | ESCORT | COMPANION | ERRAND
WorkOrderStatus: PENDING | ASSIGNED | IN_PROGRESS | COMPLETED | CANCELLED
```

### 5.3 Seed 数据

内置 6 条风险规则：

| 规则名称 | 条件 | 权重 | 级别 |
|----------|------|------|------|
| 连续未报平安 | 24h 无 CheckIn | 40 | MEDIUM |
| 设备跌倒报警 | DeviceData.alarm + FALL | 60 | HIGH |
| 烟感/水浸报警 | SMOKE/WATER alarm | 50 | HIGH |
| 异常文本 | AI 分类=求助/异常 | 30 | MEDIUM |
| 高龄+慢病叠加 | age≥80 + healthTags | 15 | MEDIUM |
| 近7天高风险史 | 历史 HIGH 事件 | 10 | MEDIUM |

---

## 6. CI 流水线

### 6.1 触发条件

`push` 和 `pull_request` 到所有分支。

### 6.2 Job 定义

| Job | 命令 | 依赖服务 |
|-----|------|----------|
| **lint** | `pnpm -r lint` | — |
| **test** | `pnpm -r test --coverage` | postgres:16, redis:7 (service containers) |
| **e2e** | `pnpm --filter api test:e2e` | Testcontainers 自启 |
| **build** | `pnpm -r build` | — |

### 6.3 覆盖率门禁

- 后端整体 ≥ 80%
- Epic 0 阶段仅有 Health 模块，门槛自动满足

---

## 7. 首次提交策略

6 个 Conventional Commit，每个可独立通过 CI：

| # | Type | Message | 内容 |
|---|------|---------|------|
| 1 | chore | init pnpm monorepo workspace | root 配置 + ESLint/Prettier/commitlint |
| 2 | chore | add docker compose for pg redis minio | docker-compose.yml + .env.example |
| 3 | test | add failing tests for prisma service and global filters | 先写 RED 测试 |
| 4 | feat | implement nestjs skeleton with prisma, filters, interceptors, swagger | Green 实现 |
| 5 | feat | add prisma schema migration and seed with risk rules | DB 落地 |
| 6 | chore | add ci workflow and readme | CI + README.md |

---

## 8. Definition of Done

- [x] `docker compose up` 可启动所有依赖
- [ ] `docker compose up` 实际验证通过
- [ ] 空 E2E 测试通过（`GET /api/v1/health` → 200）
- [ ] CI 全绿
- [ ] 覆盖率门禁达标
- [ ] README.md 含项目结构与启动说明

---

## 9. 环境要求

| 工具 | 版本 | 状态 |
|------|------|------|
| Node.js | 22.x LTS | ✅ v22.22.1 |
| pnpm | 9.x | ❌ 需 `npm i -g pnpm@9` |
| Docker Desktop | 最新 | ✅ v29.2.0 |
