# Epic 4: 工单与协同调度 — 实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the work-orders module with state machine, dispatch/assign/reassign/complete flows, timeline tracking, and service evaluation.

**Architecture:** New `WorkOrdersModule` importing `RiskModule` for `DispatchRecommendationService`. Pure TS `WorkOrderStateMachine` with zero framework deps drives all transitions. `WorkOrdersService` handles CRUD+transitions, `EvaluationsService` handles ratings. Controller exposes REST endpoints under `/work-orders`.

**Tech Stack:** NestJS 11.x, Prisma 6.x, TypeScript 5.7.x, class-validator, Jest

---

## File Map

| File | Responsibility |
|---|---|
| `work-orders/work-orders.state-machine.ts` | Pure state transition logic (PENDING→ASSIGNED→IN_PROGRESS→COMPLETED/CANCELLED) |
| `work-orders/work-orders.state-machine.spec.ts` | Exhaustive transition coverage |
| `work-orders/work-orders.service.ts` | CRUD, dispatch, assign, reassign, complete, cancel + timeline recording |
| `work-orders/work-orders.service.spec.ts` | Service-level integration tests |
| `work-orders/work-orders.controller.ts` | REST controller for work order endpoints |
| `work-orders/work-orders.controller.spec.ts` | Controller unit tests |
| `work-orders/work-orders.module.ts` | NestJS module definition |
| `work-orders/evaluations/evaluations.service.ts` | Evaluation create/read logic |
| `work-orders/evaluations/evaluations.service.spec.ts` | Evaluation service tests |
| `work-orders/evaluations/evaluations.controller.ts` | REST controller for evaluation endpoints |
| `work-orders/evaluations/evaluations.controller.spec.ts` | Evaluation controller tests |
| `work-orders/dto/*.dto.ts` | 6 DTOs with class-validator decorators |
| `app.module.ts` (modify) | Register `WorkOrdersModule` |

---

### Task 1: State Machine (Pure TS, No Dependencies)

**Files:**
- Create: `apps/api/src/modules/work-orders/work-orders.state-machine.ts`
- Create: `apps/api/src/modules/work-orders/work-orders.state-machine.spec.ts`

- [ ] **Step 1: Write the failing test suite for allowed transitions**

Create `apps/api/src/modules/work-orders/work-orders.state-machine.spec.ts`:

```typescript
import { WorkOrderStatus } from '@prisma/client';
import { WorkOrderStateMachine } from './work-orders.state-machine';

describe('WorkOrderStateMachine', () => {
  describe('canTransition', () => {
    // === Legal transitions ===

    it('PENDING → ASSIGNED when assigneeId provided', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.ASSIGNED,
        { isAssignee: true },
      );
      expect(result.allowed).toBe(true);
    });

    it('PENDING → CANCELLED without reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.CANCELLED,
        { hasReason: false },
      );
      expect(result.allowed).toBe(true);
    });

    it('ASSIGNED → IN_PROGRESS when requester is assignee', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.IN_PROGRESS,
        { isAssignee: true },
      );
      expect(result.allowed).toBe(true);
    });

    it('ASSIGNED → CANCELLED without reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.CANCELLED,
        { hasReason: false },
      );
      expect(result.allowed).toBe(true);
    });

    it('ASSIGNED → ASSIGNED (reassign) with reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.ASSIGNED,
        { hasReason: true },
      );
      expect(result.allowed).toBe(true);
    });

    it('IN_PROGRESS → COMPLETED when result provided', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.COMPLETED,
        {},
      );
      expect(result.allowed).toBe(true);
    });

    it('IN_PROGRESS → CANCELLED with reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.CANCELLED,
        { hasReason: true },
      );
      expect(result.allowed).toBe(true);
    });

    // === Illegal transitions ===

    it('PENDING → IN_PROGRESS is illegal (skip ASSIGNED)', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.IN_PROGRESS,
        { isAssignee: true },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('必须先派单');
    });

    it('PENDING → COMPLETED is illegal (skip all)', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.COMPLETED,
        {},
      );
      expect(result.allowed).toBe(false);
    });

    it('IN_PROGRESS → PENDING is illegal (backward)', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.PENDING,
        {},
      );
      expect(result.allowed).toBe(false);
    });

    it('COMPLETED → any state is illegal (terminal)', () => {
      for (const to of [WorkOrderStatus.PENDING, WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED]) {
        const result = WorkOrderStateMachine.canTransition(WorkOrderStatus.COMPLETED, to, {});
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('已完成的工单不可变更');
      }
    });

    it('CANCELLED → any state is illegal (terminal)', () => {
      for (const to of [WorkOrderStatus.PENDING, WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.COMPLETED]) {
        const result = WorkOrderStateMachine.canTransition(WorkOrderStatus.CANCELLED, to, {});
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('已取消的工单不可变更');
      }
    });

    // === Guard tests ===

    it('ASSIGNED → IN_PROGRESS blocked when requester is not assignee', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.IN_PROGRESS,
        { isAssignee: false },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('接单人员');
    });

    it('IN_PROGRESS → CANCELLED blocked without reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.CANCELLED,
        { hasReason: false },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('原因');
    });

    it('ASSIGNED → ASSIGNED (reassign) blocked without reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.ASSIGNED,
        { hasReason: false },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('原因');
    });

    it('PENDING → ASSIGNED blocked when no assignee context', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.ASSIGNED,
        { isAssignee: false },
      );
      expect(result.allowed).toBe(false);
    });

    // === transition method ===

    it('transition returns new status for valid transitions', () => {
      const result = WorkOrderStateMachine.transition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.CANCELLED,
        {},
      );
      expect(result).toBe(WorkOrderStatus.CANCELLED);
    });

    it('transition throws for invalid transitions', () => {
      expect(() =>
        WorkOrderStateMachine.transition(WorkOrderStatus.COMPLETED, WorkOrderStatus.PENDING, {}),
      ).toThrow();
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/work-orders.state-machine.spec.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Write the minimal state machine implementation**

Create `apps/api/src/modules/work-orders/work-orders.state-machine.ts`:

```typescript
import { WorkOrderStatus } from '@prisma/client';

export interface TransitionContext {
  isAssignee?: boolean;
  hasReason?: boolean;
}

export interface TransitionResult {
  allowed: boolean;
  error?: string;
}

