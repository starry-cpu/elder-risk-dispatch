# Epic 6 — AI 辅助层集成：异常文本触发风险引擎 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 AI 文本分类能力接入 CheckIn → Risk 流程，实现"报平安文本自动异常检测 → 风险事件生成"闭环。

**Architecture:** CheckInsModule 导入 AiModule + RiskModule，CheckInsService 在创建 TEXT/PROXY 报平安后以 fire-and-forget 方式调用 `AiService.classify()`，通过纯函数 `isAbnormalTextResult()` 判定异常，若异常则调用 `RiskService.evaluateAndCreateEvent({ abnormalText: true })` 生成 ABNORMAL_TEXT 来源的 RiskEvent。

**Tech Stack:** NestJS 11.x, Prisma 6.x, Jest 29.x, TypeScript 5.7.x

**Design spec:** `docs/superpowers/specs/2026-06-11-epic6-ai-assisted-layer-design.md`

---

## File Structure

| 文件 | 操作 | 职责 |
|------|------|------|
| `modules/ai/ai.service.ts` | 修改 | 新增导出纯函数 `isAbnormalTextResult()` |
| `modules/ai/ai.service.spec.ts` | 修改 | `isAbnormalTextResult` 的 6 个边界测试 |
| `modules/check-ins/check-ins.module.ts` | 修改 | 导入 AiModule + RiskModule |
| `modules/check-ins/check-ins.service.ts` | 修改 | 注入 AiService + RiskService，添加 `detectAbnormalText()` 私有方法 |
| `modules/check-ins/check-ins.service.spec.ts` | 修改 | 新增 5 个 AI 集成场景测试 |

---

### Task 1: 添加 `isAbnormalTextResult()` 纯函数（测试先行）

**Files:**
- Modify: `apps/api/src/modules/ai/ai.service.ts`
- Modify: `apps/api/src/modules/ai/ai.service.spec.ts`

- [ ] **Step 1: 在 `ai.service.spec.ts` 中编写 `isAbnormalTextResult` 的失败测试**

在现有 `describe('AiService', ...)` 块之后（文件末尾），新增一个独立的 `describe` 块：

```typescript
// apps/api/src/modules/ai/ai.service.spec.ts
// 在文件末尾、最后一个 describe 块之后追加：

import { isAbnormalTextResult } from './ai.service';

describe('isAbnormalTextResult', () => {
  it('HEALTH + confidence >= 0.7 应判定为异常', () => {
    const result = isAbnormalTextResult({ type: 'HEALTH', confidence: 0.85, needsHumanReview: false });
    expect(result).toBe(true);
  });

  it('HEALTH + confidence = 0.7（边界值）应判定为异常', () => {
    const result = isAbnormalTextResult({ type: 'HEALTH', confidence: 0.7, needsHumanReview: false });
    expect(result).toBe(true);
  });

  it('HEALTH + confidence < 0.7 且 needsHumanReview=false 不应判定为异常', () => {
    const result = isAbnormalTextResult({ type: 'HEALTH', confidence: 0.69, needsHumanReview: false });
    expect(result).toBe(false);
  });

  it('非 HEALTH 类型 + 高置信度不应判定为异常', () => {
    const result = isAbnormalTextResult({ type: 'ERRAND', confidence: 0.95, needsHumanReview: false });
    expect(result).toBe(false);
  });

  it('needsHumanReview=true 应判定为异常（低置信度）', () => {
    const result = isAbnormalTextResult({ type: 'LIFE', confidence: 0.45, needsHumanReview: true });
    expect(result).toBe(true);
  });

  it('needsHumanReview=false + 非 HEALTH + 高置信度不判定为异常', () => {
    const result = isAbnormalTextResult({ type: 'COMPANION', confidence: 0.88, needsHumanReview: false });
    expect(result).toBe(false);
  });
});
```

- [ ] **Step 2: 运行测试，确认全部失败**

