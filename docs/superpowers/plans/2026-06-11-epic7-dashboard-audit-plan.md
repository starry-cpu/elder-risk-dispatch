# Epic 7 — Dashboard/AuditLog/WebSocket 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现驾驶舱统计报表、审计日志拦截器、WebSocket 实时推送与通知中心三大子系统。

**Architecture:** 遵循 NestJS 模块化架构，Dashboard 只读聚合 + BullMQ 预聚合，AuditLog 用拦截器 + 装饰器实现零侵入审计，WebSocket 用 Socket.IO + Redis Adapter 实现多实例广播 + Notification 表落盘。

**Tech Stack:** NestJS 11, Prisma 6, BullMQ 5, Socket.IO (via @nestjs/platform-socket.io), Redis Adapter, Jest 29

---

## 文件结构总览

```
apps/api/
├── prisma/
│   ├── schema.prisma                          # MODIFY: Notification.readAt
│   └── migrations/*                           # AUTO: prisma migrate
├── src/
│   ├── app.module.ts                          # MODIFY: register DashboardModule, AuditModule
│   ├── modules/
│   │   ├── dashboard/                         # CREATE: 全新模块
│   │   │   ├── dashboard.module.ts
│   │   │   ├── dashboard.controller.ts
│   │   │   ├── dashboard.service.ts
│   │   │   ├── dashboard.service.spec.ts
│   │   │   ├── dashboard.e2e-spec.ts
│   │   │   ├── dto/
│   │   │   │   ├── dashboard-query.dto.ts
│   │   │   │   ├── risk-overview.dto.ts
│   │   │   │   ├── work-order-efficiency.dto.ts
│   │   │   │   ├── elder-coverage.dto.ts
│   │   │   │   └── grid-worker-performance.dto.ts
│   │   │   └── processors/
│   │   │       ├── dashboard-aggregate.processor.ts
│   │   │       └── dashboard-aggregate.processor.spec.ts
│   │   ├── audit/                            # CREATE: 全新模块
│   │   │   ├── audit.module.ts
│   │   │   ├── audit.controller.ts
│   │   │   ├── audit.service.ts
│   │   │   ├── audit.service.spec.ts
│   │   │   ├── audit.interceptor.ts
│   │   │   ├── audit.interceptor.spec.ts
│   │   │   ├── dto/
│   │   │   │   ├── audit-log-query.dto.ts
│   │   │   │   └── audit-log-response.dto.ts
│   │   │   ├── decorators/
│   │   │   │   └── auditable.decorator.ts
│   │   │   └── filters/
│   │   │       └── audit-sensitive.filter.ts
│   │   │       └── audit-sensitive.filter.spec.ts
│   │   ├── notifications/                    # MODIFY: 增强
│   │   │   ├── notifications.module.ts       # MODIFY: register Gateway
│   │   │   ├── notifications.service.ts      # MODIFY: add emit(), query methods
│   │   │   ├── notifications.service.spec.ts # MODIFY: tests for new methods
│   │   │   ├── notifications.controller.ts   # MODIFY: add inbox/read endpoints
│   │   │   ├── notifications.integration.spec.ts # MODIFY: add WS tests
│   │   │   ├── dto/
│   │   │   │   ├── notification-query.dto.ts    # MODIFY: add status filter
│   │   │   │   └── notification-response.dto.ts # MODIFY: add readAt
│   │   │   └── gateway/                      # CREATE: 新增子目录
│   │   │       ├── dashboard.gateway.ts
│   │   │       ├── dashboard.gateway.spec.ts
│   │   │       ├── ws-auth.guard.ts
│   │   │       └── ws-roles.guard.ts
│   │   ├── auth/auth.controller.ts           # MODIFY: add @Auditable
│   │   ├── risk/risk.controller.ts           # MODIFY: add @Auditable
│   │   ├── work-orders/work-orders.service.ts # MODIFY: call emit()
│   │   ├── elders/elders.controller.ts       # MODIFY: add @Auditable
│   │   └── users/users.controller.ts         # MODIFY: add @Auditable
└── package.json                              # MODIFY: add socket.io deps
```

---

### Task 1: Prisma Schema 迁移 — Notification 表新增 readAt

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Auto: `apps/api/prisma/migrations/*`

- [ ] **Step 1: Schema 新增 readAt 字段**

在 `apps/api/prisma/schema.prisma` 的 Notification model 中新增 `readAt`:

```prisma
model Notification {
  id         String    @id @default(cuid())
  targetType String
  targetId   String
  channel    String
  templateId String?
  payload    Json
  status     String    @default("PENDING")
  sentAt     DateTime?
  readAt     DateTime?  // NEW — 通知已读时间
  createdAt  DateTime  @default(now())
}
```

- [ ] **Step 2: 生成迁移**

```bash
cd apps/api && npx prisma migrate dev --name add-notification-readat
```

Expected: 迁移文件在 `apps/api/prisma/migrations/` 下生成，`prisma generate` 自动执行。

- [ ] **Step 3: 验证**

```bash
cd apps/api && npx prisma generate
```

Expected: 无报错，`@prisma/client` 类型更新包含 `readAt`。

- [ ] **Step 4: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add Notification.readAt field for message read tracking"
```

---

### Task 2: AuditLog 核心 — 装饰器 + 脱敏过滤器

**Files:**
- Create: `apps/api/src/modules/audit/decorators/auditable.decorator.ts`
- Create: `apps/api/src/modules/audit/filters/audit-sensitive.filter.ts`
- Create: `apps/api/src/modules/audit/filters/audit-sensitive.filter.spec.ts`

- [ ] **Step 1: 编写脱敏过滤器测试**

创建 `apps/api/src/modules/audit/filters/audit-sensitive.filter.spec.ts`:

```typescript
import { sanitizeAuditData } from './audit-sensitive.filter';

