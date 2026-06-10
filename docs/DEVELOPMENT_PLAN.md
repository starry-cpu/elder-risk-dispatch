# 社区独居老人照护风险预警与服务调度系统 — 开发详细计划（AI 可执行版）

> 本文档为「可直接交付 AI 进行完整开发」的工程总纲。AI 必须严格遵守 **TDD（测试驱动开发）** 原则：
> **先写失败测试（Red）→ 写最小实现使其通过（Green）→ 重构（Refactor）**，每个功能单元循环执行。
> 任何未先写测试的实现代码，均视为不符合规范。

---

## 0. 全局约束（AI 必读）

1. **TDD 强制**：禁止"先实现后补测试"。每个 Story 的第一个提交必须是失败的测试。
2. **语言统一**：前后端均 TypeScript 5.7.x，`strict: true`。
3. **不可越权**：系统仅做"辅助识别/辅助分派/辅助整理/辅助分析"，**禁止输出医疗诊断结论**（详见 §9 合规边界）。
4. **可解释**：所有风险判定、AI 推理必须落库可回溯（`AiInferenceLog`、`RiskRule.version`）。
5. **最小权限**：敏感字段（身份证、住址、电话）加密存储 + 基于角色（RBAC）的字段级授权。
6. **提交规范**：Conventional Commits（`feat:`/`fix:`/`test:`/`refactor:`），每个提交可独立通过 CI。
7. **覆盖率门禁**：后端行覆盖率 ≥ 80%，核心域（风险引擎、派单、定时任务）≥ 95%。

---

## 1. 技术栈与版本锁定（兼容性已验证）

### 1.1 后端
| 类别 | 技术 | 锁定版本 | 用途 |
|---|---|---|---|
| 运行时 | Node.js | **22.x LTS** | 服务运行时（规避新版原生模块滞后） |
| 语言 | TypeScript | **5.7.x** | 全栈语言（**禁止升级到 6.x**） |
| 框架 | NestJS | **11.x** | 后端框架 |
| ORM | Prisma | **6.x** | 数据访问 + 迁移 |
| 数据库 | PostgreSQL | **16.x** | 主数据库 |
| 缓存/队列底座 | Redis | **7.x** | BullMQ 后端 + 缓存 |
| 队列 | BullMQ + `@nestjs/bullmq` | **5.x / 11.x** | 定时检测、超时升级、异步推送 |
| 鉴权 | `@nestjs/jwt` + `passport-jwt` + `bcrypt` | 11.x / 4.x / 5.x | JWT + 后台密码登录 |
| 校验 | `class-validator` + `class-transformer` | 0.14.x / 0.5.x | DTO 校验 |
| 配置 | `@nestjs/config` | 4.x | 环境变量管理 |
| API 文档 | `@nestjs/swagger` | 8.x | OpenAPI 文档 |
| 实时 | `@nestjs/websockets` + `socket.io` | 11.x / 4.x | 预警实时推送大屏 |
| 日志 | `nestjs-pino` + `pino` | 4.x / 9.x | 结构化日志 + 审计 |
| 限流 | `@nestjs/throttler` | 6.x | 接口防刷 |
| 测试 | Jest + ts-jest + Supertest + Testcontainers | 29.x / 29.x / 7.x / 10.x | 单元/E2E/集成 |
| 对象存储 | MinIO（开发） / 阿里云 OSS（生产） | 最新 | 巡访照片、语音文件 |

### 1.2 小程序端（老人/家属、网格员、协同人员）
| 类别 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 框架 | uni-app（Vue 3 + Vite + TS） | uni-app 4.x | 微信小程序 |
| 状态 | Pinia | 2.x | 状态管理 |
| UI 库 | wot-design-uni | 1.x | Vue3 适配、活跃维护 |
| 请求 | luch-request（封装 `uni.request`） | 3.x | HTTP 拦截器/鉴权 |
| 测试 | Vitest + @vue/test-utils | 2.x / 2.x | 逻辑/组件单测 |