// Map of allowed transitions: from -> { to -> guard condition }
const TRANSITION_MAP: Record<WorkOrderStatus, Partial<Record<WorkOrderStatus, (ctx: TransitionContext) => TransitionResult>>> = {
  [WorkOrderStatus.PENDING]: {
    [WorkOrderStatus.ASSIGNED]: (ctx) => {
      if (!ctx.isAssignee) {
        return { allowed: false, error: 'PENDING 状态必须先指定接单人员' };
      }
      return { allowed: true };
    },
    [WorkOrderStatus.CANCELLED]: () => ({ allowed: true }),
  },
  [WorkOrderStatus.ASSIGNED]: {
    [WorkOrderStatus.ASSIGNED]: (ctx) => {
      if (!ctx.hasReason) {
        return { allowed: false, error: '改派时必须填写原因' };
      }
      return { allowed: true };
    },
    [WorkOrderStatus.IN_PROGRESS]: (ctx) => {
      if (!ctx.isAssignee) {
        return { allowed: false, error: '只有接单人员可以开始处理' };
      }
      return { allowed: true };
    },
    [WorkOrderStatus.CANCELLED]: () => ({ allowed: true }),
  },
  [WorkOrderStatus.IN_PROGRESS]: {
    [WorkOrderStatus.COMPLETED]: () => ({ allowed: true }),
    [WorkOrderStatus.CANCELLED]: (ctx) => {
      if (!ctx.hasReason) {
        return { allowed: false, error: '进行中的工单取消时必须填写原因' };
      }
      return { allowed: true };
    },
  },
  [WorkOrderStatus.COMPLETED]: {},
  [WorkOrderStatus.CANCELLED]: {},
};

export class WorkOrderStateMachine {
  static canTransition(
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    context: TransitionContext = {},
  ): TransitionResult {
    // Terminal states cannot transition anywhere
    if (from === WorkOrderStatus.COMPLETED) {
      return { allowed: false, error: '已完成的工单不可变更' };
    }
    if (from === WorkOrderStatus.CANCELLED) {
      return { allowed: false, error: '已取消的工单不可变更' };
    }

    // Self-transition is only valid for reassign (ASSIGNED→ASSIGNED with reason)
    if (from === to) {
      const guard = TRANSITION_MAP[from]?.[to];
      if (guard) {
        return guard(context);
      }
      return { allowed: false, error: `不允许从 ${from} 保持不变` };
    }

    const guard = TRANSITION_MAP[from]?.[to];
    if (!guard) {
      return { allowed: false, error: `不允许从 ${from} 转移到 ${to}` };
    }

    return guard(context);
  }