describe('sanitizeAuditData', () => {
  it('应脱敏手机号字段', () => {
    const result = sanitizeAuditData({ phone: '13812345678' }, ['phone']);
    expect(result.phone).toBe('1*********8');
  });

  it('应脱敏身份证字段', () => {
    const result = sanitizeAuditData({ idCard: '110101199001011234' }, ['idCard']);
    expect(result.idCard).toBe('****************1234');
  });

  it('应移除密码类字段', () => {
    const result = sanitizeAuditData({ password: 'secret123' }, ['password']);
    expect(result.password).toBe('***REDACTED***');
  });

  it('应保持非敏感字段不变', () => {
    const input = { name: '张大爷', phone: '13800000000', address: '朝阳区' };
    const result = sanitizeAuditData(input, ['phone']);
    expect(result.name).toBe('张大爷');
    expect(result.address).toBe('朝阳区');
    expect(result.phone).toBe('1*********0');
  });

  it('嵌套对象中敏感字段也应脱敏', () => {
    const result = sanitizeAuditData(
      { elder: { name: '张大爷', idCard: '110101199001011234' } },
      ['idCard'],
    );
    expect(result.elder.idCard).toBe('****************1234');
    expect(result.elder.name).toBe('张大爷');
  });

  it('非字符串敏感字段保持不变', () => {
    const result = sanitizeAuditData({ age: 80, phone: 13812345678 }, ['phone']);
    expect(result.age).toBe(80);
    expect(result.phone).toBe(13812345678);
  });

  it('空对象和空敏感字段列表应原样返回', () => {
    expect(sanitizeAuditData({}, [])).toEqual({});
    expect(sanitizeAuditData({ name: 'test' }, [])).toEqual({ name: 'test' });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd apps/api && npx jest --testPathPattern="audit-sensitive.filter.spec.ts" --no-coverage
```

Expected: FAIL — `sanitizeAuditData` 未定义。

- [ ] **Step 3: 实现脱敏过滤器**

创建 `apps/api/src/modules/audit/filters/audit-sensitive.filter.ts`:

```typescript
const PHONE_PATTERN = /^phone/i;
const ID_CARD_PATTERN = /^(idCard|idNumber|identityCard)$/i;
const SECRET_PATTERN = /^(password|secret|token|apiKey)$/i;

export function sanitizeAuditData(
  data: Record<string, unknown>,
  sensitiveFields: string[],
): Record<string, unknown> {
  if (!data || typeof data !== 'object') return data;
  if (!sensitiveFields || sensitiveFields.length === 0) return data;

  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data)) {
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      result[key] = sanitizeAuditData(value as Record<string, unknown>, sensitiveFields);
    } else if (isSensitiveField(key, sensitiveFields)) {
      result[key] = maskValue(key, value);
    } else {
      result[key] = value;
    }
  }

  return result;
}

function isSensitiveField(fieldName: string, sensitiveFields: string[]): boolean {
  return sensitiveFields.some(
    (sf) => fieldName === sf || fieldName.toLowerCase() === sf.toLowerCase(),
  );
}

function maskValue(fieldName: string, value: unknown): string {
  if (typeof value !== 'string') return '***REDACTED***';

  if (SECRET_PATTERN.test(fieldName)) {
    return '***REDACTED***';
  }
  if (ID_CARD_PATTERN.test(fieldName) && value.length >= 4) {
    return '*'.repeat(value.length - 4) + value.slice(-4);
  }
  if (PHONE_PATTERN.test(fieldName) && value.length >= 3) {
    return value[0] + '*'.repeat(value.length - 2) + value[value.length - 1];
  }
  return '***MASKED***';
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd apps/api && npx jest --testPathPattern="audit-sensitive.filter.spec.ts" --no-coverage
```

Expected: PASS — 所有 7 个测试通过。

- [ ] **Step 5: 创建 `@Auditable` 装饰器**

创建 `apps/api/src/modules/audit/decorators/auditable.decorator.ts`:

```typescript
import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface AuditableOptions {
  resourceIdParam?: string;    // 默认 'id'
  sensitiveFields?: string[];   // 需脱敏字段
  logRequestBody?: boolean;     // 默认 false
}

export interface AuditableMetadata {
  resourceType: string;
  action: string;
  options: AuditableOptions;
}

export const Auditable = (
  resourceType: string,
  action: string,
  options: AuditableOptions = {},
) => SetMetadata(AUDITABLE_KEY, { resourceType, action, options });
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/audit/decorators/ apps/api/src/modules/audit/filters/
git commit -m "feat: add @Auditable decorator and audit-sensitive filter"
```

---

### Task 3: AuditLog Service — 审计写入服务

**Files:**
- Create: `apps/api/src/modules/audit/audit.service.ts`
- Create: `apps/api/src/modules/audit/audit.service.spec.ts`

- [ ] **Step 1: 编写 AuditService 单元测试**

创建 `apps/api/src/modules/audit/audit.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('应写入 AuditLog 记录', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'log-1',
        userId: 'u-1',
        action: 'LOGIN',
        resourceType: 'AUTH',
        resourceId: null,
        detail: null,
        ip: '127.0.0.1',
        createdAt: new Date(),
      });

      const result = await service.log({
        userId: 'u-1',
        action: 'LOGIN',
        resourceType: 'AUTH',
        resourceId: null,
        detail: null,
        ip: '127.0.0.1',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-1',
          action: 'LOGIN',
          resourceType: 'AUTH',
          resourceId: null,
          detail: null,
          ip: '127.0.0.1',
        },
      });
      expect(result.id).toBe('log-1');
    });

    it('detail 为 undefined 时应转为 null', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-2' });

      await service.log({
        userId: 'u-2',
        action: 'UPDATE',
        resourceType: 'ELDER',
        resourceId: 'e-1',
        ip: '10.0.0.1',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          detail: null,
          resourceId: 'e-1',
        }),
      });
    });

    it('Prisma 写入失败时不应抛错', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.log({
          userId: 'u-3',
          action: 'DELETE',
          resourceType: 'ELDER',
          resourceId: 'e-2',
          ip: '10.0.0.2',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('应返回分页审计日志', async () => {
      const mockLogs = [
        { id: 'log-1', userId: 'u-1', action: 'LOGIN', resourceType: 'AUTH', createdAt: new Date() },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('应按条件过滤', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({
        action: 'LOGIN',
        resourceType: 'AUTH',
        startDate: '2026-06-01',
        endDate: '2026-06-11',
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          action: 'LOGIN',
          resourceType: 'AUTH',
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd apps/api && npx jest --testPathPattern="audit.service.spec.ts" --no-coverage
```

Expected: FAIL — `AuditService` 未定义。

- [ ] **Step 3: 实现 AuditService**

创建 `apps/api/src/modules/audit/audit.service.ts`:

```typescript
import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AuditLogInput {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  detail?: Record<string, unknown> | null;
  ip?: string;
}

interface AuditQueryInput {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          detail: input.detail ?? null,
          ip: input.ip ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Audit log write failed: ${input.action} on ${input.resourceType}`,
        error instanceof Error ? error.message : String(error),
      );
      // 审计写入失败不抛错，不阻塞业务
    }
  }

  async findAll(query: AuditQueryInput) {
    const { page, limit, userId, action, resourceType, resourceId, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd apps/api && npx jest --testPathPattern="audit.service.spec.ts" --no-coverage
```

Expected: PASS — 所有 5 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/audit/
git commit -m "feat: add AuditService with log and paginated query"
```

---

### Task 4: AuditLog Interceptor — 全局拦截器

**Files:**
- Create: `apps/api/src/modules/audit/audit.interceptor.ts`
- Create: `apps/api/src/modules/audit/audit.interceptor.spec.ts`

- [ ] **Step 1: 编写拦截器测试**

创建 `apps/api/src/modules/audit/audit.interceptor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { AUDITABLE_KEY } from './decorators/auditable.decorator';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: { log: jest.Mock };
  let reflector: { get: jest.Mock };

  beforeEach(async () => {
    auditService = { log: jest.fn() };
    reflector = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: AuditService, useValue: auditService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
  });

  function mockContext(metadata: unknown, params: Record<string, string>, user: unknown, ip: string) {
    const handler = {};
    reflector.get.mockReturnValue(metadata);
    return {
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ params, user, ip }),
      }),
    } as unknown as ExecutionContext;
  }

  it('无 @Auditable 装饰器时不写审计', (done) => {
    const ctx = mockContext(undefined, { id: 'r-1' }, { sub: 'u-1', role: 'ADMIN' }, '127.0.0.1');
    const next: CallHandler = { handle: () => of({ id: 'r-1' }) };

    interceptor.intercept(ctx, next).subscribe((result) => {
      expect(auditService.log).not.toHaveBeenCalled();
      expect(result.id).toBe('r-1');
      done();
    });
  });

  it('有 @Auditable 装饰器时写入审计日志', (done) => {
    const metadata = {
      resourceType: 'RISK',
      action: 'CONFIRM',
      options: { resourceIdParam: 'id' },
    };
    const ctx = mockContext(
      metadata,
      { id: 'r-1' },
      { sub: 'u-1', role: 'ADMIN' },
      '10.0.0.1',
    );
    const next: CallHandler = { handle: () => of({ id: 'r-1' }) };

    interceptor.intercept(ctx, next).subscribe((result) => {
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u-1',
          action: 'CONFIRM',
          resourceType: 'RISK',
          resourceId: 'r-1',
          ip: '10.0.0.1',
        }),
      );
      expect(result.id).toBe('r-1');
      done();
    });
  });

  it('敏感字段应脱敏后再写入 audit detail', (done) => {
    const metadata = {
      resourceType: 'ELDER',
      action: 'UPDATE',
      options: { resourceIdParam: 'id', sensitiveFields: ['phone', 'idCard'] },
    };
    const body = { name: '张大爷', phone: '13800001111', idCard: '110101199001011234' };
    const ctx = {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          params: { id: 'e-1' },
          user: { sub: 'u-1', role: 'ADMIN' },
          ip: '10.0.0.2',
          body,
        }),
      }),
    } as unknown as ExecutionContext;
    reflector.get.mockReturnValue(metadata);
    const next: CallHandler = { handle: () => of({ id: 'e-1' }) };

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            name: '张大爷',
            phone: '1*********1',
            idCard: '****************1234',
          }),
        }),
      );
      done();
    });
  });

  it('未认证用户的 userId 应为 null', (done) => {
    const metadata = { resourceType: 'ELDER', action: 'CREATE', options: {} };
    const ctx = mockContext(metadata, { id: 'e-3' }, undefined, '10.0.0.3');
    const next: CallHandler = { handle: () => of({ id: 'e-3' }) };

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null }),
      );
      done();
    });
  });

  it('审计写入失败不应影响响应', (done) => {
    const metadata = { resourceType: 'AUTH', action: 'LOGIN', options: {} };
    auditService.log.mockRejectedValue(new Error('DB error'));
    const ctx = mockContext(metadata, {}, { sub: 'u-1', role: 'ADMIN' }, '127.0.0.1');
    const next: CallHandler = { handle: () => of({ token: 'jwt' }) };

    interceptor.intercept(ctx, next).subscribe((result) => {
      expect(result.token).toBe('jwt');
      expect(auditService.log).toHaveBeenCalled();
      done();
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd apps/api && npx jest --testPathPattern="audit.interceptor.spec.ts" --no-coverage
```

Expected: FAIL — `AuditInterceptor` 未定义。

- [ ] **Step 3: 实现 AuditInterceptor**

创建 `apps/api/src/modules/audit/audit.interceptor.ts`:

```typescript
import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import {
  AUDITABLE_KEY,
  AuditableMetadata,
} from './decorators/auditable.decorator';
import { sanitizeAuditData } from './filters/audit-sensitive.filter';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditableMetadata>(
      AUDITABLE_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub ?? null;
    const ip = request.ip ?? null;
    const { resourceType, action, options } = metadata;
    const resourceId = options.resourceIdParam
      ? request.params[options.resourceIdParam] ?? null
      : null;

    let detail: Record<string, unknown> | null = null;
    if (options.logRequestBody && request.body) {
      detail = { ...request.body };
      if (options.sensitiveFields?.length) {
        detail = sanitizeAuditData(detail, options.sensitiveFields);
      }
    }

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .log({ userId, action, resourceType, resourceId, detail, ip })
          .catch((err) => {
            this.logger.error(
              `Audit log in tap failed: ${action} on ${resourceType}`,
              err instanceof Error ? err.message : String(err),
            );
          });
      }),
    );
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd apps/api && npx jest --testPathPattern="audit.interceptor.spec.ts" --no-coverage
```

Expected: PASS — 所有 5 个测试通过。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/audit/
git commit -m "feat: add AuditInterceptor with @Auditable decorator integration"
```

---

### Task 5: Audit Controller — 审计日志查询端点

**Files:**
- Create: `apps/api/src/modules/audit/audit.controller.ts`
- Create: `apps/api/src/modules/audit/dto/audit-log-query.dto.ts`
- Create: `apps/api/src/modules/audit/dto/audit-log-response.dto.ts`
- Create: `apps/api/src/modules/audit/audit.module.ts`

- [ ] **Step 1: 创建 DTO**

创建 `apps/api/src/modules/audit/dto/audit-log-query.dto.ts`:

```typescript
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class AuditLogQueryDto {
  @IsOptional()
  @IsString()
  userId?: string;

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  resourceType?: string;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

- [ ] **Step 2: 创建 Audit Controller**

创建 `apps/api/src/modules/audit/audit.controller.ts`:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AuditService } from './audit.service';
import { AuditLogQueryDto } from './dto/audit-log-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Audit')
@ApiBearerAuth()
@Controller('audit')
@UseGuards(JwtAuthGuard, RolesGuard)
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get('logs')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '查询操作审计日志（仅管理员）' })
  findAll(@Query() query: AuditLogQueryDto) {
    return this.auditService.findAll({
      userId: query.userId,
      action: query.action,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      startDate: query.startDate,
      endDate: query.endDate,
      page: query.page ?? 1,
      limit: query.limit ?? 20,
    });
  }
}
```

- [ ] **Step 3: 创建 AuditModule**

创建 `apps/api/src/modules/audit/audit.module.ts`:

```typescript
import { Global, Module } from '@nestjs/common';
import { AuditController } from './audit.controller';
import { AuditService } from './audit.service';
import { AuditInterceptor } from './audit.interceptor';

@Global()
@Module({
  controllers: [AuditController],
  providers: [AuditService, AuditInterceptor],
  exports: [AuditService, AuditInterceptor],
})
export class AuditModule {}
```

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/audit/
git commit -m "feat: add AuditController with admin-only /audit/logs endpoint"
```

---

### Task 6: 注册 AuditModule + 接入 P0 模块

**Files:**
- Modify: `apps/api/src/app.module.ts`
- Modify: `apps/api/src/modules/auth/auth.controller.ts`
- Modify: `apps/api/src/modules/risk/risk.controller.ts`
- Modify: `apps/api/src/modules/elders/elders.controller.ts`
- Modify: `apps/api/src/modules/users/users.controller.ts`
- Modify: `apps/api/src/modules/work-orders/work-orders.controller.ts`

- [ ] **Step 1: 注册 AuditModule 到 AppModule**

在 `apps/api/src/app.module.ts`，添加 `AuditModule`:

```typescript
// 在 imports 中添加:
import { AuditModule } from './modules/audit/audit.module';

// imports 数组中添加:
AuditModule,
```

需加在 `PrismaModule` 之后，确保 PrismaService 已就绪。

- [ ] **Step 2: Auth 接入 — LOGIN/LOGOUT 审计**

先读取 `apps/api/src/modules/auth/auth.controller.ts`，然后在 adminLogin 方法上加装饰器:

```typescript
import { Auditable } from '../audit/decorators/auditable.decorator';

// 在 adminLogin 方法上:
@Auditable('AUTH', 'LOGIN', { logRequestBody: true, sensitiveFields: ['password'] })

// 在 logout 方法上:
@Auditable('AUTH', 'LOGOUT')
```

- [ ] **Step 3: Risk 接入 — CONFIRM/IGNORE/DISPATCH 审计**

在 `apps/api/src/modules/risk/risk.controller.ts` 的 review 方法上:

```typescript
import { Auditable } from '../audit/decorators/auditable.decorator';

// review 方法:
@Auditable('RISK', 'CONFIRM', { resourceIdParam: 'id' })
//  或 IGNORE（根据 status 判定，暂统一用 'REVIEW'；若需区分，可在 controller 内通过 query param 动态决定）

// 简化方案: 统一标记为 'REVIEW'
@Auditable('RISK', 'REVIEW', { resourceIdParam: 'id' })
```

- [ ] **Step 4: Elder 接入 — CREATE/UPDATE/DELETE 审计**

在 `apps/api/src/modules/elders/elders.controller.ts`:

```typescript
import { Auditable } from '../audit/decorators/auditable.decorator';

@Auditable('ELDER', 'CREATE', { sensitiveFields: ['idCard', 'phone'] })
// create 方法

@Auditable('ELDER', 'UPDATE', { resourceIdParam: 'id', sensitiveFields: ['idCard', 'phone'] })
// update 方法

@Auditable('ELDER', 'DELETE', { resourceIdParam: 'id' })
// delete 方法
```

- [ ] **Step 5: User 接入 — ROLE_CHANGE/ENABLE/DISABLE 审计**

在 `apps/api/src/modules/users/users.controller.ts`:

```typescript
import { Auditable } from '../audit/decorators/auditable.decorator';

@Auditable('USER', 'ROLE_CHANGE', { resourceIdParam: 'id', sensitiveFields: ['phone'] })
// update 方法 (可能含角色变更)
```

- [ ] **Step 6: WorkOrder 接入 — ASSIGN/COMPLETE/CANCEL 审计**

先读取 `apps/api/src/modules/work-orders/work-orders.controller.ts`，找到状态变更方法:

```typescript
import { Auditable } from '../audit/decorators/auditable.decorator';

@Auditable('WORK_ORDER', 'ASSIGN', { resourceIdParam: 'id' })
@Auditable('WORK_ORDER', 'COMPLETE', { resourceIdParam: 'id' })
@Auditable('WORK_ORDER', 'CANCEL', { resourceIdParam: 'id' })
```

- [ ] **Step 7: 验证编译通过**

```bash
cd apps/api && npx nest build
```

Expected: 编译成功，无类型错误。

- [ ] **Step 8: Commit**

```bash
git add apps/api/src/
git commit -m "feat: register AuditModule and wire @Auditable on P0 controllers"
```

---

### Task 7: 安装 Socket.IO 依赖

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: 安装依赖**

```bash
cd apps/api && pnpm add @nestjs/websockets @nestjs/platform-socket.io @socket.io/redis-adapter
```

- [ ] **Step 2: 验证**

```bash
cd apps/api && npx nest build
```

Expected: 编译成功。

- [ ] **Step 3: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore: add @nestjs/websockets, @nestjs/platform-socket.io, @socket.io/redis-adapter"
```

---

### Task 8: WebSocket Gateway — DashboardGateway

**Files:**
- Create: `apps/api/src/modules/notifications/gateway/dashboard.gateway.ts`
- Create: `apps/api/src/modules/notifications/gateway/dashboard.gateway.spec.ts`
- Create: `apps/api/src/modules/notifications/gateway/ws-auth.guard.ts`
- Create: `apps/api/src/modules/notifications/gateway/ws-roles.guard.ts`

- [ ] **Step 1: 编写 WsAuthGuard**

创建 `apps/api/src/modules/notifications/gateway/ws-auth.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      this.logger.warn('WS connection rejected: no token');
      throw new WsException('Unauthorized: missing token');
    }

    try {
      const payload = this.jwtService.verify(token);
      (client as unknown as Record<string, unknown>).user = payload;
      return true;
    } catch {
      this.logger.warn('WS connection rejected: invalid token');
      throw new WsException('Unauthorized: invalid token');
    }
  }

  private extractToken(client: Socket): string | null {
    // 1. handshake.auth.token
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token as string;
    }
    // 2. handshake.query.token
    if (client.handshake.query?.token) {
      return Array.isArray(client.handshake.query.token)
        ? client.handshake.query.token[0]
        : client.handshake.query.token;
    }
    return null;
  }
}
```

- [ ] **Step 2: 编写 WsRolesGuard**

创建 `apps/api/src/modules/notifications/gateway/ws-roles.guard.ts`:

```typescript
import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

@Injectable()
export class WsRolesGuard implements CanActivate {
  private readonly logger = new Logger(WsRolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const client = context.switchToWs().getClient();
    const user = (client as unknown as Record<string, unknown>).user as {
      role?: Role;
    } | undefined;

    if (!user?.role || !requiredRoles.includes(user.role)) {
      this.logger.warn(`WS room access denied: required ${requiredRoles.join(',')}`);
      return false;
    }

    return true;
  }
}
```

- [ ] **Step 3: 编写 Gateway 单元测试**

创建 `apps/api/src/modules/notifications/gateway/dashboard.gateway.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardGateway } from './dashboard.gateway';
import { NotificationsService } from '../notifications.service';
import { JwtService } from '@nestjs/jwt';
import { Server, Socket } from 'socket.io';

describe('DashboardGateway', () => {
  let gateway: DashboardGateway;
  let mockServer: Partial<Server>;

  beforeEach(async () => {
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardGateway,
        { provide: NotificationsService, useValue: { emitAndPersist: jest.fn() } },
        {
          provide: JwtService,
          useValue: { verify: jest.fn().mockReturnValue({ sub: 'u-1', role: 'ADMIN', district: '朝阳区' }) },
        },
      ],
    }).compile();

    gateway = module.get<DashboardGateway>(DashboardGateway);
    // Inject mock server
    (gateway as unknown as Record<string, unknown>).server = mockServer;
  });

  describe('handleConnection', () => {
    it('有效 token 时应加入房间', () => {
      const client = {
        handshake: { auth: { token: 'valid-jwt' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client);

      expect(client.join).toHaveBeenCalledWith('user:u-1');
      expect(client.join).toHaveBeenCalledWith('role:ADMIN');
      expect(client.join).toHaveBeenCalledWith('district:朝阳区');
      expect(client.disconnect).not.toHaveBeenCalled();
    });

    it('无 token 时应断开连接', () => {
      const client = {
        handshake: { auth: {} },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });

    it('无效 token 时应断开连接', () => {
      const jwtService = (gateway as unknown as Record<string, unknown>).jwtService as { verify: jest.Mock };
      jwtService.verify.mockImplementationOnce(() => { throw new Error('invalid'); });

      const client = {
        handshake: { auth: { token: 'bad-token' } },
        join: jest.fn(),
        disconnect: jest.fn(),
      } as unknown as Socket;

      gateway.handleConnection(client);

      expect(client.disconnect).toHaveBeenCalled();
      expect(client.join).not.toHaveBeenCalled();
    });
  });

  describe('emitToUser', () => {
    it('应向 user:{userId} 房间发送事件', () => {
      gateway.emitToUser('u-1', 'notification:new', { id: 'n-1' });

      expect(mockServer.to).toHaveBeenCalledWith('user:u-1');
      expect(mockServer.emit).toHaveBeenCalledWith('notification:new', { id: 'n-1' });
    });
  });

  describe('emitToRole', () => {
    it('应向 role:{role} 房间发送事件', () => {
      gateway.emitToRole('ADMIN', 'risk:alert', { level: 'HIGH' });

      expect(mockServer.to).toHaveBeenCalledWith('role:ADMIN');
      expect(mockServer.emit).toHaveBeenCalledWith('risk:alert', { level: 'HIGH' });
    });
  });

  describe('emitToDistrict', () => {
    it('应向 district:{district} 房间发送事件', () => {
      gateway.emitToDistrict('朝阳区', 'risk:alert', { level: 'MEDIUM' });

      expect(mockServer.to).toHaveBeenCalledWith('district:朝阳区');
      expect(mockServer.emit).toHaveBeenCalledWith('risk:alert', { level: 'MEDIUM' });
    });
  });
});
```

- [ ] **Step 4: 运行测试验证失败**

```bash
cd apps/api && npx jest --testPathPattern="dashboard.gateway.spec.ts" --no-coverage
```

Expected: FAIL — `DashboardGateway` 未定义。

- [ ] **Step 5: 实现 DashboardGateway**

创建 `apps/api/src/modules/notifications/gateway/dashboard.gateway.ts`:

```typescript
import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { NotificationsService } from '../notifications.service';

@WebSocketGateway({
  namespace: '/dashboard',
  cors: { origin: '*', credentials: true },
})
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private readonly logger = new Logger(DashboardGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly notificationsService: NotificationsService,
  ) {}

  handleConnection(client: Socket): void {
    // 手动验证 JWT（handleConnection 是 lifecycle hook，不支持 @UseGuards）
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`WS client ${client.id} rejected: no token`);
      client.disconnect();
      return;
    }

    try {
      const user = this.jwtService.verify(token);
      (client as unknown as Record<string, unknown>).user = user;

      // 加入用户专属房间
      client.join(`user:${user.sub}`);
      // 加入角色房间
      client.join(`role:${user.role}`);
      // 加入片区房间
      if (user.district) {
        client.join(`district:${user.district}`);
      }

      this.logger.log(`WS client ${client.id} connected as ${user.role}:${user.sub}`);
    } catch {
      this.logger.warn(`WS client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`WS client ${client.id} disconnected`);
    // Socket.IO 自动离开房间，无需手动清理
  }

  // --- 对外 emit 方法 ---

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToRole(role: string, event: string, data: unknown): void {
    this.server.to(`role:${role}`).emit(event, data);
  }

  emitToDistrict(district: string, event: string, data: unknown): void {
    this.server.to(`district:${district}`).emit(event, data);
  }
}
```

- [ ] **Step 6: 运行测试验证通过**

```bash
cd apps/api && npx jest --testPathPattern="dashboard.gateway.spec.ts" --no-coverage
```

Expected: PASS。

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/notifications/gateway/
git commit -m "feat: add DashboardGateway with Socket.IO rooms"
```