### 1.3 后台管理端（社区管理者）
| 类别 | 技术 | 版本 | 用途 |
|---|---|---|---|
| 框架 | Vue 3 + Vite + TS | 3.4+ / 6.x | 管理驾驶舱 |
| UI 库 | Element Plus | 2.x | 表格/表单/布局 |
| 状态 | Pinia + 持久化插件 | 2.x | 状态管理 |
| 路由 | Vue Router | 4.x | 路由 + 权限守卫 |
| 请求 | Axios | 1.x | HTTP |
| 图表 | ECharts + vue-echarts | 5.x / 7.x | 驾驶舱可视化 |
| 样式 | UnoCSS | 0.6x | 原子化 CSS |
| 测试 | Vitest + @vue/test-utils + Playwright | 2.x / 2.x / 1.x | 单测 + E2E |

### 1.4 智能辅助层
| 类别 | 技术 | 版本 | 用途 |
|---|---|---|---|
| LLM 接入 | `openai` SDK（指向 DeepSeek） | 4.x | 文本分类/摘要 |
| 模型 | `deepseek-chat` | — | OpenAI 兼容，成本最低 |
| 分词（可选） | nodejieba | 3.x | 关键词抽取/规则命中 |

### 1.5 基础设施
- **容器**：Docker + Docker Compose（本地一键起 PostgreSQL/Redis/MinIO）
- **CI**：GitHub Actions（lint → test → build，PR 必过）
- **包管理**：pnpm 9.x（Monorepo workspace）

### 1.6 关键兼容性决策记录（ADR 摘要）
- **ADR-001 锁定 TS 5.7**：TS 6.0 为过渡版，ts-jest/装饰器生态未充分验证，升级风险高。
- **ADR-002 选 Node 22 LTS 而非 24/26**：规避 bcrypt 等原生模块预编译滞后。
- **ADR-003 风险打分=规则引擎为主 + LLM 为辅**：保证确定性、可测试、可解释；LLM 仅做文本分类与摘要等模糊任务。
- **ADR-004 业务逻辑下沉**：uni-app 组件依赖 `uni` 全局难测，核心逻辑写入纯 TS service/composable，保证 TDD。

---

## 2. 仓库结构（pnpm Monorepo）

```
care-dispatch-system/
├── apps/
│   ├── api/                     # NestJS 后端
│   ├── admin/                   # Vue3 后台管理端
│   └── miniapp/                 # uni-app 小程序
├── packages/
│   ├── shared-types/            # 前后端共享 DTO/枚举/类型
│   └── shared-validation/       # 共享 zod/校验规则（可选）
├── docker/
│   └── docker-compose.yml       # PG / Redis / MinIO
├── .github/workflows/ci.yml
├── pnpm-workspace.yaml
└── DEVELOPMENT_PLAN.md
```

### 2.1 后端目录（`apps/api/src`）
```
src/
├── main.ts
├── app.module.ts
├── common/                      # 全局：异常过滤器、拦截器、守卫、装饰器、加密工具
│   ├── prisma/prisma.service.ts
│   ├── guards/{jwt-auth,roles}.guard.ts
│   ├── decorators/{roles,current-user}.decorator.ts
│   ├── crypto/field-encryption.service.ts
│   └── filters/all-exceptions.filter.ts
├── modules/
│   ├── auth/                    # 微信登录 + 后台密码登录 + JWT + RBAC
│   ├── users/                   # 系统用户（网格员/医生/物业/志愿者/管理员/家属）
│   ├── elders/                  # 老人档案 + 紧急联系人
│   ├── check-ins/              # 报平安
│   ├── visits/                  # 巡访记录
│   ├── devices/                 # 健康/设备数据接入
│   ├── risk/                    # 风险引擎 + 规则 + 预警事件（核心域）
│   ├── work-orders/             # 工单 + 派单 + 时间线
│   ├── evaluations/             # 服务评价
│   ├── ai/                      # DeepSeek：分类/摘要/打分辅助
│   ├── notifications/           # 微信订阅消息 + 队列
│   ├── dashboard/               # 统计报表
│   ├── audit/                   # 审计日志
│   └── scheduler/               # BullMQ：未报平安检测、工单超时升级
└── prisma/
    ├── schema.prisma
    ├── migrations/
    └── seed.ts
```

---

## 3. 数据模型（Prisma Schema 草案）

> AI 应以此为起点，迁移用 `prisma migrate dev`。敏感字段（idCard/address/phone）通过 `FieldEncryptionService` 应用层加密。