  static transition(
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    context: TransitionContext = {},
  ): WorkOrderStatus {
    const result = WorkOrderStateMachine.canTransition(from, to, context);
    if (!result.allowed) {
      throw new Error(result.error ?? '非法的状态转移');
    }
    return to;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/work-orders.state-machine.spec.ts`
Expected: ALL 19 tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/work-orders/
git commit -m "feat: add WorkOrderStateMachine with full transition coverage"
```

---

### Task 2: DTOs

**Files:**
- Create: `apps/api/src/modules/work-orders/dto/create-work-order.dto.ts`
- Create: `apps/api/src/modules/work-orders/dto/query-work-orders.dto.ts`
- Create: `apps/api/src/modules/work-orders/dto/assign-work-order.dto.ts`
- Create: `apps/api/src/modules/work-orders/dto/complete-work-order.dto.ts`
- Create: `apps/api/src/modules/work-orders/dto/reassign-work-order.dto.ts`
- Create: `apps/api/src/modules/work-orders/dto/create-evaluation.dto.ts`

- [ ] **Step 1: Create all DTOs (no tests needed — pure data classes)**

Create `apps/api/src/modules/work-orders/dto/create-work-order.dto.ts`:

```typescript
import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderType, RiskLevel } from '@prisma/client';

export class CreateWorkOrderDto {
  @ApiProperty({ description: '老人 ID' })
  @IsString()
  elderId!: string;

  @ApiProperty({ description: '关联风险事件 ID', required: false })
  @IsOptional()
  @IsString()
  riskEventId?: string;

  @ApiProperty({ description: '工单类型', enum: WorkOrderType })
  @IsEnum(WorkOrderType)
  type!: WorkOrderType;

  @ApiProperty({ description: '风险等级', enum: RiskLevel, required: false })
  @IsOptional()
  @IsEnum(RiskLevel)
  level?: RiskLevel;

  @ApiProperty({ description: '截止时间', required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiProperty({ description: '创建原因', required: false })
  @IsOptional()
  @IsString()
  dispatchReason?: string;
}
```

Create `apps/api/src/modules/work-orders/dto/query-work-orders.dto.ts`:

```typescript
import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus, WorkOrderType } from '@prisma/client';

export class QueryWorkOrdersDto {
  @ApiProperty({ description: '页码', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({ description: '每页条数', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;

  @ApiProperty({ description: '状态过滤', required: false, enum: WorkOrderStatus })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;

  @ApiProperty({ description: '类型过滤', required: false, enum: WorkOrderType })
  @IsOptional()
  @IsEnum(WorkOrderType)
  type?: WorkOrderType;

  @ApiProperty({ description: '片区过滤', required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ description: '老人 ID 过滤', required: false })
  @IsOptional()
  @IsString()
  elderId?: string;

  @ApiProperty({ description: '接单者 ID 过滤', required: false })
  @IsOptional()
  @IsString()
  assigneeId?: string;
}
```

Create `apps/api/src/modules/work-orders/dto/assign-work-order.dto.ts`:

```typescript
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignWorkOrderDto {
  @ApiProperty({ description: '接单人员 ID' })
  @IsString()
  assigneeId!: string;
}
```

Create `apps/api/src/modules/work-orders/dto/complete-work-order.dto.ts`:

```typescript
import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteWorkOrderDto {
  @ApiProperty({ description: '处理结果' })
  @IsString()
  result!: string;

  @ApiProperty({ description: '照片 URL 列表', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
```

Create `apps/api/src/modules/work-orders/dto/reassign-work-order.dto.ts`:

```typescript
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReassignWorkOrderDto {
  @ApiProperty({ description: '新接单人员 ID' })
  @IsString()
  newAssigneeId!: string;

  @ApiProperty({ description: '改派原因' })
  @IsString()
  reason!: string;
}
```

Create `apps/api/src/modules/work-orders/dto/create-evaluation.dto.ts`:

```typescript
import { IsInt, Min, Max, IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEvaluationDto {
  @ApiProperty({ description: '评分（1-5）' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ description: '评价内容', required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ description: '标签', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/work-orders/dto/
git commit -m "feat: add work-order DTOs (create, query, assign, complete, reassign, evaluation)"
```

---

### Task 3: Module Scaffold + AppModule Registration

**Files:**
- Create: `apps/api/src/modules/work-orders/work-orders.module.ts`
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: Create the module file**

Create `apps/api/src/modules/work-orders/work-orders.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [RiskModule],
  controllers: [],
  providers: [],
  exports: [],
})
export class WorkOrdersModule {}
```

- [ ] **Step 2: Register in AppModule**

Modify `apps/api/src/app.module.ts` — add import:

```typescript
// Add below existing imports
import { WorkOrdersModule } from './modules/work-orders/work-orders.module';
```

Add `WorkOrdersModule` to the `imports` array in `@Module` decorator (after `AiModule`):

```typescript
    AiModule,
    WorkOrdersModule,
```

- [ ] **Step 3: Verify app compiles**

Run: `npx tsc --noEmit -p apps/api/tsconfig.json`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/modules/work-orders/work-orders.module.ts apps/api/src/app.module.ts
git commit -m "feat: scaffold WorkOrdersModule and register in AppModule"
```

---

### Task 4: WorkOrdersService (TDD)

**Files:**
- Create: `apps/api/src/modules/work-orders/work-orders.service.spec.ts`
- Create: `apps/api/src/modules/work-orders/work-orders.service.ts`

- [ ] **Step 1: Write the failing test suite**

Create `apps/api/src/modules/work-orders/work-orders.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrdersService } from './work-orders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DispatchRecommendationService } from '../risk/dispatch-recommendation.service';
import {
  WorkOrderType, WorkOrderStatus, RiskLevel, RiskStatus, Role, DutyStatus,
} from '@prisma/client';

describe('WorkOrdersService', () => {
  let service: WorkOrdersService;

  const mockElder = { id: 'elder-1', name: '张三', district: '东区', healthTags: [] };
  const mockWorker = {
    id: 'worker-1', name: '网格员A', role: Role.GRID_WORKER,
    district: '东区', dutyStatus: DutyStatus.ON_DUTY, skills: ['HEALTH'],
    avgResponseMin: 10,
  };
  const mockCreator = { id: 'admin-1', role: Role.ADMIN, district: '东区' };

  const mockPrisma = {
    elder: { findUnique: jest.fn() },
    workOrder: {
      create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(),
      update: jest.fn(), count: jest.fn(),
    },
    workOrderTimeline: { create: jest.fn(), findMany: jest.fn() },
    riskEvent: { findUnique: jest.fn(), update: jest.fn() },
    user: { findUnique: jest.fn(), update: jest.fn() },
  };

  const mockDispatch = {
    recommend: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkOrdersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: DispatchRecommendationService, useValue: mockDispatch },
      ],
    }).compile();
    service = module.get<WorkOrdersService>(WorkOrdersService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应创建工单并返回派单推荐', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.workOrder.create.mockResolvedValue({
        id: 'wo-1', elderId: 'elder-1', type: WorkOrderType.HEALTH,
        level: RiskLevel.HIGH, status: WorkOrderStatus.PENDING, createdById: 'admin-1',
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-1' });
      mockPrisma.riskEvent.findUnique.mockResolvedValue({
        id: 're-1', status: RiskStatus.CONFIRMED, elder: { district: '东区' },
      });
      mockPrisma.riskEvent.update.mockResolvedValue({ id: 're-1', status: RiskStatus.DISPATCHED });
      mockDispatch.recommend.mockResolvedValue([
        { userId: 'worker-1', name: '网格员A', score: 85, district: '东区',
          dutyStatus: 'ON_DUTY', skills: ['HEALTH'], avgResponseMin: 10,
          breakdown: { skillMatch: 30, sameDistrict: 30, onDuty: 25, responseTime: 0 } },
      ]);

      const result = await service.create({
        elderId: 'elder-1', riskEventId: 're-1',
        type: WorkOrderType.HEALTH, dispatchReason: '测试创建',
      }, mockCreator);

      expect(result.workOrder).toBeDefined();
      expect(result.recommendation).toHaveLength(1);
      expect(mockPrisma.workOrder.create).toHaveBeenCalled();
      expect(mockPrisma.workOrderTimeline.create).toHaveBeenCalledWith({
        data: { workOrderId: 'wo-1', action: 'CREATED', operatorId: 'admin-1', note: '测试创建' },
      });
    });

    it('应拒绝不存在的老人', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ elderId: 'bad-id', type: WorkOrderType.HEALTH }, mockCreator),
      ).rejects.toThrow('老人不存在');
    });

    it('应拒绝未确认的风险事件', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.riskEvent.findUnique.mockResolvedValue({
        id: 're-1', status: RiskStatus.PENDING_REVIEW,
      });
      await expect(
        service.create({ elderId: 'elder-1', riskEventId: 're-1', type: WorkOrderType.HEALTH }, mockCreator),
      ).rejects.toThrow('仅已确认的风险事件可生成工单');
    });
  });

  describe('findAll', () => {
    it('应返回分页列表并应用片区隔离', async () => {
      mockPrisma.workOrder.findMany.mockResolvedValue([
        { id: 'wo-1', elder: { id: 'elder-1', name: '张三', district: '东区' } },
      ]);
      mockPrisma.workOrder.count.mockResolvedValue(1);

      const result = await service.findAll(
        { page: 1, limit: 20 },
        { sub: 'worker-1', role: Role.GRID_WORKER, district: '东区' },
      );

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('非 ADMIN 只能看自己片区的工单', async () => {
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.workOrder.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 }, { sub: 'w1', role: Role.GRID_WORKER, district: '东区' });

      expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { elder: { district: '东区' } },
        }),
      );
    });

    it('GRID_WORKER 只看自己的工单 + 片区内 PENDING', async () => {
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.workOrder.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 }, { sub: 'w1', role: Role.GRID_WORKER, district: '东区' });

      expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            elder: { district: '东区' },
          }),
        }),
      );
    });
  });

  describe('findById', () => {
    it('应返回工单详情含时间线和评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING, elder: { district: '东区' },
        timeline: [], evaluation: null, assignee: null,
      });
      const result = await service.findById('wo-1', { sub: 'admin-1', role: Role.ADMIN });
      expect(result.id).toBe('wo-1');
    });

    it('应拒绝跨片区访问', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING,
        elder: { district: '西区' },
        timeline: [], evaluation: null, assignee: null,
      });
      await expect(
        service.findById('wo-1', { sub: 'w1', role: Role.GRID_WORKER, district: '东区' }),
      ).rejects.toThrow('工单不存在');
    });
  });

  describe('assign', () => {
    it('应成功派单并记录时间线', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(mockWorker);
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING, assigneeId: null,
        elder: { district: '东区' },
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-2' });

      const result = await service.assign('wo-1', 'worker-1', { sub: 'admin-1', role: Role.ADMIN });

      expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
      expect(mockPrisma.workOrderTimeline.create).toHaveBeenCalledWith({
        data: { workOrderId: 'wo-1', action: 'ASSIGNED', operatorId: 'admin-1',
          note: '派单给 网格员A' },
      });
    });

    it('应拒绝非法状态转移', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });
      mockPrisma.user.findUnique.mockResolvedValue(mockWorker);

      await expect(
        service.assign('wo-1', 'worker-2', { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('已完成的工单不可变更');
    });

    it('应拒绝将工单派给非接单角色', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING, assigneeId: null,
        elder: { district: '东区' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'fam-1', name: '家属', role: Role.FAMILY });

      await expect(
        service.assign('wo-1', 'fam-1', { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('不可将工单派给该角色');
    });
  });

  describe('start', () => {
    it('应允许接单者开始处理', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, assigneeId: 'worker-1',
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-3' });

      const result = await service.start('wo-1', { sub: 'worker-1', role: Role.GRID_WORKER });

      expect(result.status).toBe(WorkOrderStatus.IN_PROGRESS);
    });

    it('应拒绝非接单者开始处理', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });

      await expect(
        service.start('wo-1', { sub: 'worker-2', role: Role.GRID_WORKER }),
      ).rejects.toThrow('只有接单人员可以开始处理');
    });
  });

  describe('complete', () => {
    it('应允许接单者完成工单', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, completedAt: new Date(),
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-4' });

      const result = await service.complete('wo-1', { result: '已处理完毕', photos: [] },
        { sub: 'worker-1', role: Role.GRID_WORKER });

      expect(result.status).toBe(WorkOrderStatus.COMPLETED);
      expect(mockPrisma.workOrder.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ result: '已处理完毕', completedAt: expect.any(Date) }),
        }),
      );
    });

    it('应拒绝完成时无结果', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });

      await expect(
        service.complete('wo-1', { result: '', photos: [] }, { sub: 'worker-1', role: Role.GRID_WORKER }),
      ).rejects.toThrow('完成工单必须填写处理结果');
    });
  });

  describe('cancel', () => {
    it('应允许从 PENDING 取消（无需原因）', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.PENDING, assigneeId: null,
        elder: { district: '东区' },
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.CANCELLED,
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-5' });

      const result = await service.cancel('wo-1', undefined, { sub: 'admin-1', role: Role.ADMIN });
      expect(result.status).toBe(WorkOrderStatus.CANCELLED);
    });

    it('应拒绝从 IN_PROGRESS 取消无原因', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });

      await expect(
        service.cancel('wo-1', '', { sub: 'worker-1', role: Role.GRID_WORKER }),
      ).rejects.toThrow('进行中的工单取消时必须填写原因');
    });
  });

  describe('reassign', () => {
    it('应改派并重置状态为 ASSIGNED', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'worker-2', name: '网格员B', role: Role.GRID_WORKER,
      });
      mockPrisma.workOrder.update.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-2',
      });
      mockPrisma.workOrderTimeline.create.mockResolvedValue({ id: 'tl-6' });

      const result = await service.reassign('wo-1', 'worker-2', '原接单者请假',
        { sub: 'admin-1', role: Role.ADMIN });

      expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
      expect(mockPrisma.workOrderTimeline.create).toHaveBeenCalledWith({
        data: { workOrderId: 'wo-1', action: 'REASSIGNED', operatorId: 'admin-1',
          note: '从 网格员A 改派给 网格员B。原因: 原接单者请假' },
      });
    });

    it('应拒绝无原因的改派', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.ASSIGNED, assigneeId: 'worker-1',
        elder: { district: '东区' },
      });

      await expect(
        service.reassign('wo-1', 'worker-2', '', { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('改派时必须填写原因');
    });
  });

  describe('getTimeline', () => {
    it('应返回工单完整时间线', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', elder: { district: '东区' },
      });
      mockPrisma.workOrderTimeline.findMany.mockResolvedValue([
        { id: 'tl-1', action: 'CREATED', operatorId: 'admin-1', note: '创建', createdAt: new Date() },
        { id: 'tl-2', action: 'ASSIGNED', operatorId: 'admin-1', note: '派单', createdAt: new Date() },
      ]);

      const result = await service.getTimeline('wo-1', { sub: 'admin-1', role: Role.ADMIN });
      expect(result).toHaveLength(2);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/work-orders.service.spec.ts`
Expected: FAIL — WorkOrdersService not found

- [ ] **Step 3: Write the minimal implementation**

Create `apps/api/src/modules/work-orders/work-orders.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { DispatchRecommendationService } from '../risk/dispatch-recommendation.service';
import { WorkOrderStateMachine } from './work-orders.state-machine';
import { WorkOrderType, WorkOrderStatus, RiskStatus, Role, RiskLevel } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

const ASSIGNABLE_ROLES: Role[] = [Role.GRID_WORKER, Role.COMMUNITY_DOCTOR, Role.PROPERTY, Role.VOLUNTEER];

@Injectable()
export class WorkOrdersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly dispatch: DispatchRecommendationService,
  ) {}

  async create(
    input: { elderId: string; riskEventId?: string; type: WorkOrderType; level?: RiskLevel; deadline?: string; dispatchReason?: string },
    requester: Requester,
  ) {
    const elder = await this.prisma.elder.findUnique({ where: { id: input.elderId } });
    if (!elder) throw new NotFoundException('老人不存在');

    let riskEvent = null;
    if (input.riskEventId) {
      riskEvent = await this.prisma.riskEvent.findUnique({
        where: { id: input.riskEventId },
        include: { elder: { select: { district: true } } },
      });
      if (!riskEvent) throw new NotFoundException('风险事件不存在');
      if (riskEvent.status !== RiskStatus.CONFIRMED) {
        throw new BadRequestException('仅已确认的风险事件可生成工单');
      }
    }

    const workOrder = await this.prisma.workOrder.create({
      data: {
        elderId: input.elderId,
        riskEventId: input.riskEventId,
        type: input.type,
        level: input.level ?? riskEvent?.level ?? RiskLevel.MEDIUM,
        status: WorkOrderStatus.PENDING,
        deadline: input.deadline ? new Date(input.deadline) : null,
        dispatchReason: input.dispatchReason ?? null,
        createdById: requester.sub,
      },
    });

    // Record timeline
    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: workOrder.id,
        action: 'CREATED',
        operatorId: requester.sub,
        note: input.dispatchReason ?? null,
      },
    });

    // Update risk event status if linked
    if (input.riskEventId) {
      await this.prisma.riskEvent.update({
        where: { id: input.riskEventId },
        data: { status: RiskStatus.DISPATCHED },
      });
    }

    // Get dispatch recommendation
    let recommendation: any[] = [];
    try {
      recommendation = await this.dispatch.recommend(workOrder.id, input.type);
    } catch {
      // Recommendation is optional — don't fail if it errors
    }

    return { workOrder, recommendation };
  }

  async findAll(
    query: { page: number; limit: number; status?: WorkOrderStatus; type?: WorkOrderType; district?: string; elderId?: string; assigneeId?: string },
    requester: Requester,
  ) {
    const { page, limit, status, type, district, elderId, assigneeId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (status) where.status = status;
    if (type) where.type = type;
    if (elderId) where.elderId = elderId;
    if (assigneeId) where.assigneeId = assigneeId;

    // District isolation
    if (requester.role !== Role.ADMIN) {
      where.elder = { district: requester.district ?? '' };
    } else if (district) {
      where.elder = { district };
    }

    const [items, total] = await Promise.all([
      this.prisma.workOrder.findMany({
        where,
        include: {
          elder: { select: { id: true, name: true, district: true } },
          assignee: { select: { id: true, name: true } },
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.workOrder.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string, requester?: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        elder: { select: { id: true, name: true, district: true } },
        assignee: { select: { id: true, name: true, phone: true } },
        timeline: { orderBy: { createdAt: 'asc' } },
        evaluation: true,
        riskEvent: { select: { id: true, level: true, source: true } },
      },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    if (requester && requester.role !== Role.ADMIN && requester.district && wo.elder.district !== requester.district) {
      throw new NotFoundException('工单不存在');
    }

    return wo;
  }

  async assign(id: string, assigneeId: string, requester: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    const user = await this.prisma.user.findUnique({ where: { id: assigneeId } });
    if (!user) throw new NotFoundException('用户不存在');
    if (!ASSIGNABLE_ROLES.includes(user.role)) {
      throw new BadRequestException('不可将工单派给该角色');
    }

    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.ASSIGNED, { isAssignee: true });

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { assigneeId, status: WorkOrderStatus.ASSIGNED },
    });

    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: id,
        action: 'ASSIGNED',
        operatorId: requester.sub,
        note: `派单给 ${user.name}`,
      },
    });

    return updated;
  }

  async start(id: string, requester: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.IN_PROGRESS, {
      isAssignee: wo.assigneeId === requester.sub,
    });

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { status: WorkOrderStatus.IN_PROGRESS },
    });

    await this.prisma.workOrderTimeline.create({
      data: { workOrderId: id, action: 'IN_PROGRESS', operatorId: requester.sub },
    });

    return updated;
  }

  async complete(id: string, data: { result: string; photos?: string[] }, requester: Requester) {
    if (!data.result || data.result.trim().length === 0) {
      throw new BadRequestException('完成工单必须填写处理结果');
    }

    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    if (wo.assigneeId !== requester.sub) {
      throw new ForbiddenException('只有接单人员可以完成工单');
    }

    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.COMPLETED, {});

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: {
        status: WorkOrderStatus.COMPLETED,
        result: data.result,
        completedAt: new Date(),
      },
    });

    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: id,
        action: 'COMPLETED',
        operatorId: requester.sub,
        note: data.result,
      },
    });

    return updated;
  }

  async cancel(id: string, reason: string | undefined, requester: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    const hasReason = reason !== undefined && reason.trim().length > 0;

    // For IN_PROGRESS cancel, the guard already checks in the state machine
    if (wo.status === WorkOrderStatus.IN_PROGRESS && !hasReason) {
      throw new BadRequestException('进行中的工单取消时必须填写原因');
    }

    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.CANCELLED, {
      isAssignee: wo.assigneeId === requester.sub,
      hasReason,
    });

    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { status: WorkOrderStatus.CANCELLED },
    });

    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: id,
        action: 'CANCELLED',
        operatorId: requester.sub,
        note: reason ?? null,
      },
    });

    return updated;
  }

  async reassign(id: string, newAssigneeId: string, reason: string, requester: Requester) {
    if (!reason || reason.trim().length === 0) {
      throw new BadRequestException('改派时必须填写原因');
    }

    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: {
        elder: { select: { district: true } },
        assignee: { select: { name: true } },
      },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    const newUser = await this.prisma.user.findUnique({ where: { id: newAssigneeId } });
    if (!newUser) throw new NotFoundException('用户不存在');
    if (!ASSIGNABLE_ROLES.includes(newUser.role)) {
      throw new BadRequestException('不可将工单派给该角色');
    }

    WorkOrderStateMachine.transition(wo.status, WorkOrderStatus.ASSIGNED, { hasReason: true });

    const prevName = wo.assignee?.name ?? '未指派';
    const updated = await this.prisma.workOrder.update({
      where: { id },
      data: { assigneeId: newAssigneeId, status: WorkOrderStatus.ASSIGNED },
    });

    await this.prisma.workOrderTimeline.create({
      data: {
        workOrderId: id,
        action: 'REASSIGNED',
        operatorId: requester.sub,
        note: `从 ${prevName} 改派给 ${newUser.name}。原因: ${reason}`,
      },
    });

    return updated;
  }

  async getTimeline(id: string, requester?: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    if (requester && requester.role !== Role.ADMIN && requester.district && wo.elder.district !== requester.district) {
      throw new NotFoundException('工单不存在');
    }

    return this.prisma.workOrderTimeline.findMany({
      where: { workOrderId: id },
      orderBy: { createdAt: 'asc' },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/work-orders.service.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/work-orders/work-orders.service.ts apps/api/src/modules/work-orders/work-orders.service.spec.ts
git commit -m "feat: implement WorkOrdersService with full state-machine-driven workflow"
```

---

### Task 5: WorkOrdersController (TDD)

**Files:**
- Create: `apps/api/src/modules/work-orders/work-orders.controller.ts`
- Create: `apps/api/src/modules/work-orders/work-orders.controller.spec.ts`

- [ ] **Step 1: Write the failing controller test**

Create `apps/api/src/modules/work-orders/work-orders.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { WorkOrderType, WorkOrderStatus, Role, RiskLevel } from '@prisma/client';

describe('WorkOrdersController', () => {
  let controller: WorkOrdersController;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    assign: jest.fn(),
    start: jest.fn(),
    complete: jest.fn(),
    cancel: jest.fn(),
    reassign: jest.fn(),
    getTimeline: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [WorkOrdersController],
      providers: [{ provide: WorkOrdersService, useValue: mockService }],
    }).compile();
    controller = module.get<WorkOrdersController>(WorkOrdersController);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应调用 service.create 并返回结果', async () => {
      const dto = { elderId: 'elder-1', type: WorkOrderType.HEALTH, dispatchReason: '测试' };
      mockService.create.mockResolvedValue({ workOrder: { id: 'wo-1' }, recommendation: [] });
      const result = await controller.create(dto, { sub: 'u1', role: Role.ADMIN });
      expect(result.workOrder.id).toBe('wo-1');
    });
  });

  describe('findAll', () => {
    it('应返回分页列表', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
      const result = await controller.findAll(
        { page: 1, limit: 20 },
        { sub: 'u1', role: Role.ADMIN },
      );
      expect(result.total).toBe(0);
    });
  });

  describe('findById', () => {
    it('应返回工单详情', async () => {
      mockService.findById.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.PENDING });
      const result = await controller.findById('wo-1', { sub: 'u1', role: Role.ADMIN });
      expect(result.id).toBe('wo-1');
    });
  });

  describe('assign', () => {
    it('应调用 service.assign', async () => {
      mockService.assign.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.ASSIGNED });
      const result = await controller.assign('wo-1', { assigneeId: 'w1' }, { sub: 'u1', role: Role.ADMIN });
      expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
    });
  });

  describe('start', () => {
    it('应调用 service.start', async () => {
      mockService.start.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS });
      const result = await controller.start('wo-1', { sub: 'worker-1', role: Role.GRID_WORKER });
      expect(result.status).toBe(WorkOrderStatus.IN_PROGRESS);
    });
  });

  describe('complete', () => {
    it('应调用 service.complete', async () => {
      mockService.complete.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.COMPLETED });
      const result = await controller.complete('wo-1', { result: '已完成' }, { sub: 'worker-1', role: Role.GRID_WORKER });
      expect(result.status).toBe(WorkOrderStatus.COMPLETED);
    });
  });

  describe('cancel', () => {
    it('应调用 service.cancel', async () => {
      mockService.cancel.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.CANCELLED });
      const result = await controller.cancel('wo-1', { reason: '不需要了' }, { sub: 'u1', role: Role.ADMIN });
      expect(result.status).toBe(WorkOrderStatus.CANCELLED);
    });
  });

  describe('reassign', () => {
    it('应调用 service.reassign', async () => {
      mockService.reassign.mockResolvedValue({ id: 'wo-1', status: WorkOrderStatus.ASSIGNED });
      const result = await controller.reassign('wo-1',
        { newAssigneeId: 'w2', reason: '换人' },
        { sub: 'u1', role: Role.ADMIN },
      );
      expect(result.status).toBe(WorkOrderStatus.ASSIGNED);
    });
  });

  describe('getTimeline', () => {
    it('应返回时间线', async () => {
      mockService.getTimeline.mockResolvedValue([{ id: 'tl-1', action: 'CREATED' }]);
      const result = await controller.getTimeline('wo-1', { sub: 'u1', role: Role.ADMIN });
      expect(result).toHaveLength(1);
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/work-orders.controller.spec.ts`
Expected: FAIL — WorkOrdersController not found

- [ ] **Step 3: Write the controller implementation**

Create `apps/api/src/modules/work-orders/work-orders.controller.ts`:

```typescript
import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { WorkOrdersService } from './work-orders.service';
import { CreateWorkOrderDto } from './dto/create-work-order.dto';
import { QueryWorkOrdersDto } from './dto/query-work-orders.dto';
import { AssignWorkOrderDto } from './dto/assign-work-order.dto';
import { CompleteWorkOrderDto } from './dto/complete-work-order.dto';
import { ReassignWorkOrderDto } from './dto/reassign-work-order.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('WorkOrders')
@ApiBearerAuth()
@Controller()
export class WorkOrdersController {
  constructor(private readonly workOrdersService: WorkOrdersService) {}

  @Post('work-orders')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '创建工单，返回派单推荐作为建议' })
  create(@Body() dto: CreateWorkOrderDto, @CurrentUser() user: any) {
    return this.workOrdersService.create(dto, user);
  }

  @Get('work-orders')
  @ApiOperation({ summary: '分页查询工单列表' })
  findAll(@Query() query: QueryWorkOrdersDto, @CurrentUser() user: any) {
    return this.workOrdersService.findAll(query as any, user);
  }

  @Get('work-orders/:id')
  @ApiOperation({ summary: '查看工单详情（含时间线+评价）' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workOrdersService.findById(id, user);
  }

  @Post('work-orders/:id/assign')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '指定接单人员' })
  assign(
    @Param('id') id: string,
    @Body() dto: AssignWorkOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.assign(id, dto.assigneeId, user);
  }

  @Post('work-orders/:id/start')
  @ApiOperation({ summary: '接单者标记开始处理' })
  start(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workOrdersService.start(id, user);
  }

  @Post('work-orders/:id/complete')
  @ApiOperation({ summary: '接单者提交处理结果' })
  complete(
    @Param('id') id: string,
    @Body() dto: CompleteWorkOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.complete(id, dto, user);
  }

  @Post('work-orders/:id/cancel')
  @ApiOperation({ summary: '取消工单' })
  cancel(
    @Param('id') id: string,
    @Body() dto: { reason?: string },
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.cancel(id, dto.reason, user);
  }

  @Post('work-orders/:id/reassign')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '改派工单（须填原因）' })
  reassign(
    @Param('id') id: string,
    @Body() dto: ReassignWorkOrderDto,
    @CurrentUser() user: any,
  ) {
    return this.workOrdersService.reassign(id, dto.newAssigneeId, dto.reason, user);
  }

  @Get('work-orders/:id/timeline')
  @ApiOperation({ summary: '查看工单时间线' })
  getTimeline(@Param('id') id: string, @CurrentUser() user: any) {
    return this.workOrdersService.getTimeline(id, user);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/work-orders.controller.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/work-orders/work-orders.controller.ts apps/api/src/modules/work-orders/work-orders.controller.spec.ts
git commit -m "feat: add WorkOrdersController with full REST endpoints"
```

---

### Task 6: EvaluationsService (TDD)

**Files:**
- Create: `apps/api/src/modules/work-orders/evaluations/evaluations.service.ts`
- Create: `apps/api/src/modules/work-orders/evaluations/evaluations.service.spec.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/src/modules/work-orders/evaluations/evaluations.service.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationsService } from './evaluations.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { WorkOrderStatus, Role } from '@prisma/client';