---

### Task 9: 增强 NotificationsService — emit + 通知中心查询

**Files:**
- Modify: `apps/api/src/modules/notifications/notifications.service.ts`
- Modify: `apps/api/src/modules/notifications/notifications.service.spec.ts`
- Modify: `apps/api/src/modules/notifications/dto/notification-query.dto.ts`

- [ ] **Step 1: 编写增强功能测试**

在 `apps/api/src/modules/notifications/notifications.service.spec.ts` 中追加以下测试（在执行完原有 `describe` 块后追加）:

```typescript
describe('emitAndPersist', () => {
  it('应写入 Notification 表并调用 gateway emit', async () => {
    const notificationRecord = {
      id: 'notif-2',
      targetType: 'USER',
      targetId: 'u-1',
      channel: 'websocket',
      templateId: null,
      payload: { title: '高风险预警', body: '张大爷风险等级 HIGH' },
      status: 'SENT',
      sentAt: new Date(),
      readAt: null,
      createdAt: new Date(),
    };
    mockPrisma.notification.create.mockResolvedValue(notificationRecord);

    const mockGateway = {
      emitToUser: jest.fn(),
      emitToRole: jest.fn(),
    };

    // 通过依赖注入覆盖
    // 这里测试的核心是 service 行为的正确性
    const result = await service.emitAndPersist({
      event: 'risk:alert',
      roomType: 'role',
      roomId: 'ADMIN',
      payload: { level: 'HIGH', elderId: 'e-1' },
    });

    expect(mockPrisma.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        channel: 'websocket',
        payload: expect.objectContaining({
          level: 'HIGH',
          elderId: 'e-1',
          event: 'risk:alert',
        }),
        status: 'SENT',
        sentAt: expect.any(Date),
      }),
    });
    expect(result.id).toBe('notif-2');
  });
});

describe('getInbox', () => {
  it('应返回当前用户的未读/已读通知', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([
      { id: 'n-1', targetType: 'USER', targetId: 'u-1', status: 'SENT', readAt: null, createdAt: new Date() },
    ]);
    mockPrisma.notification.count.mockResolvedValue(1);

    const result = await service.getInbox({ userId: 'u-1', page: 1, limit: 20, includeRead: true });

    expect(result.items).toHaveLength(1);
    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
      where: { targetType: 'USER', targetId: 'u-1' },
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  });

  it('includeRead=false 时应过滤已读', async () => {
    mockPrisma.notification.findMany.mockResolvedValue([]);
    mockPrisma.notification.count.mockResolvedValue(0);

    await service.getInbox({ userId: 'u-1', page: 1, limit: 20, includeRead: false });

    expect(mockPrisma.notification.findMany).toHaveBeenCalledWith({
      where: { targetType: 'USER', targetId: 'u-1', readAt: null },
      skip: 0,
      take: 20,
      orderBy: { createdAt: 'desc' },
    });
  });
});

describe('markAsRead', () => {
  it('应更新通知的 readAt 字段', async () => {
    mockPrisma.notification.update.mockResolvedValue({
      id: 'n-1', readAt: new Date(),
    });

    await service.markAsRead('n-1', 'u-1');

    expect(mockPrisma.notification.update).toHaveBeenCalledWith({
      where: { id: 'n-1', targetType: 'USER', targetId: 'u-1' },
      data: { readAt: expect.any(Date) },
    });
  });
});

describe('getUnreadCount', () => {
  it('应返回未读通知数量', async () => {
    mockPrisma.notification.count.mockResolvedValue(5);

    const result = await service.getUnreadCount('u-1');

    expect(result).toBe(5);
    expect(mockPrisma.notification.count).toHaveBeenCalledWith({
      where: { targetType: 'USER', targetId: 'u-1', readAt: null },
    });
  });
});
```