```prisma
// apps/api/prisma/schema.prisma
generator client { provider = "prisma-client-js" }
datasource db { provider = "postgresql"; url = env("DATABASE_URL") }

enum Role { GRID_WORKER COMMUNITY_DOCTOR PROPERTY VOLUNTEER ADMIN FAMILY }
enum DutyStatus { ON_DUTY OFF_DUTY }
enum ServiceLevel { NORMAL KEY HIGH }          // 普通/重点/高风险
enum CheckInMethod { ONE_TAP VOICE TEXT PROXY } // 一键/语音/文本/代填
enum CheckInStatus { NORMAL ABNORMAL MISSED }
enum RiskLevel { LOW MEDIUM HIGH }
enum RiskSource { MISSED_CHECKIN ABNORMAL_TEXT DEVICE HISTORY MANUAL }
enum RiskStatus { PENDING_REVIEW CONFIRMED IGNORED DISPATCHED }
enum WorkOrderType { HEALTH LIFE REPAIR ESCORT COMPANION ERRAND } // 健康/生活/维修/陪诊/陪伴/代购
enum WorkOrderStatus { PENDING ASSIGNED IN_PROGRESS COMPLETED CANCELLED }

model User {
  id           String      @id @default(cuid())
  openid       String?     @unique
  unionid      String?
  phone        String?     @unique          // 加密
  name         String
  role         Role
  passwordHash String?                       // 后台登录用
  skills       String[]    @default([])
  district     String?
  dutyStatus   DutyStatus  @default(OFF_DUTY)
  avgResponseMin Int?                         // 历史平均响应时长
  createdAt    DateTime    @default(now())
  visits       VisitRecord[]
  workOrders   WorkOrder[] @relation("assignee")
  familyLinks  ElderFamilyLink[]
}

model Elder {
  id           String   @id @default(cuid())
  name         String
  gender       String?
  birthDate    DateTime?
  idCard       String?                        // 加密
  address      String?                        // 加密
  district     String
  longitude    Float?
  latitude     Float?
  healthTags   String[] @default([])          // 慢病/行动不便/独居/空巢
  serviceLevel ServiceLevel @default(NORMAL)
  livingStatus String?
  createdAt    DateTime @default(now())
  contacts     EmergencyContact[]
  checkIns     CheckIn[]
  visits       VisitRecord[]
  devices      DeviceData[]
  riskEvents   RiskEvent[]
  workOrders   WorkOrder[]
  familyLinks  ElderFamilyLink[]
}

model EmergencyContact {
  id        String  @id @default(cuid())
  elderId   String
  name      String
  relation  String
  phone     String                            // 加密
  isPrimary Boolean @default(false)
  elder     Elder   @relation(fields: [elderId], references: [id])
}

model ElderFamilyLink {              // 家属账号 ↔ 老人
  id       String @id @default(cuid())
  elderId  String
  userId   String
  relation String
  elder    Elder  @relation(fields: [elderId], references: [id])
  user     User   @relation(fields: [userId], references: [id])
  @@unique([elderId, userId])
}

model CheckIn {
  id        String        @id @default(cuid())
  elderId   String
  method    CheckInMethod
  content   String?
  voiceUrl  String?
  status    CheckInStatus @default(NORMAL)
  createdAt DateTime      @default(now())
  elder     Elder         @relation(fields: [elderId], references: [id])
  @@index([elderId, createdAt])
}

model VisitRecord {
  id           String   @id @default(cuid())
  elderId      String
  gridWorkerId String
  visitTime    DateTime @default(now())
  observation  String
  photos       String[] @default([])
  note         String?
  elder        Elder    @relation(fields: [elderId], references: [id])
  gridWorker   User     @relation(fields: [gridWorkerId], references: [id])
}

model DeviceData {
  id         String   @id @default(cuid())
  elderId    String
  deviceType String
  metricType String                            // BLOOD_PRESSURE/HEART_RATE/FALL/SMOKE/WATER
  value      String?
  alarm      Boolean  @default(false)
  status     String?
  timestamp  DateTime @default(now())
  elder      Elder    @relation(fields: [elderId], references: [id])
  @@index([elderId, timestamp])
}

model RiskEvent {
  id         String     @id @default(cuid())
  elderId    String
  level      RiskLevel
  source     RiskSource
  score      Int
  reason     String                            // 可解释原因
  status     RiskStatus @default(PENDING_REVIEW)
  reviewedBy String?
  ruleVersion String?
  createdAt  DateTime   @default(now())
  elder      Elder      @relation(fields: [elderId], references: [id])
  workOrder  WorkOrder?
  @@index([elderId, status])
}

model WorkOrder {
  id             String          @id @default(cuid())
  riskEventId    String?         @unique
  elderId        String
  type           WorkOrderType
  level          RiskLevel
  assigneeId     String?
  status         WorkOrderStatus @default(PENDING)
  deadline       DateTime?
  dispatchReason String?
  result         String?
  completedAt    DateTime?
  createdById    String
  createdAt      DateTime        @default(now())
  elder          Elder           @relation(fields: [elderId], references: [id])
  riskEvent      RiskEvent?      @relation(fields: [riskEventId], references: [id])
  assignee       User?           @relation("assignee", fields: [assigneeId], references: [id])
  timeline       WorkOrderTimeline[]
  evaluation     ServiceEvaluation?
  @@index([status, deadline])
}

model WorkOrderTimeline {
  id          String   @id @default(cuid())
  workOrderId String
  action      String
  operatorId  String?
  note        String?
  createdAt   DateTime @default(now())
  workOrder   WorkOrder @relation(fields: [workOrderId], references: [id])
}

model ServiceEvaluation {
  id          String   @id @default(cuid())
  workOrderId String   @unique
  rating      Int                               // 1-5
  comment     String?
  tags        String[] @default([])
  createdAt   DateTime @default(now())
  workOrder   WorkOrder @relation(fields: [workOrderId], references: [id])
}

model RiskRule {
  id        String   @id @default(cuid())
  name      String
  condition Json                                // 结构化条件
  weight    Int
  level     RiskLevel
  version   Int      @default(1)
  enabled   Boolean  @default(true)
  createdById String?
  updatedAt DateTime @updatedAt
}

model AiInferenceLog {
  id             String   @id @default(cuid())
  type           String                          // CLASSIFY/SUMMARY/SCORE_ASSIST
  model          String
  input          Json
  output         Json
  humanCorrection Json?
  createdAt      DateTime @default(now())
}

model AuditLog {
  id           String   @id @default(cuid())
  userId       String?
  action       String
  resourceType String
  resourceId   String?
  detail       Json?
  ip           String?
  createdAt    DateTime @default(now())
  @@index([userId, createdAt])
}

model Notification {
  id         String   @id @default(cuid())
  targetType String                              // USER/ELDER
  targetId   String
  channel    String                              // WECHAT/SMS
  templateId String?
  payload    Json
  status     String   @default("PENDING")
  sentAt     DateTime?
  createdAt  DateTime @default(now())
}
```