describe('EvaluationsService', () => {
  let service: EvaluationsService;

  const mockPrisma = {
    workOrder: { findUnique: jest.fn() },
    serviceEvaluation: { create: jest.fn(), findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EvaluationsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<EvaluationsService>(EvaluationsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应成功创建评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, createdById: 'admin-1',
        elder: { district: '东区' },
      });
      mockPrisma.serviceEvaluation.findUnique.mockResolvedValue(null); // No existing evaluation
      mockPrisma.serviceEvaluation.create.mockResolvedValue({
        id: 'ev-1', workOrderId: 'wo-1', rating: 5, comment: '很好', tags: ['及时'],
      });

      const result = await service.create('wo-1',
        { rating: 5, comment: '很好', tags: ['及时'] },
        { sub: 'admin-1', role: Role.ADMIN },
      );

      expect(result.rating).toBe(5);
      expect(mockPrisma.serviceEvaluation.create).toHaveBeenCalledWith({
        data: { workOrderId: 'wo-1', rating: 5, comment: '很好', tags: ['及时'] },
      });
    });

    it('应拒绝未完成工单的评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.IN_PROGRESS, createdById: 'admin-1',
        elder: { district: '东区' },
      });

      await expect(
        service.create('wo-1', { rating: 5 }, { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('仅可对已完成的工单进行评价');
    });

    it('应拒绝非创建者评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, createdById: 'admin-1',
        elder: { district: '东区' },
      });

      await expect(
        service.create('wo-1', { rating: 4 }, { sub: 'other-user', role: Role.GRID_WORKER }),
      ).rejects.toThrow('仅工单创建者可提交评价');
    });

    it('应拒绝重复评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', status: WorkOrderStatus.COMPLETED, createdById: 'admin-1',
        elder: { district: '东区' },
      });
      mockPrisma.serviceEvaluation.findUnique.mockResolvedValue({
        id: 'ev-1', workOrderId: 'wo-1', rating: 4,
      });

      await expect(
        service.create('wo-1', { rating: 5 }, { sub: 'admin-1', role: Role.ADMIN }),
      ).rejects.toThrow('该工单已评价');
    });

    it('应拒绝无效评分（<1 或 >5）', async () => {
      await expect(
        service.create('wo-1', { rating: 0 }, { sub: 'u1', role: Role.ADMIN }),
      ).rejects.toThrow('评分必须在 1-5 之间');
    });
  });

  describe('findByWorkOrderId', () => {
    it('应返回工单评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', elder: { district: '东区' },
      });
      mockPrisma.serviceEvaluation.findUnique.mockResolvedValue({
        id: 'ev-1', workOrderId: 'wo-1', rating: 5, comment: '好', tags: [],
      });

      const result = await service.findByWorkOrderId('wo-1', { sub: 'u1', role: Role.ADMIN });
      expect(result.rating).toBe(5);
    });

    it('应拒绝跨片区查看评价', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', elder: { district: '西区' },
      });

      await expect(
        service.findByWorkOrderId('wo-1', { sub: 'w1', role: Role.GRID_WORKER, district: '东区' }),
      ).rejects.toThrow('工单不存在');
    });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/evaluations/evaluations.service.spec.ts`
Expected: FAIL — EvaluationsService not found

- [ ] **Step 3: Write the implementation**

Create `apps/api/src/modules/work-orders/evaluations/evaluations.service.ts`:

```typescript
import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { WorkOrderStatus, Role } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class EvaluationsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(
    workOrderId: string,
    input: { rating: number; comment?: string; tags?: string[] },
    requester: Requester,
  ) {
    if (input.rating < 1 || input.rating > 5) {
      throw new BadRequestException('评分必须在 1-5 之间');
    }

    const wo = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    if (wo.status !== WorkOrderStatus.COMPLETED) {
      throw new BadRequestException('仅可对已完成的工单进行评价');
    }

    if (wo.createdById !== requester.sub) {
      throw new ForbiddenException('仅工单创建者可提交评价');
    }

    const existing = await this.prisma.serviceEvaluation.findUnique({
      where: { workOrderId },
    });
    if (existing) {
      throw new BadRequestException('该工单已评价');
    }

    return this.prisma.serviceEvaluation.create({
      data: {
        workOrderId,
        rating: input.rating,
        comment: input.comment ?? null,
        tags: input.tags ?? [],
      },
    });
  }

  async findByWorkOrderId(workOrderId: string, requester?: Requester) {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: { elder: { select: { district: true } } },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    if (requester && requester.role !== Role.ADMIN && requester.district && wo.elder.district !== requester.district) {
      throw new NotFoundException('工单不存在');
    }

    return this.prisma.serviceEvaluation.findUnique({
      where: { workOrderId },
    });
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/evaluations/evaluations.service.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/work-orders/evaluations/
git commit -m "feat: implement EvaluationsService with creation guards"
```

---

### Task 7: EvaluationsController + Wire Module

**Files:**
- Create: `apps/api/src/modules/work-orders/evaluations/evaluations.controller.ts`
- Create: `apps/api/src/modules/work-orders/evaluations/evaluations.controller.spec.ts`
- Modify: `apps/api/src/modules/work-orders/work-orders.module.ts`

- [ ] **Step 1: Write the controller test**

Create `apps/api/src/modules/work-orders/evaluations/evaluations.controller.spec.ts`:

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { Role } from '@prisma/client';

describe('EvaluationsController', () => {
  let controller: EvaluationsController;

  const mockService = {
    create: jest.fn(),
    findByWorkOrderId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvaluationsController],
      providers: [{ provide: EvaluationsService, useValue: mockService }],
    }).compile();
    controller = module.get<EvaluationsController>(EvaluationsController);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应调用 service.create', async () => {
      mockService.create.mockResolvedValue({ id: 'ev-1', rating: 5 });
      const result = await controller.create('wo-1',
        { rating: 5, comment: '好' },
        { sub: 'u1', role: Role.ADMIN },
      );
      expect(result.rating).toBe(5);
    });
  });

  describe('findByWorkOrderId', () => {
    it('应返回评价', async () => {
      mockService.findByWorkOrderId.mockResolvedValue({ id: 'ev-1', rating: 5 });
      const result = await controller.findByWorkOrderId('wo-1', { sub: 'u1', role: Role.ADMIN });
      expect(result.rating).toBe(5);
    });
  });
});
```

- [ ] **Step 2: Write the controller implementation**

Create `apps/api/src/modules/work-orders/evaluations/evaluations.controller.ts`:

```typescript
import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from '../dto/create-evaluation.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Evaluations')
@ApiBearerAuth()
@Controller()
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post('work-orders/:id/evaluation')
  @ApiOperation({ summary: '提交服务评价' })
  create(
    @Param('id') workOrderId: string,
    @Body() dto: CreateEvaluationDto,
    @CurrentUser() user: any,
  ) {
    return this.evaluationsService.create(workOrderId, dto, user);
  }

  @Get('work-orders/:id/evaluation')
  @ApiOperation({ summary: '查看服务评价' })
  findByWorkOrderId(@Param('id') workOrderId: string, @CurrentUser() user: any) {
    return this.evaluationsService.findByWorkOrderId(workOrderId, user);
  }
}
```

- [ ] **Step 3: Run tests**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/evaluations/evaluations.controller.spec.ts`
Expected: ALL tests PASS

- [ ] **Step 4: Wire everything in the module file**

Modify `apps/api/src/modules/work-orders/work-orders.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { RiskModule } from '../risk/risk.module';
import { WorkOrdersController } from './work-orders.controller';
import { WorkOrdersService } from './work-orders.service';
import { EvaluationsController } from './evaluations/evaluations.controller';
import { EvaluationsService } from './evaluations/evaluations.service';

@Module({
  imports: [RiskModule],
  controllers: [WorkOrdersController, EvaluationsController],
  providers: [WorkOrdersService, EvaluationsService],
  exports: [WorkOrdersService],
})
export class WorkOrdersModule {}
```

- [ ] **Step 5: Run full test suite**

Run: `npx jest --config apps/api/test/jest-e2e.json apps/api/src/modules/work-orders/`
Expected: ALL tests PASS across all spec files

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/modules/work-orders/evaluations/ apps/api/src/modules/work-orders/work-orders.module.ts
git commit -m "feat: add EvaluationsController and wire WorkOrdersModule"
```

---

### Task 8: E2E — Work Order Full Lifecycle

**Files:**
- Create: `apps/api/src/modules/work-orders/work-orders.e2e-spec.ts`

- [ ] **Step 1: Write E2E test for full lifecycle**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkOrderType, RiskLevel, RiskStatus, Role, DutyStatus } from '@prisma/client';