更新 mockPrisma 添加缺失的方法。在文件顶部 `mockPrisma` 对象中追加:

```typescript
notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn(), update: jest.fn() },
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd apps/api && npx jest --testPathPattern="notifications.service.spec.ts" --no-coverage
```

Expected: FAIL — 新方法未定义。

- [ ] **Step 3: 实现 NotificationsService 增强**

修改 `apps/api/src/modules/notifications/notifications.service.ts`，新增以下方法（在原有 `findAll` 方法后追加）:

```typescript
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface EmitInput {
  event: string;
  roomType: 'user' | 'role' | 'district';
  roomId: string;
  payload: Record<string, unknown>;
}

// ... 原有 SendInput, QueryInput ...

@Injectable()
export class NotificationsService {
  // 声明 gateway 引用（由 module 注入，避免循环依赖）
  private gateway: { emitToUser: Function; emitToRole: Function; emitToDistrict: Function } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  setGateway(gateway: { emitToUser: Function; emitToRole: Function; emitToDistrict: Function }): void {
    this.gateway = gateway;
  }

  async emitAndPersist(input: EmitInput) {
    const { event, roomType, roomId, payload } = input;

    // 1. 落盘 Notification 表
    const notification = await this.prisma.notification.create({
      data: {
        targetType: roomType === 'user' ? 'USER' : 'SYSTEM',
        targetId: roomId,
        channel: 'websocket',
        templateId: null,
        payload: { event, ...payload } as Prisma.InputJsonValue,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    // 2. 实时推送到 WS
    try {
      if (this.gateway) {
        switch (roomType) {
          case 'user':
            this.gateway.emitToUser(roomId, event, payload);
            break;
          case 'role':
            this.gateway.emitToRole(roomId, event, payload);
            break;
          case 'district':
            this.gateway.emitToDistrict(roomId, event, payload);
            break;
        }
      }
    } catch (error) {
      // WS 推送失败不影响落盘
    }

    return notification;
  }

  async getInbox(input: { userId: string; page: number; limit: number; includeRead?: boolean }) {
    const { userId, page, limit, includeRead } = input;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      targetType: 'USER',
      targetId: userId,
    };
    if (!includeRead) {
      where.readAt = null;
    }

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId, targetType: 'USER', targetId: userId },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { targetType: 'USER', targetId: userId, readAt: null },
    });
  }

  // ... 原有 send, findAll 方法保持不变 ...
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd apps/api && npx jest --testPathPattern="notifications.service.spec.ts" --no-coverage
```