```powershell
npx jest --config apps/api/jest.config.ts -- apps/api/src/modules/ai/ai.service.spec.ts -t "isAbnormalTextResult" --no-coverage
```

Expected: 6 tests FAIL — `isAbnormalTextResult is not a function` 或 `ReferenceError`

- [ ] **Step 3: 在 `ai.service.ts` 中实现 `isAbnormalTextResult`**

在 `apps/api/src/modules/ai/ai.service.ts` 文件末尾（`AiService` 类定义之后）追加：

```typescript
/**
 * 判定 AI 分类结果是否代表"异常文本"。
 * 纯函数，不依赖外部状态，便于单测和复用。
 *
 * 异常判定规则：
 * - HEALTH 类型 + 置信度 ≥ 0.7 → 老人主动表达健康问题
 * - needsHumanReview === true（置信度 < 0.6）→ 文本模糊，可能存在认知异常
 */
export function isAbnormalTextResult(result: {
  type: string;
  confidence: number;
  needsHumanReview: boolean;
}): boolean {
  if (result.type === 'HEALTH' && result.confidence >= 0.7) return true;
  if (result.needsHumanReview) return true;
  return false;
}
```

- [ ] **Step 4: 运行测试，确认全部通过**

```powershell
npx jest --config apps/api/jest.config.ts -- apps/api/src/modules/ai/ai.service.spec.ts --no-coverage
```

Expected: 所有测试 PASS（包括原有的 AiService 测试和新加的 6 个 isAbnormalTextResult 测试）

- [ ] **Step 5: 提交**

```powershell
git add apps/api/src/modules/ai/ai.service.ts apps/api/src/modules/ai/ai.service.spec.ts
git commit -m "feat: add isAbnormalTextResult pure function with tests"
```

---

### Task 2: CheckInModule 导入 AiModule 和 RiskModule

**Files:**
- Modify: `apps/api/src/modules/check-ins/check-ins.module.ts`

- [ ] **Step 1: 修改模块导入**

将 `apps/api/src/modules/check-ins/check-ins.module.ts` 替换为：

```typescript
import { Module } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';
import { AiModule } from '../ai/ai.module';
import { RiskModule } from '../risk/risk.module';

@Module({
  imports: [AiModule, RiskModule],
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
```

- [ ] **Step 2: 验证模块加载无编译错误**

```powershell
npx tsc --project apps/api/tsconfig.json --noEmit
```

Expected: 无类型错误（此时仅有未使用的 import 警告，不影响编译）

- [ ] **Step 3: 提交**

```powershell
git add apps/api/src/modules/check-ins/check-ins.module.ts
git commit -m "feat: import AiModule and RiskModule into CheckInModule"
```

---

### Task 3: CheckInsService 集成 AI 异常文本检测（测试先行）

**Files:**
- Modify: `apps/api/src/modules/check-ins/check-ins.service.spec.ts`
- Modify: `apps/api/src/modules/check-ins/check-ins.service.ts`

- [ ] **Step 1: 在 `check-ins.service.spec.ts` 中添加 mock 和 AI 集成失败测试**

在文件顶部的 import 区追加：

```typescript
import { AiService, isAbnormalTextResult } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';
```

在 mock 定义区（`const mockPrisma = ...` 之后）添加：

```typescript
const mockAiService = {
  classify: jest.fn(),
};

const mockRiskService = {
  evaluateAndCreateEvent: jest.fn(),
};
```

**修改 `beforeEach`**：将 TestingModule 配置中的 providers 数组从：

```typescript
providers: [
  CheckInsService,
  { provide: PrismaService, useValue: mockPrisma },
],
```

改为（注意：token 必须是**类引用**而非字符串，匹配 NestJS 基于类型的 DI 解析）：