---

## 4. 核心域设计：风险引擎（最重要，TDD 示范模块）

风险引擎是系统大脑，必须**确定性、可解释、可测试**。采用**规则评分 + 分级**，LLM 仅辅助文本分类。

### 4.1 规则评分模型
- 每条 `RiskRule` 命中 → 累加 `weight`。
- 总分映射：`>=70 → HIGH`、`40-69 → MEDIUM`、`<40 → LOW`。
- 输出必须包含 `reason`（命中规则列表）与 `ruleVersion`。

内置规则示例（seed 数据）：
| 规则 | 条件 | 权重 |
|---|---|---|
| 连续未报平安 | 24h 内无 CheckIn | 40 |
| 设备跌倒报警 | DeviceData.metricType=FALL & alarm | 60 |
| 烟感/水浸报警 | metricType in (SMOKE,WATER) & alarm | 50 |
| 异常文本 | AI 分类=求助/异常 | 30 |
| 高龄+慢病叠加 | age>=80 且 healthTags 含慢病 | 15 |
| 近 7 天高风险史 | 历史 HIGH 事件 | 10 |

### 4.2 派单推荐算法
输入：事件类型、风险等级、片区、人员技能、在岗状态、距离、历史响应时长。
评分：`匹配技能(必选) → 同片区+30 → 在岗+25 → 距离近(归一化≤20) → 响应快(归一化≤25)`，取最高分，允许人工改派并记录原因。

### 4.3 TDD 完整示范（AI 必须照此模式开发每个单元）