Expected: PASS。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/
git commit -m "feat: add emitAndPersist, inbox, markAsRead, unreadCount to NotificationsService"
```

---

### Task 10: NotificationsModule 完整装配 — Gateway ↔ Service 绑定 + Controller 增强

**Files:**
- Modify: `apps/api/src/modules/notifications/notifications.module.ts`
- Modify: `apps/api/src/modules/notifications/notifications.controller.ts`
- Modify: `apps/api/src/modules/notifications/dto/notification-query.dto.ts`

- [ ] **Step 1: 增强 NotificationsController**

修改 `apps/api/src/modules/notifications/notifications.controller.ts`，在原有端点后追加:

```typescript
// 追加这些导入:
import { Param, Req } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

// 在 controller 类内追加方法:

@Get('inbox')
@ApiOperation({ summary: '当前用户通知列表' })
async getInbox(
  @Query() query: NotificationQueryDto,
  @CurrentUser() user: any,
) {
  return this.notificationsService.getInbox({
    userId: user.sub,
    page: query.page ?? 1,
    limit: query.limit ?? 20,
    includeRead: query.includeRead ?? false,
  });
}

@Post(':id/read')
@ApiOperation({ summary: '标记通知已读' })
async markAsRead(
  @Param('id') id: string,
  @CurrentUser() user: any,
) {
  await this.notificationsService.markAsRead(id, user.sub);
  return { success: true };
}

@Get('unread-count')
@ApiOperation({ summary: '未读通知计数' })
async getUnreadCount(@CurrentUser() user: any) {
  const count = await this.notificationsService.getUnreadCount(user.sub);
  return { count };
}
```

- [ ] **Step 2: 更新 NotificationQueryDto**

修改 `apps/api/src/modules/notifications/dto/notification-query.dto.ts`，添加 `includeRead`:

```typescript
import { IsOptional, IsBoolean, IsInt, Min, Max, IsString } from 'class-validator';
import { Type, Transform } from 'class-transformer';

export class NotificationQueryDto {
  @IsOptional()
  @IsString()
  targetType?: string;