```typescript
providers: [
  CheckInsService,
  { provide: PrismaService, useValue: mockPrisma },
  { provide: AiService, useValue: mockAiService },
  { provide: RiskService, useValue: mockRiskService },
],
```

**然后在 describe('create', ...) 块末尾（最后一个现有 it 之后）追加 5 个新测试：**

```typescript
// ========== AI 异常文本检测集成测试 ==========

// Helper: flush pending microtasks for fire-and-forget detection
const flushPromises = () => new Promise(resolve => setImmediate(resolve));

it('正常文本（ERRAND 高置信度）不应触发风险事件', async () => {
  mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
  mockPrisma.checkIn.create.mockResolvedValue({
    id: 'ci-ai-1', elderId: 'elder-1', method: 'TEXT',
    content: '需要买米', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
  });
  mockAiService.classify.mockResolvedValue({
    type: 'ERRAND', confidence: 0.92, needsHumanReview: false,
  });

  const result = await service.create(
    { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '需要买米' },
    familyUser,
  );
  await flushPromises();

  expect(result).toBeDefined();
  expect(mockAiService.classify).toHaveBeenCalledWith('需要买米');
  expect(mockRiskService.evaluateAndCreateEvent).not.toHaveBeenCalled();
});

it('HEALTH 高置信度文本应触发 ABNORMAL_TEXT 风险事件', async () => {
  mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
  mockPrisma.checkIn.create.mockResolvedValue({
    id: 'ci-ai-2', elderId: 'elder-1', method: 'TEXT',
    content: '我头晕需要帮助', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
  });
  mockAiService.classify.mockResolvedValue({
    type: 'HEALTH', confidence: 0.88, needsHumanReview: false,
  });

  const result = await service.create(
    { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '我头晕需要帮助' },
    familyUser,
  );
  await flushPromises();

  expect(result).toBeDefined();
  expect(mockAiService.classify).toHaveBeenCalledWith('我头晕需要帮助');
  expect(mockRiskService.evaluateAndCreateEvent).toHaveBeenCalledWith({
    elderId: 'elder-1',
    abnormalText: true,
  });
});

it('低置信度（needsHumanReview=true）应触发风险事件', async () => {
  mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
  mockPrisma.checkIn.create.mockResolvedValue({
    id: 'ci-ai-3', elderId: 'elder-1', method: 'TEXT',
    content: '不太清楚...嗯...那个...', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
  });
  mockAiService.classify.mockResolvedValue({
    type: 'LIFE', confidence: 0.35, needsHumanReview: true,
  });

  const result = await service.create(
    { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '不太清楚...嗯...那个...' },
    familyUser,
  );
  await flushPromises();

  expect(result).toBeDefined();
  expect(mockRiskService.evaluateAndCreateEvent).toHaveBeenCalledWith({
    elderId: 'elder-1',
    abnormalText: true,
  });
});

it('AI 分类失败时应静默降级，不影响 CheckIn 创建', async () => {
  mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
  mockPrisma.checkIn.create.mockResolvedValue({
    id: 'ci-ai-4', elderId: 'elder-1', method: 'TEXT',
    content: '需要帮助', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
  });
  mockAiService.classify.mockRejectedValue(new Error('AI service unavailable'));

  // 不应抛错
  const result = await service.create(
    { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '需要帮助' },
    familyUser,
  );
  await flushPromises();

  expect(result).toBeDefined();
  expect(result.method).toBe('TEXT');
  // AI 不可用时，不应触发风险事件
  expect(mockRiskService.evaluateAndCreateEvent).not.toHaveBeenCalled();
});

it('ONE_TAP 模式（无文本内容）不应调用 AI 分类', async () => {
  mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
  mockPrisma.checkIn.create.mockResolvedValue({
    id: 'ci-ai-5', elderId: 'elder-1', method: 'ONE_TAP',
    content: null, voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
  });

  const result = await service.create(
    { elderId: 'elder-1', method: CheckInMethod.ONE_TAP },
    familyUser,
  );
  await flushPromises();

  expect(result).toBeDefined();
  expect(mockAiService.classify).not.toHaveBeenCalled();
  expect(mockRiskService.evaluateAndCreateEvent).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: 运行测试，确认 AI 集成测试全部失败**

```powershell
npx jest --config apps/api/jest.config.ts -- apps/api/src/modules/check-ins/check-ins.service.spec.ts --no-coverage
```

Expected: 原有的 8 个测试仍然 PASS，新增的 5 个测试 FAIL（因为注入依赖失败或 `detectAbnormalText` 方法不存在）

- [ ] **Step 3: 修改 `check-ins.service.ts` 实现 AI 集成**

将 `apps/api/src/modules/check-ins/check-ins.service.ts` 替换为：

```typescript
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, CheckInMethod } from '@prisma/client';
import { AiService, isAbnormalTextResult } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class CheckInsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly aiService: AiService,
    private readonly riskService: RiskService,
  ) {}

  async create(
    dto: { elderId: string; method: CheckInMethod; content?: string; voiceUrl?: string },
    requester: Requester,
  ) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: dto.elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    this.authorizeAccess(elder, requester);

    if (dto.method === CheckInMethod.VOICE && !dto.voiceUrl) {
      throw new BadRequestException('VOICE 模式必须提供语音文件 URL');
    }
    if (dto.method === CheckInMethod.TEXT && !dto.content) {
      throw new BadRequestException('TEXT 模式必须提供文本内容');
    }
    if (dto.method === CheckInMethod.PROXY && !dto.content) {
      throw new BadRequestException('PROXY 模式必须提供备注说明');
    }

    if (dto.voiceUrl) {
      const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac'];
      const lower = dto.voiceUrl.toLowerCase();
      const valid = allowedExtensions.some((ext) => lower.endsWith(ext));
      if (!valid) {
        throw new BadRequestException(`不支持的语音文件类型，允许: ${allowedExtensions.join(', ')}`);
      }
    }

    const checkIn = await this.prisma.checkIn.create({
      data: {
        elderId: dto.elderId,
        method: dto.method,
        content: dto.content || null,
        voiceUrl: dto.voiceUrl || null,
        status: 'NORMAL',
      },
    });

    // Fire-and-forget: AI 异常文本检测不阻塞 CheckIn 响应
    if (dto.content && (dto.method === CheckInMethod.TEXT || dto.method === CheckInMethod.PROXY)) {
      this.detectAbnormalText(dto.elderId, dto.content);
    }

    return checkIn;
  }

  async findByElder(
    elderId: string,
    query: { page?: number; limit?: number },
    requester: Requester,
  ) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');
    this.authorizeAccess(elder, requester);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.checkIn.findMany({
        where: { elderId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.checkIn.count({ where: { elderId } }),
    ]);

    return { items, total, page, limit };
  }

  /**
   * 异步检测报平安文本是否异常，若异常则自动生成风险事件。
   * 静默降级：AI 不可用时不影响 CheckIn 创建。
   */
  private async detectAbnormalText(elderId: string, content: string): Promise<void> {
    try {
      const result = await this.aiService.classify(content);
      if (isAbnormalTextResult(result)) {
        await this.riskService.evaluateAndCreateEvent({ elderId, abnormalText: true });
      }
    } catch {
      // 静默降级：AI 服务不可用或合规拦截命中，不阻塞主流程
    }
  }

  private authorizeAccess(elder: any, requester: Requester) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.FAMILY) {
      const isLinked = elder.familyLinks?.some(
        (fl: any) => fl.userId === requester.sub,
      );
      if (!isLinked) throw new ForbiddenException('无权限为此老人报平安');
      return;
    }
    if (requester.district && elder.district !== requester.district) {
      throw new ForbiddenException('无权限操作其他片区的老人');
    }
  }
}
```

> **关键变更点：**
> 1. 新增 import：`AiService`, `isAbnormalTextResult`, `RiskService`
> 2. 构造函数新增 `aiService` 和 `riskService` 注入
> 3. `create()` 返回值从直接 `return this.prisma.checkIn.create(...)` 改为先 `const checkIn = await ...`，返回前 fire-and-forget 调用 `detectAbnormalText()`
> 4. 新增 `private async detectAbnormalText()` 方法

- [ ] **Step 4: 运行测试，确认全部通过**

```powershell
npx jest --config apps/api/jest.config.ts -- apps/api/src/modules/check-ins/check-ins.service.spec.ts --no-coverage
```

Expected: 全部 13 个测试 PASS（8 个原有 + 5 个新增）

- [ ] **Step 5: 类型检查**

```powershell
npx tsc --project apps/api/tsconfig.json --noEmit
```

Expected: 无类型错误

- [ ] **Step 6: 提交**

```powershell
git add apps/api/src/modules/check-ins/check-ins.service.ts apps/api/src/modules/check-ins/check-ins.service.spec.ts
git commit -m "feat: integrate AI abnormal text detection into CheckIn create flow"
```

---

### Task 4: 全量测试验证与覆盖率检查

**Files:** 无新建/修改，仅验证

- [ ] **Step 1: 运行 AI 模块全量测试**

```powershell
npx jest --config apps/api/jest.config.ts -- apps/api/src/modules/ai/ --no-coverage
```

Expected: 全部 PASS

- [ ] **Step 2: 运行 CheckIn 模块全量测试**

```powershell
npx jest --config apps/api/jest.config.ts -- apps/api/src/modules/check-ins/ --no-coverage
```

Expected: 全部 PASS

- [ ] **Step 3: 运行全量后端测试 + 覆盖率**

```powershell
npx jest --config apps/api/jest.config.ts -- --coverage
```

Expected:
- 全部测试 PASS
- 行覆盖率 ≥ 80%
- `modules/risk` 覆盖率 ≥ 95%（未新增该模块代码，应保持达标）

- [ ] **Step 4: 确认 CI 不打真实 AI API**

验证 `ai.service.spec.ts` 和 `check-ins.service.spec.ts` 中所有 AI 调用均通过 mock，无需真实 `OPENAI_API_KEY`：

```powershell
npx jest --config apps/api/jest.config.ts -- apps/api/src/modules/ai/ apps/api/src/modules/check-ins/ --no-coverage
```

以上命令在**未设置 `OPENAI_API_KEY` 环境变量**的情况下应全部 PASS。

---

### Task 5: 更新 GitHub Issue 状态

**Files:** 无代码变更

- [ ] **Step 1: 更新 Issue #4 的子任务勾选状态**

使用 GitHub API 更新 Issue #4，将已完成的子任务标记为完成。

- [ ] **Step 2: 提交最终变更**

```powershell
git add -A
git commit -m "chore: mark Epic 6 AI integration complete"
```

---

## 验收清单

完成所有 Task 后，逐项确认：

- [ ] `isAbnormalTextResult` 纯函数可独立单测，6 个边界场景覆盖
- [ ] `POST /check-ins` TEXT 模式含 HEALTH 类高置信度文本 → 自动生成 `RiskEvent`（`source: ABNORMAL_TEXT`）
- [ ] `POST /check-ins` 正常文本（ERRAND/LIFE 高置信度）→ 不生成风险事件
- [ ] `POST /check-ins` 低置信度文本 → `needsHumanReview=true` → 触发风险事件
- [ ] AI 服务不可用 → CheckIn 创建成功，不抛错（静默降级）
- [ ] ONE_TAP 模式不触发 AI 调用
- [ ] CI 环境下无需真实 `OPENAI_API_KEY`，所有测试通过
- [ ] 全量覆盖率达标：后端 ≥ 80%，risk 模块 ≥ 95%