describe('WorkOrders E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let elderId: string;
  let workerId: string;
  let adminToken: string;
  let workerToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    await app.init();
    prisma = app.get(PrismaService);

    // Seed test data
    await prisma.workOrder.deleteMany();
    await prisma.riskEvent.deleteMany();

    elderId = 'elder-e2e';
    workerId = 'worker-e2e';

    // Note: In a real E2E test, we'd use actual JWT tokens from auth.
    // For this plan, the E2E test demonstrates the request/response shapes.
    // In CI, these would be run against a real seeded database with Testcontainers.
  });

  afterAll(async () => {
    await prisma.workOrder.deleteMany();
    await prisma.riskEvent.deleteMany();
    await app.close();
  });

  it('POST /work-orders — should create a work order with recommendation', async () => {
    // This test validates the full creation flow including recommendation
    // CI needs seeded elder + risk event + workers
  });

  it('POST /work-orders/:id/assign — should assign to a worker', async () => {
    // Validate PENDING → ASSIGNED transition
  });

  it('POST /work-orders/:id/start — should start processing', async () => {
    // Validate ASSIGNED → IN_PROGRESS
  });

  it('POST /work-orders/:id/complete — should complete with result', async () => {
    // Validate IN_PROGRESS → COMPLETED with result
  });

  it('POST /work-orders/:id/evaluation — should submit evaluation', async () => {
    // Validate rating creation
  });

  it('Full lifecycle: create → assign → reassign → accept → start → complete → evaluate', async () => {
    // Full happy path including reassign
  });

  it('Cancel path: create → assign → cancel', async () => {
    // Validate cancellation
  });

  it('Cancel from IN_PROGRESS without reason should fail', async () => {
    // Validate guard
  });

  it('Illegal transition PENDING → COMPLETED should fail', async () => {
    // Validate state machine rejection
  });
});
```

> **Note for the implementer:** The E2E test above is a skeleton. Fully populated E2E tests require seeded data (elder, risk event, workers with JWT tokens). The implementer must:
> 1. Connect to Testcontainers PostgreSQL (as configured in global setup)
> 2. Seed an elder, a CONFIRMED risk event, and two workers (one ADMIN, one GRID_WORKER)
> 3. Generate JWT tokens via the auth service
> 4. Fill in the actual request bodies and expected status codes
>
> Reference: existing E2E patterns in `apps/api/src/modules/risk/risk.controller.spec.ts` and `apps/api/src/modules/auth/auth.controller.spec.ts`.

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/modules/work-orders/work-orders.e2e-spec.ts
git commit -m "test: add work-orders E2E skeleton for full lifecycle"
```

---

## Implementation Order Summary

| Order | Task | Dependencies |
|---|---|---|
| 1 | State Machine + Tests | None |
| 2 | DTOs | None |
| 3 | Module Scaffold | None |
| 4 | WorkOrdersService + Tests | Tasks 1, 2 |
| 5 | WorkOrdersController + Tests | Tasks 2, 4 |
| 6 | EvaluationsService + Tests | Task 3 |
| 7 | EvaluationsController + Module Wire | Tasks 3, 6 |
| 8 | E2E Tests | Tasks 1-7 |

Tasks 1, 2, 3 can run in parallel (no mutual dependencies).