  @IsOptional()
  @IsString()
  targetId?: string;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  includeRead?: boolean = false;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

- [ ] **Step 3: 更新 NotificationsModule 注册 Gateway**

修改 `apps/api/src/modules/notifications/notifications.module.ts`:

```typescript
import { Module, OnModuleInit } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { BullModule } from '@nestjs/bullmq';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { NotificationSendProcessor } from './processors/notification-send.processor';
import { ConsoleChannel } from './channels/console.channel';
import { WeChatChannel } from './channels/wechat.channel';
import { NOTIFICATION_CHANNEL } from './channels/notification-channel.interface';
import { DashboardGateway } from './gateway/dashboard.gateway';
import { WsAuthGuard } from './gateway/ws-auth.guard';
import { WsRolesGuard } from './gateway/ws-roles.guard';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'notifications' }),
    JwtModule.register({ secret: process.env.JWT_SECRET ?? 'dev-secret' }),
  ],
  controllers: [NotificationsController],
  providers: [
    NotificationsService,
    NotificationSendProcessor,
    ConsoleChannel,
    WeChatChannel,
    {
      provide: NOTIFICATION_CHANNEL,
      useValue: process.env.NOTIFICATION_CHANNEL ?? 'console',
    },
    DashboardGateway,
    WsAuthGuard,
    WsRolesGuard,
  ],
  exports: [NotificationsService, DashboardGateway],
})
export class NotificationsModule implements OnModuleInit {
  constructor(
    private readonly notificationsService: NotificationsService,
    private readonly gateway: DashboardGateway,
  ) {}

  onModuleInit() {
    // 将 Gateway 注入 Service 以解决模块内循环引用（Gateway → Service → Gateway）
    this.notificationsService.setGateway(this.gateway);
  }
}
```

- [ ] **Step 4: 验证编译通过**

```bash
cd apps/api && npx nest build
```

Expected: 编译成功。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/notifications/
git commit -m "feat: add notification inbox, markAsRead, unreadCount API endpoints"
```

---

### Task 11: 业务模块接入 WebSocket 推送

**Files:**
- Modify: `apps/api/src/modules/risk/risk.service.ts`
- Modify: `apps/api/src/modules/work-orders/work-orders.service.ts`
- Modify: `apps/api/src/modules/check-ins/check-ins.service.ts`

- [ ] **Step 1: RiskService 接入 HIGH 风险事件推送**

在 `apps/api/src/modules/risk/risk.service.ts` 中注入 `NotificationsService`：

修改构造函数，添加:

```typescript
import { NotificationsService } from '../notifications/notifications.service';
// 在 constructor 参数中追加:
private readonly notificationsService: NotificationsService,
```

在 `evaluateAndCreateEvent` 方法中，成功创建 RiskEvent 后，当 level 为 HIGH 时推送:

```typescript
// 在 return this.prisma.riskEvent.create(...) 之前:
const event = await this.prisma.riskEvent.create({...});

// 推送 HIGH 风险预警
if (event.level === RiskLevel.HIGH) {
  const elder = await this.prisma.elder.findUnique({
    where: { id: input.elderId },
    select: { district: true },
  });
  this.notificationsService.emitAndPersist({
    event: 'risk:alert',
    roomType: 'role',
    roomId: 'ADMIN',
    payload: {
      riskEventId: event.id,
      elderId: event.elderId,
      level: event.level,
      source: event.source,
      reason: event.reason,
    },
  }).catch((err) => { /* 推送失败不影响主流程 */ });

  if (elder?.district) {
    this.notificationsService.emitAndPersist({
      event: 'risk:alert',
      roomType: 'district',
      roomId: elder.district,
      payload: {
        riskEventId: event.id,
        elderId: event.elderId,
        level: event.level,
        source: event.source,
        reason: event.reason,
      },
    }).catch((err) => { /* 推送失败不影响主流程 */ });
  }
}

return event;
```

- [ ] **Step 2: WorkOrdersService 接入工单状态变更推送**

在 `apps/api/src/modules/work-orders/work-orders.service.ts` 中注入 `NotificationsService`，在状态变更方法中推送。

找到 assignWorkOrder/setInProgress/completeWorkOrder/cancelWorkOrder 方法（如这些方法命名不同，参照实际代码），在状态变更后推送:

```typescript
import { NotificationsService } from '../notifications/notifications.service';
// constructor 注入

// 在每个状态变更方法成功后:
this.notificationsService.emitAndPersist({
  event: 'workorder:update',
  roomType: 'user',
  roomId: assigneeId, // 指派给的用户
  payload: {
    workOrderId: updatedWorkOrder.id,
    status: updatedWorkOrder.status,
    type: updatedWorkOrder.type,
    elderId: updatedWorkOrder.elderId,
  },
}).catch((err) => Logger.error('WS push failed', err));

// 同时通知 ADMIN 角色
this.notificationsService.emitAndPersist({
  event: 'workorder:update',
  roomType: 'role',
  roomId: 'ADMIN',
  payload: {
    workOrderId: updatedWorkOrder.id,
    status: updatedWorkOrder.status,
    type: updatedWorkOrder.type,
    elderId: updatedWorkOrder.elderId,
  },
}).catch((err) => Logger.error('WS push failed', err));
```

- [ ] **Step 3: 验证编译通过**

```bash
cd apps/api && npx nest build
```

Expected: 编译成功。

- [ ] **Step 4: 更新 RiskService 单测**

在 `apps/api/src/modules/risk/risk.service.spec.ts` 中添加 `NotificationsService` mock:

```typescript
const mockNotificationsService = {
  emitAndPersist: jest.fn().mockResolvedValue({ id: 'notif-99' }),
};

// 在 providers 中添加:
{ provide: NotificationsService, useValue: mockNotificationsService },
```

在 `evaluateAndCreateEvent` 测试中追加验证 HIGH 级别推送:

```typescript
it('HIGH 级别风险事件应推送 WebSocket', async () => {
  mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
  mockPrisma.riskEvent.findFirst.mockResolvedValue(null);
  mockScoringService.evaluate.mockReturnValue(scoringResult);
  mockPrisma.riskEvent.create.mockResolvedValue({ ...mockRiskEvent, level: RiskLevel.HIGH });

  await service.evaluateAndCreateEvent(input);

  expect(mockNotificationsService.emitAndPersist).toHaveBeenCalledWith(
    expect.objectContaining({
      event: 'risk:alert',
      roomType: 'role',
      roomId: 'ADMIN',
    }),
  );
});
```

```typescript
it('非 HIGH 级别不推送 WebSocket', async () => {
  mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
  mockPrisma.riskEvent.findFirst.mockResolvedValue(null);
  mockScoringService.evaluate.mockReturnValue({
    score: 30, level: RiskLevel.MEDIUM, reason: ['异常文本'], ruleVersion: 1,
  });
  mockPrisma.riskEvent.create.mockResolvedValue({
    ...mockRiskEvent, level: RiskLevel.MEDIUM, score: 30,
  });

  await service.evaluateAndCreateEvent(input);

  expect(mockNotificationsService.emitAndPersist).not.toHaveBeenCalled();
});
```

- [ ] **Step 5: 运行测试验证**

```bash
cd apps/api && npx jest --testPathPattern="risk.service.spec.ts" --no-coverage
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/risk/ apps/api/src/modules/work-orders/
git commit -m "feat: wire WebSocket push in RiskService and WorkOrdersService"
```

---

### Task 12: Dashboard 模块 — Service 层

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.service.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.service.spec.ts`
- Create: `apps/api/src/modules/dashboard/dto/`

- [ ] **Step 1: 创建 Dashboard DTOs**

创建 `apps/api/src/modules/dashboard/dto/dashboard-query.dto.ts`:

```typescript
import { IsOptional, IsString, IsIn } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['7d', '30d'])
  period?: string = '7d';

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
```

创建 `apps/api/src/modules/dashboard/dto/risk-overview.dto.ts`:

```typescript
export class RiskOverviewDto {
  byLevel: Array<{ level: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  trend: Array<{ date: string; count: number }>;
  total: number;
  periodDays: number;
}
```

创建 `apps/api/src/modules/dashboard/dto/work-order-efficiency.dto.ts`:

```typescript
export class WorkOrderEfficiencyDto {
  byStatus: Array<{ status: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  avgResponseHours: number;
  avgCompletionHours: number;
  overdueCount: number;
  total: number;
}
```

创建 `apps/api/src/modules/dashboard/dto/elder-coverage.dto.ts`:

```typescript
export class ElderCoverageDto {
  byDistrict: Array<{ district: string; total: number; checkedIn: number; rate: number }>;
  todayCheckInRate: number;
  weekCheckInRate: number;
  abnormalRate: number;
  highRiskElders: Array<{
    elderId: string;
    name: string;
    district: string;
    serviceLevel: string;
    latestRiskLevel: string;
    lastCheckIn: string | null;
  }>;
}
```

创建 `apps/api/src/modules/dashboard/dto/grid-worker-performance.dto.ts`:

```typescript
export class GridWorkerPerformanceDto {
  workers: Array<{
    userId: string;
    name: string;
    role: string;
    district: string;
    dutyStatus: string;
    completedOrders: number;
    avgResponseHours: number;
  }>;
}
```

- [ ] **Step 2: 编写 DashboardService 单元测试**

创建 `apps/api/src/modules/dashboard/dashboard.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardService } from './dashboard.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('DashboardService', () => {
  let service: DashboardService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const family = { sub: 'family-1', role: Role.FAMILY, district: undefined };

  const mockPrisma = {
    riskEvent: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
    },
    workOrder: {
      groupBy: jest.fn(),
      count: jest.fn(),
      findMany: jest.fn(),
      aggregate: jest.fn(),
    },
    elder: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    checkIn: {
      findMany: jest.fn(),
      count: jest.fn(),
      groupBy: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    $queryRaw: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DashboardService>(DashboardService);
    jest.clearAllMocks();
  });

  describe('getRiskOverview', () => {
    it('应返回风险等级分布和来源分布', async () => {
      mockPrisma.riskEvent.groupBy
        .mockResolvedValueOnce([{ level: 'HIGH', _count: { id: 2 } }, { level: 'MEDIUM', _count: { id: 3 } }])
        .mockResolvedValueOnce([{ source: 'MISSED_CHECKIN', _count: { id: 3 } }, { source: 'DEVICE', _count: { id: 2 } }]);
      mockPrisma.riskEvent.count.mockResolvedValue(5);
      mockPrisma.$queryRaw.mockResolvedValue([{ date: '2026-06-11', count: 2 }]);

      const result = await service.getRiskOverview({ period: '7d' }, admin);

      expect(result.total).toBe(5);
      expect(result.byLevel).toHaveLength(2);
      expect(result.bySource).toHaveLength(2);
      expect(mockPrisma.riskEvent.groupBy).toHaveBeenCalled();
    });

    it('片区角色应限制查询范围', async () => {
      mockPrisma.riskEvent.groupBy.mockResolvedValue([]);
      mockPrisma.riskEvent.count.mockResolvedValue(0);
      mockPrisma.$queryRaw.mockResolvedValue([]);

      await service.getRiskOverview({ period: '7d' }, worker);

      expect(mockPrisma.riskEvent.groupBy).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: expect.any(Object),
            elder: { district: '朝阳区' },
          }),
        }),
      );
    });
  });

  describe('getWorkOrderEfficiency', () => {
    it('应返回工单状态分布和平均响应时长', async () => {
      mockPrisma.workOrder.groupBy.mockResolvedValue([
        { status: 'PENDING', _count: { id: 5 } },
        { status: 'COMPLETED', _count: { id: 3 } },
      ]);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.workOrder.count.mockResolvedValue(8);

      const result = await service.getWorkOrderEfficiency({ period: '7d' }, admin);

      expect(result.byStatus).toHaveLength(2);
      expect(result.total).toBe(8);
    });
  });
});
```

- [ ] **Step 3: 运行测试验证失败**

```bash
cd apps/api && npx jest --testPathPattern="dashboard.service.spec.ts" --no-coverage
```

Expected: FAIL — `DashboardService` 未定义。

- [ ] **Step 4: 实现 DashboardService**

创建 `apps/api/src/modules/dashboard/dashboard.service.ts`:

```typescript
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';
import { RiskOverviewDto } from './dto/risk-overview.dto';
import { WorkOrderEfficiencyDto } from './dto/work-order-efficiency.dto';
import { ElderCoverageDto } from './dto/elder-coverage.dto';
import { GridWorkerPerformanceDto } from './dto/grid-worker-performance.dto';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

interface QueryOptions {
  period?: string;
  district?: string;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateRange(period: string | undefined): { gte: Date } {
    const days = period === '30d' ? 30 : 7;
    return { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  }

  private buildElderWhere(requester: Requester): Record<string, unknown> {
    if (requester.role === Role.ADMIN) return {};
    if (requester.role === Role.FAMILY || requester.role === Role.VOLUNTEER) {
      return {
        familyLinks: { some: { userId: requester.sub } },
      };
    }
    return { district: requester.district };
  }

  async getRiskOverview(
    query: QueryOptions,
    requester: Requester,
  ): Promise<RiskOverviewDto> {
    const createdAt = this.getDateRange(query.period);
    const elderWhere = this.buildElderWhere(requester);
    const hasDistrictFilter = requester.role !== Role.ADMIN &&
      requester.role !== Role.FAMILY &&
      requester.role !== Role.VOLUNTEER;

    const where: Record<string, unknown> = { createdAt };
    if (hasDistrictFilter) {
      where.elder = elderWhere;
    }

    const [byLevel, bySource, total] = await Promise.all([
      this.prisma.riskEvent.groupBy({
        by: ['level'],
        where,
        _count: { id: true },
      }),
      this.prisma.riskEvent.groupBy({
        by: ['source'],
        where,
        _count: { id: true },
      }),
      this.prisma.riskEvent.count({ where }),
    ]);

    // 趋势：按日期分组 (降级为 raw query 或应用层聚合)
    const trend: Array<{ date: string; count: number }> = [];
    // 简化：全量查询后应用层聚合
    const events = await this.prisma.riskEvent.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const dateMap = new Map<string, number>();
    for (const e of events) {
      const d = e.createdAt.toISOString().slice(0, 10);
      dateMap.set(d, (dateMap.get(d) ?? 0) + 1);
    }
    for (const [date, count] of dateMap) {
      trend.push({ date, count });
    }

    return {
      byLevel: byLevel.map((r) => ({ level: r.level, count: r._count.id })),
      bySource: bySource.map((r) => ({ source: r.source, count: r._count.id })),
      trend,
      total,
      periodDays: query.period === '30d' ? 30 : 7,
    };
  }

  async getWorkOrderEfficiency(
    query: QueryOptions,
    requester: Requester,
  ): Promise<WorkOrderEfficiencyDto> {
    const createdAt = this.getDateRange(query.period);
    const elderWhere = this.buildElderWhere(requester);
    const hasDistrictFilter = requester.role !== Role.ADMIN &&
      requester.role !== Role.FAMILY &&
      requester.role !== Role.VOLUNTEER;

    const where: Record<string, unknown> = { createdAt };
    if (hasDistrictFilter) {
      where.elder = elderWhere;
    }

    const [byStatus, byType, total, completedOrders] = await Promise.all([
      this.prisma.workOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.workOrder.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
      }),
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.findMany({
        where: { ...where, status: 'COMPLETED' },
        select: { createdAt: true, completedAt: true },
      }),
    ]);

    // 计算平均响应/完成时长
    let totalResponseMs = 0;
    let totalCompletionMs = 0;
    let completedCount = 0;
    for (const wo of completedOrders) {
      if (wo.completedAt) {
        totalCompletionMs += wo.completedAt.getTime() - wo.createdAt.getTime();
        completedCount++;
      }
    }

    // 超时工单：已超过 deadline 且未完成
    const overdueCount = await this.prisma.workOrder.count({
      where: {
        ...where,
        deadline: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });

    return {
      byStatus: byStatus.map((r) => ({ status: r.status, count: r._count.id })),
      byType: byType.map((r) => ({ type: r.type, count: r._count.id })),
      avgResponseHours: completedCount > 0
        ? Math.round((totalCompletionMs / completedCount / 3600000) * 100) / 100 : 0,
      avgCompletionHours: completedCount > 0
        ? Math.round((totalCompletionMs / completedCount / 3600000) * 100) / 100 : 0,
      overdueCount,
      total,
    };
  }

  async getElderCoverage(
    query: QueryOptions,
    requester: Requester,
  ): Promise<ElderCoverageDto> {
    const elderWhere = this.buildElderWhere(requester);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalElders, todayCheckIns, weekCheckIns, abnormalCheckIns] = await Promise.all([
      this.prisma.elder.count({ where: elderWhere }),
      this.prisma.checkIn.count({
        where: {
          createdAt: { gte: todayStart },
          elder: elderWhere,
        },
      }),
      this.prisma.checkIn.count({
        where: {
          createdAt: { gte: sevenDaysAgo },
          elder: elderWhere,
        },
      }),
      this.prisma.checkIn.count({
        where: {
          status: 'ABNORMAL',
          elder: elderWhere,
        },
      }),
    ]);

    // 按片区分组
    const districtGroups = await this.prisma.elder.groupBy({
      by: ['district'],
      where: elderWhere,
      _count: { id: true },
    });

    const byDistrict = await Promise.all(
      districtGroups.map(async (d) => {
        const checkedIn = await this.prisma.checkIn.count({
          where: {
            createdAt: { gte: sevenDaysAgo },
            elder: { district: d.district },
          },
        });
        return {
          district: d.district,
          total: d._count.id,
          checkedIn,
          rate: d._count.id > 0 ? Math.round((checkedIn / d._count.id) * 100) : 0,
        };
      }),
    );

    // 重点关注老人：高服务等级 + 近期 HIGH 风险
    const highRiskElders = await this.prisma.elder.findMany({
      where: {
        ...elderWhere,
        serviceLevel: { in: ['HIGH', 'KEY'] },
      },
      include: {
        riskEvents: {
          where: { level: 'HIGH', createdAt: { gte: sevenDaysAgo } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        checkIns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: 20,
    });

    return {
      byDistrict,
      todayCheckInRate: totalElders > 0 ? Math.round((todayCheckIns / totalElders) * 100) : 0,
      weekCheckInRate: totalElders > 0 ? Math.round((weekCheckIns / totalElders) * 100) : 0,
      abnormalRate: totalElders > 0 ? Math.round((abnormalCheckIns / totalElders) * 100) : 0,
      highRiskElders: highRiskElders
        .filter((e) => e.riskEvents.length > 0)
        .map((e) => ({
          elderId: e.id,
          name: e.name,
          district: e.district,
          serviceLevel: e.serviceLevel,
          latestRiskLevel: e.riskEvents[0]?.level ?? null,
          lastCheckIn: e.checkIns[0]?.createdAt?.toISOString() ?? null,
        })),
    };
  }

  async getGridWorkerPerformance(
    _query: QueryOptions,
    requester: Requester,
  ): Promise<GridWorkerPerformanceDto> {
    const userWhere: Record<string, unknown> = {
      role: { in: ['GRID_WORKER', 'COMMUNITY_DOCTOR', 'PROPERTY'] },
    };
    if (requester.role === Role.ADMIN && requester.district) {
      userWhere.district = requester.district;
    } else if (requester.role !== Role.ADMIN) {
      userWhere.district = requester.district;
    }

    const workers = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        role: true,
        district: true,
        dutyStatus: true,
      },
    });

    const result = await Promise.all(
      workers.map(async (w) => {
        const completedOrders = await this.prisma.workOrder.count({
          where: { assigneeId: w.id, status: 'COMPLETED' },
        });

        const completedList = await this.prisma.workOrder.findMany({
          where: { assigneeId: w.id, status: 'COMPLETED' },
          select: { createdAt: true, completedAt: true },
        });

        let totalResponseMs = 0;
        for (const wo of completedList) {
          if (wo.completedAt) {
            totalResponseMs += wo.completedAt.getTime() - wo.createdAt.getTime();
          }
        }

        return {
          userId: w.id,
          name: w.name,
          role: w.role,
          district: w.district ?? '',
          dutyStatus: w.dutyStatus,
          completedOrders,
          avgResponseHours: completedList.length > 0
            ? Math.round((totalResponseMs / completedList.length / 3600000) * 100) / 100 : 0,
        };
      }),
    );

    return { workers: result };
  }
}
```

- [ ] **Step 5: 运行测试验证通过**

```bash
cd apps/api && npx jest --testPathPattern="dashboard.service.spec.ts" --no-coverage
```

Expected: PASS。

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/dashboard/
git commit -m "feat: add DashboardService with four aggregate methods"
```

---

### Task 13: Dashboard Controller + Module — 聚合接口

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.controller.ts`
- Create: `apps/api/src/modules/dashboard/dashboard.module.ts`

- [ ] **Step 1: 创建 DashboardController**

创建 `apps/api/src/modules/dashboard/dashboard.controller.ts`:

```typescript
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Dashboard')
@ApiBearerAuth()
@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('risk-overview')
  @ApiOperation({ summary: '风险概览 — 等级/来源分布 + 趋势' })
  getRiskOverview(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getRiskOverview(query, user);
  }

  @Get('work-order-efficiency')
  @ApiOperation({ summary: '工单效率 — 状态/类型分布 + 平均时长' })
  getWorkOrderEfficiency(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getWorkOrderEfficiency(query, user);
  }

  @Get('elder-coverage')
  @ApiOperation({ summary: '老人覆盖 — 片区覆盖率 + 重点关注' })
  getElderCoverage(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getElderCoverage(query, user);
  }

  @Get('grid-worker-performance')
  @ApiOperation({ summary: '网格员效能' })
  getGridWorkerPerformance(
    @Query() query: DashboardQueryDto,
    @CurrentUser() user: any,
  ) {
    return this.dashboardService.getGridWorkerPerformance(query, user);
  }
}
```

- [ ] **Step 2: 创建 DashboardModule**

创建 `apps/api/src/modules/dashboard/dashboard.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';

@Module({
  controllers: [DashboardController],
  providers: [DashboardService],
})
export class DashboardModule {}
```

- [ ] **Step 3: 注册到 AppModule**

在 `apps/api/src/app.module.ts` 的 imports 中添加:

```typescript
import { DashboardModule } from './modules/dashboard/dashboard.module';

// imports 数组:
DashboardModule,
```

- [ ] **Step 4: 验证编译和启动**

```bash
cd apps/api && npx nest build
```

Expected: 编译成功。

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/dashboard/ apps/api/src/app.module.ts
git commit -m "feat: add DashboardModule with four aggregate endpoints"
```

---

### Task 14: Dashboard 预聚合定时任务

**Files:**
- Create: `apps/api/src/modules/dashboard/processors/dashboard-aggregate.processor.ts`
- Create: `apps/api/src/modules/dashboard/processors/dashboard-aggregate.processor.spec.ts`

- [ ] **Step 1: 编写处理器测试**

创建 `apps/api/src/modules/dashboard/processors/dashboard-aggregate.processor.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { DashboardAggregateProcessor } from './dashboard-aggregate.processor';
import { DashboardService } from '../dashboard.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Job } from 'bullmq';

describe('DashboardAggregateProcessor', () => {
  let processor: DashboardAggregateProcessor;

  const mockDashboardService = {
    getRiskOverview: jest.fn().mockResolvedValue({ total: 5 }),
    getWorkOrderEfficiency: jest.fn().mockResolvedValue({ total: 8 }),
    getElderCoverage: jest.fn().mockResolvedValue({ totalElders: 50 }),
    getGridWorkerPerformance: jest.fn().mockResolvedValue({ workers: [] }),
  };

  const mockPrisma = {
    schedulerRun: { create: jest.fn(), update: jest.fn() },
  };

  const admin = { sub: 'system', role: 'ADMIN' as const };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardAggregateProcessor,
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    processor = module.get<DashboardAggregateProcessor>(DashboardAggregateProcessor);
    jest.clearAllMocks();
  });