**Step 1 — Red（先写失败测试）**
```typescript
// src/modules/risk/risk-scoring.service.spec.ts
import { RiskScoringService } from './risk-scoring.service';
import { RiskLevel } from '@prisma/client';

describe('RiskScoringService', () => {
  let service: RiskScoringService;
  beforeEach(() => { service = new RiskScoringService(); });

  it('24h 未报平安应判定为 MEDIUM 及以上并给出原因', () => {
    const result = service.evaluate({
      hoursSinceLastCheckIn: 25,
      deviceAlarms: [],
      abnormalText: false,
      age: 70,
      hasChronicDisease: false,
      recentHighRisk: false,
    });
    expect(result.score).toBeGreaterThanOrEqual(40);
    expect([RiskLevel.MEDIUM, RiskLevel.HIGH]).toContain(result.level);
    expect(result.reason).toContain('未报平安');
  });

  it('跌倒报警必须判定为 HIGH', () => {
    const result = service.evaluate({
      hoursSinceLastCheckIn: 1,
      deviceAlarms: ['FALL'],
      abnormalText: false, age: 82, hasChronicDisease: true, recentHighRisk: false,
    });
    expect(result.level).toBe(RiskLevel.HIGH);
  });
});
```

**Step 2 — Green（最小实现使测试通过）**
```typescript
// src/modules/risk/risk-scoring.service.ts
import { Injectable } from '@nestjs/common';
import { RiskLevel } from '@prisma/client';

export interface RiskInput {
  hoursSinceLastCheckIn: number;
  deviceAlarms: string[];
  abnormalText: boolean;
  age: number;
  hasChronicDisease: boolean;
  recentHighRisk: boolean;
}
export interface RiskResult { score: number; level: RiskLevel; reason: string[]; ruleVersion: number; }

@Injectable()
export class RiskScoringService {
  evaluate(input: RiskInput): RiskResult {
    let score = 0; const reason: string[] = [];
    if (input.hoursSinceLastCheckIn >= 24) { score += 40; reason.push('24小时未报平安'); }
    if (input.deviceAlarms.includes('FALL')) { score += 60; reason.push('设备跌倒报警'); }
    if (input.deviceAlarms.some(a => ['SMOKE','WATER'].includes(a))) { score += 50; reason.push('烟感/水浸报警'); }
    if (input.abnormalText) { score += 30; reason.push('文本异常表达'); }
    if (input.age >= 80 && input.hasChronicDisease) { score += 15; reason.push('高龄叠加慢病'); }
    if (input.recentHighRisk) { score += 10; reason.push('近期高风险史'); }
    const level = score >= 70 ? RiskLevel.HIGH : score >= 40 ? RiskLevel.MEDIUM : RiskLevel.LOW;
    return { score, level, reason, ruleVersion: 1 };
  }
}
```

**Step 3 — Refactor**：通过后，将硬编码权重重构为从 `RiskRule` 表读取（再补"规则可配置"的测试），保持测试常绿。

> AI 必须对**每个 service/算法/守卫**重复 Red→Green→Refactor。

---

## 5. API 契约（关键端点，AI 据此实现 + 写 E2E）

> 全部 `/api/v1` 前缀，JWT 鉴权（除登录），统一响应 `{ code, data, message }`，Swagger 自动生成文档。

### 5.1 鉴权 Auth
- `POST /auth/wechat-login` — body `{ code }` → 调 `jscode2session` → 创建/查用户 → 返回 JWT
- `POST /auth/admin-login` — body `{ phone, password }` → 后台 JWT
- `GET /auth/me` — 当前用户

### 5.2 老人档案 Elders
- `POST /elders` / `GET /elders`（分页+片区+服务等级过滤）/ `GET /elders/:id` / `PATCH /elders/:id`
- `POST /elders/:id/contacts` / `GET /elders/:id/risk-profile`（风险画像）

### 5.3 报平安 CheckIns
- `POST /check-ins` — `{ elderId, method, content?, voiceUrl? }`（家属/工作人员可代填）
- `GET /elders/:id/check-ins`

### 5.4 巡访 Visits
- `POST /visits`（含照片上传 URL）/ `GET /visits?elderId=&from=&to=`

### 5.5 设备 Devices
- `POST /devices/data`（设备/网关上报，含 HMAC 校验）/ `GET /elders/:id/devices`