  it('应处理 dashboard-aggregate 任务', async () => {
    mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-1' });

    const job = { name: 'dashboard-aggregate', id: 'job-1' } as Job;
    await processor.process(job);

    expect(mockPrisma.schedulerRun.create).toHaveBeenCalled();
    expect(mockDashboardService.getRiskOverview).toHaveBeenCalled();
    expect(mockDashboardService.getWorkOrderEfficiency).toHaveBeenCalled();
    expect(mockPrisma.schedulerRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
  });

  it('聚合查询失败时应标记 FAILED', async () => {
    mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-2' });
    mockDashboardService.getRiskOverview.mockRejectedValue(new Error('DB error'));

    const job = { name: 'dashboard-aggregate', id: 'job-2' } as Job;
    await processor.process(job);

    expect(mockPrisma.schedulerRun.update).toHaveBeenCalledWith({
      where: { id: 'run-2' },
      data: expect.objectContaining({ status: 'FAILED', error: expect.any(String) }),
    });
  });
});
```

- [ ] **Step 2: 运行测试验证失败**

```bash
cd apps/api && npx jest --testPathPattern="dashboard-aggregate.processor.spec.ts" --no-coverage
```

Expected: FAIL。

- [ ] **Step 3: 实现处理器**

创建 `apps/api/src/modules/dashboard/processors/dashboard-aggregate.processor.ts`:

```typescript
import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { DashboardService } from '../dashboard.service';
import { PrismaService } from '../../../common/prisma/prisma.service';

@Processor('scheduler')
export class DashboardAggregateProcessor extends WorkerHost {
  private readonly logger = new Logger(DashboardAggregateProcessor.name);

  constructor(
    private readonly dashboardService: DashboardService,
    private readonly prisma: PrismaService,
  ) {
    super();
  }

  async process(job: Job): Promise<unknown> {
    if (job.name !== 'dashboard-aggregate') {
      return;
    }

    return this.handleAggregate(job);
  }

  async handleAggregate(job: Job) {
    this.logger.log(`Processing dashboard-aggregate job ${job.id}`);

    const run = await this.prisma.schedulerRun.create({
      data: { jobName: 'dashboard-aggregate', status: 'RUNNING' },
    });

    const admin = { sub: 'system', role: 'ADMIN' as const };
    let itemsProcessed = 0;

    try {
      // 并行预计算四个维度的聚合
      const results = await Promise.allSettled([
        this.dashboardService.getRiskOverview({ period: '7d' }, admin),
        this.dashboardService.getWorkOrderEfficiency({ period: '7d' }, admin),
        this.dashboardService.getElderCoverage({ period: '7d' }, admin),
        this.dashboardService.getGridWorkerPerformance({}, admin),
      ]);

      // 将结果写入 Redis 缓存（后续实现，当前仅记录 SchedulerRun）
      for (const result of results) {
        if (result.status === 'fulfilled') {
          itemsProcessed++;
        }
      }

      const errors = results
        .filter((r) => r.status === 'rejected')
        .map((r) => (r as PromiseRejectedResult).reason?.message ?? 'unknown error')
        .join('; ');

      await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: {
          status: errors ? 'PARTIAL' : 'COMPLETED',
          completedAt: new Date(),
          itemsProcessed,
          error: errors || null,
        },
      });

      this.logger.log(`Dashboard aggregate completed: ${itemsProcessed}/4 successful`);
    } catch (error) {
      this.logger.error('Dashboard aggregate failed', error instanceof Error ? error.message : String(error));

      await this.prisma.schedulerRun.update({
        where: { id: run.id },
        data: {
          status: 'FAILED',
          completedAt: new Date(),
          error: error instanceof Error ? error.message : String(error),
        },
      });
    }
  }
}
```

- [ ] **Step 4: 运行测试验证通过**

```bash
cd apps/api && npx jest --testPathPattern="dashboard-aggregate.processor.spec.ts" --no-coverage
```

Expected: PASS。

- [ ] **Step 5: 注册处理器到 DashboardModule**

修改 `apps/api/src/modules/dashboard/dashboard.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { DashboardAggregateProcessor } from './processors/dashboard-aggregate.processor';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'scheduler' }),
  ],
  controllers: [DashboardController],
  providers: [DashboardService, DashboardAggregateProcessor],
})
export class DashboardModule {}
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/dashboard/
git commit -m "feat: add DashboardAggregateProcessor for scheduled pre-aggregation"
```

---

### Task 15: E2E 测试与最终验证

**Files:**
- Create: `apps/api/src/modules/dashboard/dashboard.e2e-spec.ts`
- Verify: 全量测试 + lint + build

- [ ] **Step 1: 编写 Dashboard E2E 测试**

创建 `apps/api/src/modules/dashboard/dashboard.e2e-spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';

describe('Dashboard E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('未认证请求应返回 401 或 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/risk-overview')
      .expect((res) => {
        expect([401, 403]).toContain(res.status);
      });
  });

  // 注意：E2E 需要真实数据库，若 CI 无数据库则用 testcontainers
});
```

- [ ] **Step 2: 运行全量单元测试**

```bash
cd apps/api && npx jest --no-coverage
```

Expected: 所有已有测试 + 新增测试 PASS。

- [ ] **Step 3: 运行 lint 检查**

```bash
pnpm lint
```

Expected: 零警告，零错误。

- [ ] **Step 4: 运行 build**

```bash
pnpm build
```

Expected: 编译成功。

- [ ] **Step 5: 最终 Commit**

```bash
git add -A
git commit -m "test: add Dashboard E2E skeleton and final integration verification"
```

---

## 实施顺序总结

| Task | 内容 | 依赖 |
|------|------|------|
| 1 | Prisma schema 迁移 (readAt) | 无 |
| 2 | @Auditable 装饰器 + 脱敏过滤器 | 无 |
| 3 | AuditService | Task 2 |
| 4 | AuditInterceptor | Task 3 |
| 5 | AuditController + Module | Task 4 |
| 6 | 注册 Audit + P0 模块接入 | Task 5 |
| 7 | 安装 Socket.IO 依赖 | 无 |
| 8 | DashboardGateway | Task 7 |
| 9 | NotificationsService 增强 | Task 8 |
| 10 | NotificationsModule 装配 + Controller 增强 | Task 9 |
| 11 | 业务模块 WS 接入 | Task 10 |
| 12 | DashboardService | 无 |
| 13 | DashboardController + Module | Task 12 |
| 14 | 预聚合 Processor | Task 13 |
| 15 | E2E 测试 + lint + build 验证 | 全部 |

Task 1-2、7、12 可并行实施（无依赖关系）。