### 5.6 风险 Risk
- `GET /risk/events?status=&level=&district=` / `POST /risk/events/:id/review`（人工复核：确认/忽略，HIGH 必须复核）
- 规则管理：`GET/POST/PATCH /risk/rules`（含 version）

### 5.7 工单 WorkOrders
- `POST /work-orders`（可由风险事件生成，返回派单推荐）
- `GET /work-orders`（按角色过滤：协同人员只见自己的）
- `POST /work-orders/:id/assign` / `:id/accept` / `:id/start` / `:id/complete`（带结果+照片）/ `:id/reassign`（记录改派原因）

### 5.8 评价 Evaluations
- `POST /work-orders/:id/evaluation` / `GET /evaluations?from=&to=`

### 5.9 AI 辅助
- `POST /ai/classify` — `{ text }` → `{ type, confidence }`（健康/生活/维修/陪诊…）
- `POST /ai/summarize` — `{ workOrderId }` → 标准化摘要（提交人确认后入库）

### 5.10 驾驶舱 Dashboard
- `GET /dashboard/overview` — 重点老人数、待处理预警、今日工单完成率
- `GET /dashboard/response-time` / `/risk-distribution` / `/hotspots`（高发问题）/ `/poor-reviews`

### 5.11 通知 Notifications
- `POST /notifications/subscribe`（保存订阅授权）/ 内部由队列触发微信订阅消息发送

---

## 6. 定时任务与队列（BullMQ）

| Job | 触发 | 逻辑 |
|---|---|---|
| `missed-checkin-scan` | 每小时 cron | 扫描超 N 小时未报平安老人 → 调风险引擎 → 生成 RiskEvent → HIGH 进复核队列+通知 |
| `workorder-timeout-escalate` | 每 15 分钟 | 扫描超 `deadline` 未完成工单 → 升级+通知上级/家属 |
| `device-alarm-handle` | 事件驱动 | 设备报警入队 → 实时生成高风险事件 |
| `notification-send` | 事件驱动 | 调微信订阅消息 API，失败重试（指数退避）+ 死信队列 |
| `daily-report-build` | 每日 cron | 预聚合驾驶舱指标 |

> 每个 Processor 必须有：成功路径单测 + 失败重试测试 + 幂等性测试。

---

## 7. 前端页面清单

### 7.1 小程序端（uni-app）
| 角色 | 页面 | 要点 |
|---|---|---|
| 老人/家属 | 一键报平安、语音求助、工单进度、紧急联系人 | 大字号、少按钮、可语音 |
| 网格员 | 风险待办列表、巡访表单（拍照/定位）、电话核实记录、工单处理 | 优先级清晰、录入步骤少 |
| 协同人员 | 接单→到达→处理→上传照片→完成说明 | 流程标准化 |

> **TDD 要求**：把"报平安提交""工单状态机""风险列表排序"等逻辑写成纯 TS composable（`useCheckIn.ts`/`useWorkOrder.ts`），用 Vitest 直接测，不依赖 `uni` 全局。组件层只做渲染绑定。

### 7.2 后台管理端（Vue3 + Element Plus）
| 页面 | 内容 |
|---|---|
| 登录 | 手机号+密码 |
| 驾驶舱 | 风险分布、响应时长、完成率、评价、高发问题（ECharts） |
| 老人档案管理 | 列表/详情/风险画像 |
| 预警中心 | 待复核列表、复核操作、实时推送（WebSocket） |
| 工单管理 | 派单/改派/进度跟踪 |
| 规则配置 | 风险规则 CRUD + 版本 |
| 人员与排班 | 角色/技能/片区/在岗状态 |
| 审计日志 | 操作回溯 |

---

## 8. AI 智能辅助层实现规范

- 统一封装 `AiClient`（`openai` SDK，`baseURL=https://api.deepseek.com`，`model=deepseek-chat`）。
- **三道防线**：① 规则前置过滤（命中即返回，省 token）② LLM 仅处理模糊文本 ③ 结果落 `AiInferenceLog` 可纠错。
- **分类**：few-shot prompt，输出 JSON `{type, confidence}`，低置信度转人工。
- **摘要**：仅用授权数据，提交人确认后入库；prompt 中禁止生成诊断/治疗结论。
- **测试**：AI 调用必须 mock（`jest.mock('openai')`），不在 CI 打真实 API；单独保留 `*.contract.spec.ts` 手动验证真实接口。

---

## 9. 合规与安全边界（硬性）

1. 系统**不输出**"确诊/治疗方案"等医疗结论；AI prompt 与代码层双重拦截。
2. 系统只给**优先级建议**，不自动决定放弃/延迟服务。
3. 敏感数据（健康/住址/电话/身份证）**最小必要 + 字段级加密 + 角色授权**。
4. 风险规则与评分原因**可查看**，禁止黑箱。
5. 保留**人工复核/申诉/纠错**入口（RiskEvent.review、AiInferenceLog.humanCorrection）。
6. 不以个人隐私作训练材料；保留操作日志（AuditLog）便于审计。

---

## 10. 测试策略（TDD 落地）

### 10.1 测试金字塔
- **单元测试（~70%）**：service / 算法 / 守卫 / composable。纯函数优先。
- **集成测试（~20%）**：Repository + 真实 PostgreSQL（**Testcontainers** 起临时容器，全局 setup 跑迁移），队列 Processor。
- **E2E（~10%）**：Supertest 打通 HTTP→DB；前端 Playwright 关键流程。

### 10.2 后端测试约定
- 文件：`*.spec.ts`（单元）与 `*.e2e-spec.ts`（E2E），与源码同目录。
- 每个 PR：`pnpm lint && pnpm test && pnpm test:e2e` 全绿方可合并。
- Testcontainers 全局初始化示例：
```typescript
// test/setup-testcontainers.ts
import { PostgreSqlContainer } from '@testcontainers/postgresql';
export default async function () {
  const pg = await new PostgreSqlContainer('postgres:16').start();
  process.env.DATABASE_URL = pg.getConnectionUri();
  (globalThis as any).__PG__ = pg;
  // execSync('pnpm prisma migrate deploy')
}
```

### 10.3 前端测试约定
- 逻辑/composable/store → Vitest 单测（不依赖 `uni`/DOM）。
- 组件 → `@vue/test-utils` + jsdom，mock `uni` 全局。
- 管理端关键流程 → Playwright。

### 10.4 覆盖率门禁（CI 强制）
- 后端整体 ≥ 80%，`modules/risk`、`modules/work-orders`、`modules/scheduler` ≥ 95%。

---

## 11. 分阶段开发计划（迭代 + TDD 任务分解）

> 每个 Story 的执行顺序固定为：**写测试 → 实现 → 重构 → 提交**。下表"产物"均含对应测试文件。

### 阶段 0：工程脚手架（对应"第1周立项调研"延伸）
- [ ] 初始化 pnpm Monorepo、Docker Compose（PG/Redis/MinIO）、CI、ESLint/Prettier、commitlint
- [ ] NestJS 骨架 + PrismaService + 全局异常过滤器/响应拦截器 + Swagger
- [ ] Prisma schema 落地 + 首次迁移 + seed（含内置风险规则）
- **DoD**：`docker compose up` 可起依赖，空 E2E 测试通过，CI 绿。

### 阶段 1：鉴权与用户/档案（对应"第2-3周系统分析/设计"）
- [ ] Auth：微信登录 + 后台登录 + JWT + RBAC 守卫（先写守卫单测）
- [ ] Users CRUD + 角色/技能/片区/在岗状态
- [ ] Elders + 紧急联系人 + 字段加密（先写加密服务单测）+ 风险画像查询
- **DoD**：鉴权 E2E、RBAC 越权拒绝测试通过。

### 阶段 2：数据采集（报平安 / 巡访 / 设备）
- [ ] CheckIns（含代填）+ 文件/语音上传（MinIO 预签名）
- [ ] Visits（拍照/定位）
- [ ] Devices 上报（HMAC 校验，先写校验失败测试）
- **DoD**：采集类 E2E 全通过，覆盖异常入参。

### 阶段 3：风险引擎与预警（核心，最高优先级测试）
- [ ] `RiskScoringService`（§4.3 示范）→ 规则可配置化重构
- [ ] `DispatchRecommendationService` 派单推荐算法（先写多场景单测）
- [ ] RiskEvent 生成/复核流程（HIGH 强制复核测试）
- [ ] 规则管理 CRUD + 版本
- **DoD**：风险/派单覆盖率 ≥ 95%。

### 阶段 4：工单与协同调度
- [ ] WorkOrder 状态机（PENDING→ASSIGNED→IN_PROGRESS→COMPLETED，先写非法转移被拒测试）
- [ ] 派单/接单/改派（记录原因）/完成（结果+照片）+ 时间线
- [ ] 评价反馈
- **DoD**：状态机全路径 + 非法转移测试通过。

### 阶段 5：定时任务与通知（BullMQ）
- [ ] missed-checkin-scan、workorder-timeout-escalate（先写"超时被升级"测试）
- [ ] 微信订阅消息发送 + 重试 + 死信（先写重试/幂等测试）
- **DoD**：队列 Processor 集成测试通过。

### 阶段 6：AI 辅助层
- [ ] AiClient 封装 + classify + summarize（mock LLM 单测 + 合规拦截测试）
- [ ] 接入风险引擎"异常文本"信号
- **DoD**：CI 不打真实 API，合规拦截测试通过。

### 阶段 7：驾驶舱与审计
- [ ] Dashboard 聚合接口 + 预聚合 job
- [ ] AuditLog 拦截器（写操作自动落审计）+ 实时 WebSocket 推送
- **DoD**：报表接口 E2E + 审计落库测试通过。

### 阶段 8：前端三端（对应"第4周原型评审"扩展为实现）
- [ ] 小程序：报平安/语音求助/工单进度（composable 先行 TDD）
- [ ] 网格员/协同端：待办/巡访/工单处理
- [ ] 管理端：驾驶舱/预警中心/工单/规则/审计
- **DoD**：composable/store 单测 + 管理端关键流程 Playwright 通过。

### 阶段 9：联调、加固、部署
- [ ] 限流、日志、数据脱敏展示、数据字典与必填校验
- [ ] 性能与安全自测、Docker 镜像、部署文档
- **DoD**：全链路 E2E + 覆盖率门禁达标。

---

## 12. 环境变量（`.env.example`）

```bash
# 数据库 / 缓存
DATABASE_URL=postgresql://app:app@localhost:5432/care
REDIS_URL=redis://localhost:6379
# JWT
JWT_SECRET=change_me
JWT_EXPIRES_IN=7d
# 字段加密（AES-256-GCM 32字节）
FIELD_ENCRYPTION_KEY=base64_32_bytes_key
# 微信小程序
WECHAT_APPID=
WECHAT_SECRET=
# DeepSeek（OpenAI 兼容）
OPENAI_API_KEY=sk-deepseek-xxx
OPENAI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat
# 对象存储（MinIO/OSS）
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=care
```

---

## 13. CI 流水线（`.github/workflows/ci.yml` 要点）

```yaml
# 触发：pull_request / push
# Jobs：
#  1) install (pnpm, cache)
#  2) lint  -> pnpm -r lint
#  3) test  -> 起 service: postgres:16 + redis:7；pnpm -r test --coverage（门禁 80%/95%）
#  4) e2e   -> pnpm --filter api test:e2e（Testcontainers）
#  5) build -> pnpm -r build
# 任一失败则 PR 阻断合并
```

---

## 14. Definition of Done（每个 Story 通用）

1. 先有失败测试，再有实现（提交历史可见 Red→Green）。
2. 单元/集成/E2E 全绿，覆盖率达门禁。
3. 通过 lint、类型检查、Swagger 文档更新。
4. 涉及敏感数据有加密与权限校验测试。
5. 涉及 AI/风险判定有 `*Log` 落库与可解释 `reason`。
6. Conventional Commit + PR 描述含变更点与测试说明。

---

## 15. 给 AI 的执行提示（Prompt 锚点）

> 「严格按 §11 阶段顺序开发。每个功能：① 先在对应 `*.spec.ts` 写出失败测试（覆盖正常+边界+异常）② 运行确认 Red ③ 写最小实现至 Green ④ 重构并保持常绿 ⑤ 按 §14 DoD 提交。风险引擎、派单、状态机、定时任务为高风险域，覆盖率 ≥95%。AI 调用一律 mock，绝不在 CI 打真实接口。任何医疗诊断类输出必须被代码层拦截。」