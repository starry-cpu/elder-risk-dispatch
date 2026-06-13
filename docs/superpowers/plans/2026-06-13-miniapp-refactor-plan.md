# 微信小程序前端系统性重构 · 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通「登录 → 角色识别 → 老人身份关联 → 业务操作」完整闭环，统一老人端/工人端视觉与交互规范，修复 elderId 缺失、假录音 voiceUrl 等遗留问题。

**Architecture:** 后端补 3 处（`GET /elders/mine` 咽喉接口、work-orders.findAll 放宽 FAMILY 鉴权、`POST /uploads/audio` 代理上传）；前端把散落的 `getStorageSync('elderId')` 收归到 auth store，真录音上传，路由统一，新增未绑定引导页。

**Tech Stack:** 后端 NestJS 11.x + Prisma 6.x + Jest 29.x + multer；前端 uni-app + Vue3 + Pinia + luch-request + vitest + wot-design-uni

**Source spec:** `docs/superpowers/specs/2026-06-13-miniapp-refactor-design.md`

---

## Branch & Dependencies

- **Branch:** 复用当前 `epic-8/frontend-three-platforms`（已是该特性分支）
- **External dependency:** 后端运行 `pnpm dev`（localhost:3000，Swagger 在 /api/docs）；MinIO 需启动（uploads 阶段验证用）
- **硬约束（详见 spec §3）：** API base 用局域网 IP、uni.scss 内联变量、老人端用 BEM 不用原子类、所有请求走统一 client（文件上传除外）

---

## 阶段 A：后端三接口（咽喉打通）

### Task 1: 新增 `GET /elders/mine` 接口

**Files:**
- Modify: `apps/api/src/modules/elders/elders.service.ts`
- Modify: `apps/api/src/modules/elders/elders.service.spec.ts`
- Modify: `apps/api/src/modules/elders/elders.controller.ts`

- [ ] **Step 1: Write the failing test**

在 `apps/api/src/modules/elders/elders.service.spec.ts` 的最内层 describe 块末尾（最后一个 `});` 之前）添加：

```typescript
  describe('findMine', () => {
    it('should return elders linked to the requesting FAMILY user', async () => {
      mockPrisma.elderFamilyLink.findMany.mockResolvedValue([
        { elderId: 'e-1', elder: { id: 'e-1', name: '张大爷', serviceLevel: 'HIGH', district: '朝阳区' } },
        { elderId: 'e-2', elder: { id: 'e-2', name: '李奶奶', serviceLevel: 'NORMAL', district: '朝阳区' } },
      ]);

      const result = await service.findMine({ sub: 'user-1', role: Role.FAMILY });

      expect(mockPrisma.elderFamilyLink.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { elder: { select: { id: true, name: true, serviceLevel: true, district: true } } },
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({ id: 'e-1', name: '张大爷', serviceLevel: 'HIGH', district: '朝阳区' });
    });

    it('should return empty items when user has no family links', async () => {
      mockPrisma.elderFamilyLink.findMany.mockResolvedValue([]);

      const result = await service.findMine({ sub: 'orphan-user', role: Role.FAMILY });

      expect(result.items).toEqual([]);
    });
  });
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd apps/api && pnpm jest --testPathPattern="elders.service.spec" --no-coverage`
Expected: FAIL — `service.findMine is not a function`

- [ ] **Step 3: Implement findMine in service**

在 `apps/api/src/modules/elders/elders.service.ts` 的 `EldersService` 类中（`findAll` 方法之后）添加：

```typescript
  async findMine(requester: Requester) {
    const links = await this.prisma.elderFamilyLink.findMany({
      where: { userId: requester.sub },
      include: { elder: { select: { id: true, name: true, serviceLevel: true, district: true } } },
    });
    return { items: links.map((l: any) => l.elder) };
  }
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd apps/api && pnpm jest --testPathPattern="elders.service.spec" --no-coverage`
Expected: PASS — 现有测试 + 2 个新 findMine 测试全过

- [ ] **Step 5: Wire up controller endpoint**

在 `apps/api/src/modules/elders/elders.controller.ts` 的 `findAll` 方法之后添加（注意：必须在 `@Get(':id')` 之前，否则 `mine` 会被当作 `:id` 参数）：

```typescript
  @Get('mine')
  @ApiOperation({ summary: '查询当前家属关联的老人列表' })
  findMine(@CurrentUser() user: any) {
    return this.eldersService.findMine(user);
  }
```

- [ ] **Step 6: 启动后端，Swagger 验证**

Run: `cd apps/api && pnpm dev`（或根目录 `pnpm dev`）
打开 `http://localhost:3000/api/docs`，确认 `GET /elders/mine` 出现在 Elders 标签下。用带 FAMILY token 的请求调（可用 admin-login 拿 ADMIN token 先验证不报路由错）。
Expected: 接口可见，鉴权生效。

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/elders/elders.service.ts apps/api/src/modules/elders/elders.service.spec.ts apps/api/src/modules/elders/elders.controller.ts
git commit -m "feat(api): add GET /elders/mine for current user's linked elders"
```

---

### Task 2: 放宽 work-orders.findAll 对 FAMILY 的鉴权

**Files:**
- Modify: `apps/api/src/modules/work-orders/work-orders.service.ts`
- Modify: `apps/api/src/modules/work-orders/work-orders.service.spec.ts`

- [ ] **Step 1: Write the failing test**

在 `apps/api/src/modules/work-orders/work-orders.service.spec.ts` 的 findAll describe 块内（若没有则新建一个 describe）添加 FAMILY 相关测试。先阅读该 spec 文件找到 `describe('findAll'` 块的位置，在其内添加：

```typescript
    it('should filter by family-linked elders for FAMILY role', async () => {
      const familyUser = { sub: 'family-1', role: Role.FAMILY, district: undefined };
      mockPrisma.elderFamilyLink.findMany.mockResolvedValue([
        { elderId: 'e-1' },
        { elderId: 'e-2' },
      ]);
      mockPrisma.workOrder.findMany.mockResolvedValue([]);
      mockPrisma.workOrder.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 }, familyUser as any);

      expect(mockPrisma.elderFamilyLink.findMany).toHaveBeenCalledWith({
        where: { userId: 'family-1' },
        select: { elderId: true },
      });
      expect(mockPrisma.workOrder.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ elderId: { in: ['e-1', 'e-2'] } }),
        }),
      );
    });

    it('should throw ForbiddenException when FAMILY requests an elderId not in their links', async () => {
      const familyUser = { sub: 'family-1', role: Role.FAMILY, district: undefined };
      mockPrisma.elderFamilyLink.findMany.mockResolvedValue([{ elderId: 'e-1' }]);

      await expect(
        service.findAll({ page: 1, limit: 20, elderId: 'e-other' }, familyUser as any),
      ).rejects.toThrow('无权限查看此老人的工单');
    });
```

> 注意：spec 文件顶部需已 import `Role` from `@prisma/client`。若 mockPrisma 尚无 `elderFamilyLink`，需在 mockPrisma 对象里补 `elderFamilyLink: { findMany: jest.fn() }`。

- [ ] **Step 2: Run test — verify it fails**

Run: `cd apps/api && pnpm jest --testPathPattern="work-orders.service.spec" --no-coverage`
Expected: FAIL — FAMILY 测试用例失败（当前逻辑会用 district 过滤，elderFamilyLink 未被调用）

- [ ] **Step 3: Implement FAMILY branch in findAll**

修改 `apps/api/src/modules/work-orders/work-orders.service.ts` 的 `findAll` 方法（当前约 174-186 行的 district 隔离逻辑）。把这段：

```typescript
    // District isolation
    if (requester.role !== Role.ADMIN) {
      where.elder = { district: requester.district ?? '' };
    } else if (district) {
      where.elder = { district };
    }
```

替换为：

```typescript
    // 按角色隔离：FAMILY 只看关联老人的工单，worker 保持 district 隔离
    if (requester.role === Role.FAMILY) {
      const myLinks = await this.prisma.elderFamilyLink.findMany({
        where: { userId: requester.sub },
        select: { elderId: true },
      });
      const myElderIds = myLinks.map((l: any) => l.elderId);
      // 越权防护：若传了 elderId 但不在自己的关联列表内，拒绝
      if (elderId && !myElderIds.includes(elderId)) {
        throw new ForbiddenException('无权限查看此老人的工单');
      }
      where.elderId = myElderIds.length > 0 ? { in: myElderIds } : { in: ['__none__'] };
    } else if (requester.role !== Role.ADMIN) {
      // worker 保持原有 district 隔离
      where.elder = { district: requester.district ?? '' };
    } else if (district) {
      where.elder = { district };
    }
```

> 说明：FAMILY 无关联老人时用 `{ in: ['__none__'] }` 保证返回空而非全表。确保文件顶部已 import `ForbiddenException`（现有代码已用 NotFoundException/BadRequestException，确认 import 行包含 ForbiddenException，没有则补）。

- [ ] **Step 4: Run test — verify it passes**

Run: `cd apps/api && pnpm jest --testPathPattern="work-orders.service.spec" --no-coverage`
Expected: PASS — 现有测试（worker/admin）+ 2 个新 FAMILY 测试全过

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/modules/work-orders/work-orders.service.ts apps/api/src/modules/work-orders/work-orders.service.spec.ts
git commit -m "feat(api): allow FAMILY role to query own-linked work orders"
```

---

### Task 3: 安装 multer 依赖

**Files:**
- Modify: `apps/api/package.json`

- [ ] **Step 1: Install multer + types**

Run: `cd apps/api && pnpm add multer @types/multer`
Expected: 安装成功，package.json dependencies 出现 multer

- [ ] **Step 2: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml
git commit -m "chore(api): add multer for multipart audio upload"
```

---

### Task 4: 新增 `POST /uploads/audio` 代理上传接口

**Files:**
- Modify: `apps/api/src/modules/uploads/uploads.service.ts`
- Modify: `apps/api/src/modules/uploads/uploads.service.spec.ts`
- Modify: `apps/api/src/modules/uploads/uploads.controller.ts`

- [ ] **Step 1: Write the failing test**

在 `apps/api/src/modules/uploads/uploads.service.spec.ts` 末尾添加 describe 块（先读该文件确认现有测试结构和 mock 方式）：

```typescript
  describe('saveAudioFile', () => {
    it('should upload audio buffer to MinIO and return { url, key }', async () => {
      const buffer = Buffer.from('fake-audio');
      const result = await service.saveAudioFile(buffer, 'audio/mpeg', 'test.mp3');

      expect(result.key).toMatch(/^checkins\/[a-f0-9-]+\.mp3$/);
      expect(result.url).toContain(result.key);
      expect(result.url).toContain('9000'); // MinIO endpoint 端口
    });

    it('should throw BadRequestException for unsupported audio type', async () => {
      const buffer = Buffer.from('fake');
      await expect(service.saveAudioFile(buffer, 'video/mp4', 'test.mp4')).rejects.toThrow(
        BadRequestException,
      );
    });
  });
```

> 说明：若 MinIO 未启动，PutObjectCommand 会抛连接错误。测试需 mock S3Client.send。先读现有 spec 看 uploads.service.spec.ts 是否已 mock S3Client；若已 mock，新测试沿用。**如果测试环境无法连 MinIO，把第一个测试改为验证 key 生成逻辑 + ContentType 校验调用即可**（saveAudioFile 内部分两步：校验 + 上传，可先验证校验步骤）。

- [ ] **Step 2: Run test — verify it fails**

Run: `cd apps/api && pnpm jest --testPathPattern="uploads.service.spec" --no-coverage`
Expected: FAIL — `service.saveAudioFile is not a function`

- [ ] **Step 3: Implement saveAudioFile in service**

在 `apps/api/src/modules/uploads/uploads.service.ts` 的 `UploadsService` 类中添加：

```typescript
  async saveAudioFile(buffer: Buffer, contentType: string, fileName: string): Promise<PresignedUrlResult> {
    const allowed = this.getAllowedTypesForFolder('checkins'); // ['audio/mp3', 'audio/wav', 'audio/m4a']
    if (!this.validateContentType(contentType, allowed)) {
      throw new BadRequestException(
        `不支持的音频类型: ${contentType}。允许: ${allowed.join(', ')}`,
      );
    }

    const ext = fileName.split('.').pop() || 'mp3';
    const uniqueFileName = `${uuidv4()}.${ext}`;
    const key = `checkins/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);

    // 返回可访问的 url（MinIO endpoint + bucket + key）
    const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    const url = `${endpoint}/${this.bucket}/${key}`;
    return { url, key, expiresIn: 0 };
  }
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd apps/api && pnpm jest --testPathPattern="uploads.service.spec" --no-coverage`
Expected: PASS

- [ ] **Step 5: Wire up controller endpoint**

在 `apps/api/src/modules/uploads/uploads.controller.ts` 添加（需 import `Post`, `UseInterceptors`, `UploadedFile`, `FileInterceptor`, `Controller` 已含 Get/Post）：

```typescript
import { Controller, Get, Post, Query, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';

  @Post('audio')
  @ApiOperation({ summary: '上传语音文件（小程序 multipart 代理）' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB 上限
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('未收到文件');
    return this.uploadsService.saveAudioFile(file.buffer, file.mimetype, file.originalname);
  }
```

> 需在顶部 import `BadRequestException` from `@nestjs/common`。

- [ ] **Step 6: Swagger + curl 验证**

Run: 启动后端，打开 Swagger 确认 `POST /uploads/audio` 可见。
手动 curl 验证（需有效 token）：
```bash
curl -X POST http://192.168.31.158:3000/api/v1/uploads/audio \
  -H "Authorization: Bearer <TOKEN>" \
  -F "file=@test.mp3;type=audio/mpeg"
```
Expected: 返回 `{ url: "http://...:9000/care/checkins/xxx.mp3", key, expiresIn }`（需 MinIO 启动）

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/modules/uploads/
git commit -m "feat(api): add POST /uploads/audio proxy for mini-program voice upload"
```

---

## 阶段 E：数据准备（测试数据 seed）

### Task 5: 准备老人端联调数据

**Files:**
- Create or Modify: `apps/api/prisma/seed.ts`（若不存在则新建；若存在则追加 family-link seed）

- [ ] **Step 1: 确认现有 seed 机制**

Run: 检查 `apps/api/package.json` 是否有 `prisma:seed` 脚本；检查 `apps/api/prisma/` 下有无 `seed.ts`。

- [ ] **Step 2: 编写/追加 seed 逻辑**

确保 seed 后数据库有：
1. 一个 FAMILY 角色的 User（带 openid，便于微信登录 upsert 命中）+ 一个 GRID_WORKER User
2. 至少 1 个 Elder
3. 一条 ElderFamilyLink（关联上面的 FAMILY User 和 Elder）
4. 该 Elder 至少 1 条 WorkOrder（状态 ASSIGNED 或 IN_PROGRESS，便于 order-progress 验证）

seed 脚本示例（追加到现有 seed，或新建）：
```typescript
// 仅展示关联部分，elder/user 的具体字段按现有 seed 风格补全
const familyUser = await prisma.user.upsert({
  where: { openid: 'test-family-openid-001' },
  update: {},
  create: { openid: 'test-family-openid-001', name: '测试家属', role: 'FAMILY' },
});

const elder = await prisma.elder.create({ data: { name: '测试老人', district: '测试区' } });

await prisma.elderFamilyLink.create({
  data: { elderId: elder.id, userId: familyUser.id, relation: '子女' },
});

await prisma.workOrder.create({
  data: {
    elderId: elder.id, type: 'LIFE', level: 'MEDIUM', status: 'ASSIGNED',
    createdById: <某 admin/worker id>,
  },
});
```

> 注意：`createdById` 是 WorkOrder 必填字段（schema.prisma:217），需先有该 user。

- [ ] **Step 3: 运行 seed**

Run: `cd apps/api && pnpm prisma:seed`（或 `npx prisma db seed`）
Expected: 数据写入成功。用 prisma studio 或 SQL 确认 ElderFamilyLink 存在。

- [ ] **Step 4: Commit（如新建了 seed 文件）**

```bash
git add apps/api/prisma/seed.ts apps/api/package.json
git commit -m "chore(api): seed family-user + elder + link + workorder for miniapp testing"
```

---

## 阶段 B：前端 auth store + API 层

### Task 6: 新增 ElderBrief 类型模块 + eldersApi.findMine

**Files:**
- Create: `apps/miniapp/src/composables/useElderIdentity.ts`
- Modify: `apps/miniapp/src/api/elders.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/miniapp/src/composables/__tests__/useElderIdentity.spec.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import type { ElderBrief } from '../useElderIdentity';

describe('ElderBrief type', () => {
  it('should accept the expected shape', () => {
    const elder: ElderBrief = { id: 'e-1', name: '张大爷', serviceLevel: 'HIGH', district: '朝阳区' };
    expect(elder.id).toBe('e-1');
    expect(elder.name).toBe('张大爷');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd apps/miniapp && npx vitest run src/composables/__tests__/useElderIdentity.spec.ts`
Expected: FAIL — `Cannot find module '../useElderIdentity'`

- [ ] **Step 3: Create the type module**

Create `apps/miniapp/src/composables/useElderIdentity.ts`:

```typescript
// 老人精简信息（与 GET /elders/mine 返回一致）
export interface ElderBrief {
  id: string;
  name: string;
  serviceLevel: string;
  district: string;
}

// 从 elders 列表里按 id 选当前老人，找不到返回 null
export function pickCurrentElder(elders: ElderBrief[], id: string | undefined): ElderBrief | null {
  if (!id) return elders[0] ?? null;
  return elders.find((e) => e.id === id) ?? null;
}
```

- [ ] **Step 4: Add findMine to elders API**

修改 `apps/miniapp/src/api/elders.ts`：

```typescript
import http, { wrap } from './client';
export const eldersApi = {
  getById: (id: string) => wrap(http.get(`/elders/${id}`)),
  getRiskProfile: (id: string) => wrap(http.get(`/elders/${id}/risk-profile`)),
  findMine: () => wrap(http.get('/elders/mine')),
};
```

- [ ] **Step 5: Run test — verify it passes**

Run: `cd apps/miniapp && npx vitest run src/composables/__tests__/useElderIdentity.spec.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/miniapp/src/composables/useElderIdentity.ts apps/miniapp/src/composables/__tests__/useElderIdentity.spec.ts apps/miniapp/src/api/elders.ts
git commit -m "feat(miniapp): add ElderBrief type and eldersApi.findMine"
```

---

### Task 7: auth store 加 elders/currentElderId/ensureElders

**Files:**
- Modify: `apps/miniapp/src/stores/auth.ts`
- Modify: `apps/miniapp/src/stores/__tests__/auth.spec.ts`

- [ ] **Step 1: Write the failing test**

修改 `apps/miniapp/src/stores/__tests__/auth.spec.ts`，扩展 uni mock 并添加测试。在文件顶部扩展 mock：

```typescript
vi.stubGlobal('uni', {
  getStorageSync: vi.fn((key: string) => ''),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
});
```

在 describe 块内添加：

```typescript
  it('isElder is true only for FAMILY role (not ELDER which is dead code)', () => {
    const store = useAuthStore();
    store.setUser({ id: 'u1', name: '家属', role: 'FAMILY' });
    expect(store.isElder).toBe(true);
  });

  it('setCurrentElder persists currentElderId to storage', () => {
    const store = useAuthStore();
    store.setCurrentElder('elder-1');
    expect(store.currentElderId).toBe('elder-1');
    expect(uni.setStorageSync).toHaveBeenCalledWith('currentElderId', 'elder-1');
  });

  it('logout clears elders and currentElderId', () => {
    const store = useAuthStore();
    store.setToken('t');
    store.setUser({ id: 'u1', name: '家属', role: 'FAMILY' });
    store.setCurrentElder('elder-1');
    store.logout();
    expect(store.currentElderId).toBe('');
    expect(store.elders).toEqual([]);
    expect(uni.removeStorageSync).toHaveBeenCalledWith('currentElderId');
  });
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd apps/miniapp && npx vitest run src/stores/__tests__/auth.spec.ts`
Expected: FAIL — `store.setCurrentElder is not a function` / `store.currentElderId` undefined

- [ ] **Step 3: Implement auth store changes**

修改 `apps/miniapp/src/stores/auth.ts`：
1. 顶部 import 加 `import type { ElderBrief } from '@/composables/useElderIdentity';` 和 `import { eldersApi } from '@/api/elders';`
2. 在 `user` ref 之后添加：
```typescript
  const elders = ref<ElderBrief[]>(uni.getStorageSync('elders') || []);
  const currentElderId = ref<string>(uni.getStorageSync('currentElderId') || '');
  const currentElder = computed(() =>
    elders.value.find((e) => e.id === currentElderId.value) || null,
  );
```
3. 修改 `isElder`：删掉 `|| user.value?.role === 'ELDER'`，简化为：
```typescript
  const isElder = computed(() => user.value?.role === 'FAMILY');
```
4. 添加方法（在 `logout` 之后）：
```typescript
  function setCurrentElder(id: string) {
    currentElderId.value = id;
    uni.setStorageSync('currentElderId', id);
  }

  async function ensureElders() {
    if (!isElder.value) return;
    if (elders.value.length > 0) return;
    try {
      const res = await eldersApi.findMine();
      const items = (res as any)?.data?.data?.items ?? [];
      elders.value = items;
      uni.setStorageSync('elders', items);
      if (items.length > 0 && !currentElderId.value) {
        setCurrentElder(items[0].id);
      }
    } catch {
      elders.value = [];
    }
  }
```
5. 修改 `logout`，在 `uni.removeStorageSync('user')` 之后添加：
```typescript
    elders.value = [];
    currentElderId.value = '';
    uni.removeStorageSync('elders');
    uni.removeStorageSync('currentElderId');
```
6. 在 `login` 和 `fetchUser` 成功 setUser 之后，各加一行 `await ensureElders();`（确保只对 FAMILY 生效）
7. 修改 return 对象，添加导出：`elders, currentElderId, currentElder, setCurrentElder, ensureElders`

- [ ] **Step 4: Run test — verify it passes**

Run: `cd apps/miniapp && npx vitest run src/stores/__tests__/auth.spec.ts`
Expected: PASS — 所有测试通过

- [ ] **Step 5: Commit**

```bash
git add apps/miniapp/src/stores/auth.ts apps/miniapp/src/stores/__tests__/auth.spec.ts
git commit -m "feat(miniapp): add elders/currentElderId to auth store, remove ELDER dead code"
```

---

### Task 8: 重写 upload.ts 为 uploadAudio 代理上传

**Files:**
- Modify: `apps/miniapp/src/api/upload.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/miniapp/src/api/__tests__/upload.spec.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadApi } from '../upload';

describe('uploadApi.uploadAudio', () => {
  beforeEach(() => {
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn((key: string) => (key === 'token' ? 'fake-token' : (key === 'apiBase' ? '' : ''))),
      uploadFile: vi.fn(),
    });
  });

  it('should call uni.uploadFile with correct params and resolve { url, key }', async () => {
    (uni.uploadFile as any).mockImplementation((opts: any) => {
      opts.success({ data: JSON.stringify({ code: 0, data: { url: 'http://x:9000/care/checkins/a.mp3', key: 'checkins/a.mp3' } }) });
    });

    const result = await uploadApi.uploadAudio('/tmp/rec.mp3');

    expect(uni.uploadFile).toHaveBeenCalledWith(expect.objectContaining({
      url: expect.stringContaining('/uploads/audio'),
      filePath: '/tmp/rec.mp3',
      name: 'file',
    }));
    expect(result).toEqual({ url: 'http://x:9000/care/checkins/a.mp3', key: 'checkins/a.mp3' });
  });

  it('should reject on business error (code !== 0)', async () => {
    (uni.uploadFile as any).mockImplementation((opts: any) => {
      opts.success({ data: JSON.stringify({ code: 1, message: '不支持的音频类型' }) });
    });

    await expect(uploadApi.uploadAudio('/tmp/bad.mp4')).rejects.toThrow('不支持的音频类型');
  });
});
```

- [ ] **Step 2: Run test — verify it fails**

Run: `cd apps/miniapp && npx vitest run src/api/__tests__/upload.spec.ts`
Expected: FAIL — `uploadApi.uploadAudio is not a function`

- [ ] **Step 3: Implement uploadAudio**

整体重写 `apps/miniapp/src/api/upload.ts`：

```typescript
import { API_BASE } from './client';

export const uploadApi = {
  // 小程序录音临时路径 → POST /uploads/audio (multipart) → { url, key }
  // 唯一绕过统一 luch-request 客户端的接口：multipart 文件上传必须用 uni.uploadFile
  uploadAudio: (filePath: string) =>
    new Promise<{ url: string; key: string }>((resolve, reject) => {
      const token = uni.getStorageSync('token');
      const apiBase = uni.getStorageSync('apiBase') || API_BASE;
      uni.uploadFile({
        url: `${apiBase}/uploads/audio`,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (res) => {
          try {
            const body = JSON.parse(res.data);
            if (body.code !== 0) return reject(new Error(body.message || '上传失败'));
            resolve(body.data);
          } catch {
            reject(new Error('上传响应解析失败'));
          }
        },
        fail: (err) => reject(new Error(err?.errMsg || '上传失败')),
      });
    }),
};
```

- [ ] **Step 4: Run test — verify it passes**

Run: `cd apps/miniapp && npx vitest run src/api/__tests__/upload.spec.ts`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/miniapp/src/api/upload.ts apps/miniapp/src/api/__tests__/upload.spec.ts
git commit -m "feat(miniapp): rewrite upload.ts to uploadAudio proxy via uni.uploadFile"
```

---

## 阶段 C1：真录音 composable

### Task 9: 重写 useSosVoice.ts 为真录音

**Files:**
- Modify: `apps/miniapp/src/composables/useSosVoice.ts`
- Modify: `apps/miniapp/src/composables/__tests__/useSosVoice.spec.ts`

- [ ] **Step 1: Read existing spec to understand test patterns**

Run: 读 `apps/miniapp/src/composables/__tests__/useSosVoice.spec.ts`，了解现有断言风格（mock uni 与计时器的方式）。

- [ ] **Step 2: Write the failing test (rewrite spec)**

重写 `apps/miniapp/src/composables/__tests__/useSosVoice.spec.ts`，使用一个可注入的 mock recorder factory：

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useSosVoice } from '../useSosVoice';

// 构造一个假的 RecorderManager，可触发 onStart/onStop 回调
function createMockRecorder() {
  const handlers: Record<string, Function> = {};
  return {
    recorder: {
      start: vi.fn((opts?: any) => {
        handlers.onStart?.();
        // 记录 opts 供断言
        (handlers as any)._lastOpts = opts;
      }),
      stop: vi.fn(() => {
        handlers.onStop?.({ tempFilePath: '/tmp/rec.mp3', duration: 3000 });
      }),
      onStart: vi.fn((cb: Function) => { handlers.onStart = cb; }),
      onStop: vi.fn((cb: Function) => { handlers.onStop = cb; }),
    },
    handlers,
  };
}

describe('useSosVoice (real recording)', () => {
  let mockRecorder: ReturnType<typeof createMockRecorder>;

  beforeEach(() => {
    vi.useFakeTimers();
    mockRecorder = createMockRecorder();
    vi.stubGlobal('uni', {
      getRecorderManager: () => mockRecorder.recorder,
    });
  });

  it('startRecording sets isRecording true and calls recorder.start with mp3 format', () => {
    const { isRecording, startRecording } = useSosVoice();
    startRecording();
    expect(isRecording.value).toBe(true);
    expect(mockRecorder.recorder.start).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'mp3' }),
    );
  });

  it('stopRecording triggers onStop and records tempFilePath', () => {
    const { isRecording, duration, recordedFilePath, startRecording, stopRecording } = useSosVoice();
    startRecording();
    vi.advanceTimersByTime(3000); // 3s 计时
    stopRecording();

    expect(isRecording.value).toBe(false);
    expect(recordedFilePath.value).toBe('/tmp/rec.mp3');
  });

  it('duration increments via timer while recording', () => {
    const { duration, startRecording } = useSosVoice();
    startRecording();
    vi.advanceTimersByTime(2000);
    expect(duration.value).toBe(2);
  });

  it('uploading ref defaults to false', () => {
    const { uploading } = useSosVoice();
    expect(uploading.value).toBe(false);
  });
});
```

- [ ] **Step 3: Run test — verify it fails**

Run: `cd apps/miniapp && npx vitest run src/composables/__tests__/useSosVoice.spec.ts`
Expected: FAIL — 现有实现没有 recordedFilePath/uploading，recorder 调用方式也不匹配

- [ ] **Step 4: Implement real recording**

重写 `apps/miniapp/src/composables/useSosVoice.ts`：

```typescript
import { ref } from 'vue';

// 工厂函数：惰性获取 RecorderManager，便于测试 mock
function getRecorder() {
  return uni.getRecorderManager();
}

export function useSosVoice() {
  const isRecording = ref(false);
  const duration = ref(0);
  const maxDuration = 60;
  const uploading = ref(false);
  const recordedFilePath = ref('');

  let recorder = getRecorder();
  let timer: ReturnType<typeof setInterval> | null = null;

  recorder.onStart(() => {
    isRecording.value = true;
    duration.value = 0;
  });

  recorder.onStop((res: { tempFilePath: string; duration: number }) => {
    isRecording.value = false;
    recordedFilePath.value = res.tempFilePath;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  });

  function startRecording() {
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
    recordedFilePath.value = '';
    // format 选 mp3：满足后端 check-ins 的 .mp3 校验
    recorder.start({ format: 'mp3', duration: 60000, sampleRate: 16000, numberOfChannels: 1 });
    // duration 计时用 setInterval（recorder 自身到 onStop 才给真实时长）
    timer = setInterval(() => {
      duration.value++;
      if (duration.value >= maxDuration) {
        stopRecording();
      }
    }, 1000);
  }

  function stopRecording() {
    recorder.stop(); // 实际停止 + 触发 onStop 回调
  }

  function clear() {
    recordedFilePath.value = '';
    duration.value = 0;
    isRecording.value = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return {
    isRecording,
    duration,
    maxDuration,
    uploading,
    recordedFilePath,
    startRecording,
    stopRecording,
    clear,
  };
}
```

> 注意：`getRecorder()` 在模块顶层调用一次（每个 composable 实例一个 recorder）。测试里 `uni.getRecorderManager` 返回 mock，handlers 在 setup 时注册。onStop 注册后触发 recordedFilePath 更新，由页面读取再上传。

- [ ] **Step 5: Run test — verify it passes**

Run: `cd apps/miniapp && npx vitest run src/composables/__tests__/useSosVoice.spec.ts`
Expected: PASS — 4 个测试通过

- [ ] **Step 6: Commit**

```bash
git add apps/miniapp/src/composables/useSosVoice.ts apps/miniapp/src/composables/__tests__/useSosVoice.spec.ts
git commit -m "feat(miniapp): implement real recording in useSosVoice via RecorderManager"
```

---

## 阶段 C2：老人端三页接 store

### Task 10: check-in 页重构（接 store + 真语音 + 错误处理）

**Files:**
- Modify: `apps/miniapp/src/pagesElder/check-in/index.vue`

> 此任务是 UI 页面重构，无独立单测（页面交互靠微信开发者工具手动验证，符合本计划"每改一处→构建→验证"约定）。

- [ ] **Step 1: 重构 template + script**

修改 `apps/miniapp/src/pagesElder/check-in/index.vue`：
1. script 顶部 import 加 `import { useAuthStore } from '@/stores/auth';` 和 `import { uploadApi } from '@/api/upload';`
2. 删除 `const elderId = ref(uni.getStorageSync('elderId') || '');`，改为 `const auth = useAuthStore();`，所有 `elderId.value` 替换为 `auth.currentElderId`
3. 新增 `const uploading = ref(false);`
4. 修改 `submitCheckIn`：catch 块改为真实反馈：
```typescript
  } catch {
    uni.showToast({ title: '提交失败，请重试', icon: 'none' });
  }
```
5. 修改 `stopVoice`：删除假 `tempUrl`，改为真上传：
```typescript
function stopVoice() {
  stopRecording();
  if (duration.value < 1) {
    uni.showToast({ title: '录音时间太短', icon: 'none' });
    return;
  }
  // 等 onStop 回调写入 recordedFilePath（下一 tick）
  uploading.value = true;
  setTimeout(async () => {
    const filePath = recordedFilePath.value;
    if (!filePath) {
      uni.showToast({ title: '录音失败，请重试', icon: 'none' });
      uploading.value = false;
      return;
    }
    try {
      const { url } = await uploadApi.uploadAudio(filePath);
      await checkInsApi.create({
        elderId: auth.currentElderId,
        method: 'VOICE',
        content: '语音报平安',
        voiceUrl: url,
      });
      uni.showToast({ title: '已报平安 ✅' });
    } catch {
      uni.showToast({ title: '语音提交失败，请重试', icon: 'none' });
    } finally {
      uploading.value = false;
    }
  }, 200);
}
```
6. 修改 useSosVoice 解构：`const { isRecording, duration, recordedFilePath, startRecording, stopRecording } = useSosVoice();`（删除 setVoiceUrl/voiceUrl，新增 recordedFilePath）
7. template 的语音卡片：添加 uploading 态提示（按钮显示"发送中..."）

- [ ] **Step 2: 构建**

Run: `cd apps/miniapp && npx uni build -p mp-weixin`
Expected: 构建成功，dist/build/mp-weixin 生成

- [ ] **Step 3: 微信开发者工具验证**

导入 `apps/miniapp/dist/build/mp-weixin`：
- 登录 FAMILY 账号 → 进入 check-in
- **一键报平安**：点击 → 应弹"已报平安 ✅"（验证 elderId 来自 store、请求成功）
- **文字报平安**：输入文字 → 提交 → 成功
- **语音报平安**：长按 → 松开 → "发送中" → 成功（开发者工具 Network 面板应看到 POST /uploads/audio）

- [ ] **Step 4: Commit**

```bash
git add apps/miniapp/src/pagesElder/check-in/index.vue
git commit -m "feat(miniapp): check-in page uses auth store for elderId + real voice upload"
```

---

### Task 11: sos 页重构（接 store + 真上传）

**Files:**
- Modify: `apps/miniapp/src/pagesElder/sos/index.vue`

- [ ] **Step 1: 重构**

修改 `apps/miniapp/src/pagesElder/sos/index.vue`：
1. import 加 `import { useAuthStore } from '@/stores/auth';` 和 `import { uploadApi } from '@/api/upload';`
2. 删 `setVoiceUrl` 解构，加 `recordedFilePath`
3. `handleTouchEnd` 重写：删假 tempUrl，改真上传：
```typescript
function handleTouchEnd() {
  stopRecording();
  if (duration.value < 1) {
    uni.showToast({ title: '录音时间太短', icon: 'none' });
    return;
  }
  setTimeout(async () => {
    const filePath = recordedFilePath.value;
    if (!filePath) {
      uni.showToast({ title: '录音失败，请重试', icon: 'none' });
      return;
    }
    try {
      const { url } = await uploadApi.uploadAudio(filePath);
      await checkInsApi.create({
        elderId: auth.currentElderId,
        method: 'VOICE',
        content: '语音求助',
        voiceUrl: url,
      });
      uni.showToast({ title: '求助已发出' });
    } catch {
      uni.showToast({ title: '求助发送失败，请重试', icon: 'none' });
    }
  }, 200);
}
```
4. `const auth = useAuthStore();`，删 `uni.getStorageSync('elderId')`

- [ ] **Step 2: 构建验证**

Run: `cd apps/miniapp && npx uni build -p mp-weixin`
微信开发者工具：进入 sos → 长按求助 → 松开 → "求助已发出"
Expected: Network 面板看到 POST /uploads/audio + POST /check-ins

- [ ] **Step 3: Commit**

```bash
git add apps/miniapp/src/pagesElder/sos/index.vue
git commit -m "feat(miniapp): sos page uses auth store + real voice upload"
```

---

### Task 12: order-progress 页重构（按 elderId 过滤）

**Files:**
- Modify: `apps/miniapp/src/pagesElder/order-progress/index.vue`

- [ ] **Step 1: 重构**

修改 `apps/miniapp/src/pagesElder/order-progress/index.vue`：
1. import 加 `import { useAuthStore } from '@/stores/auth';`
2. `const auth = useAuthStore();`
3. `loadData` 改为按 elderId 过滤：
```typescript
async function loadData() {
  loading.value = true;
  try {
    const res = await workOrdersApi.list({ elderId: auth.currentElderId });
    const data = (res as any)?.data?.data;
    if (data?.items) orders.value = data.items;
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}
```

- [ ] **Step 2: 构建验证**

Run: `cd apps/miniapp && npx uni build -p mp-weixin`
微信开发者工具：进入 order-progress → 应显示该老人的工单（非空，seed 数据）
Expected: 列表显示 Task 5 seed 的那条工单

- [ ] **Step 3: Commit**

```bash
git add apps/miniapp/src/pagesElder/order-progress/index.vue
git commit -m "feat(miniapp): order-progress filters by current elderId"
```

---

## 阶段 C4：路由流程统一

### Task 13: 重构 pages/index 路由（抽 routeByRole + ensureElders 接入）

**Files:**
- Modify: `apps/miniapp/src/pages/index/index.vue`

- [ ] **Step 1: 重构 enterApp 抽出 routeByRole**

修改 `apps/miniapp/src/pages/index/index.vue`。把重复的两段路由 if-else 抽成一个函数，enterApp 和 onMounted 共用：

```typescript
import { ref, onMounted } from 'vue';
import AppButton from '@/components/AppButton.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const loading = ref(false);

// 统一角色路由：消除原 enterApp 内两处重复的 if-else
async function routeByRole() {
  // FAMILY 需先确保老人身份就绪
  if (auth.isElder) {
    await auth.ensureElders();
  }
  if (auth.isWorker || auth.isAdmin) {
    uni.redirectTo({ url: '/pagesWorker/risk-tasks/index' });
  } else if (auth.isElder) {
    if (auth.currentElderId) {
      uni.redirectTo({ url: '/pagesElder/check-in/index' });
    } else {
      uni.redirectTo({ url: '/pagesElder/bind/index' }); // 未绑定引导
    }
  } else {
    const role = auth.user?.role || '无';
    uni.showToast({ title: `未知角色(${role})，请联系管理员`, icon: 'none', duration: 3000 });
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function enterApp() {
  loading.value = true;
  try {
    if (!auth.user) {
      await withTimeout(auth.fetchUser(), 8000);
    }
    await routeByRole();
  } catch {
    if (auth.isAuthenticated) {
      uni.showToast({ title: '网络异常，请检查后端服务（localhost:3000）', icon: 'none' });
      return;
    }
    try {
      const { code } = await uniLogin();
      await withTimeout(auth.login(code), 8000);
      await routeByRole();
    } catch (e: any) {
      const msg = e?.message === 'timeout' ? '网络超时，请确认后端已启动' : (e?.message || '登录失败');
      uni.showToast({ title: msg, icon: 'none' });
    }
  } finally {
    loading.value = false;
  }
}

function uniLogin(): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    uni.login({
      success: (res) => resolve({ code: res.code }),
      fail: reject,
    });
  });
}

onMounted(() => {
  // 只在已有完整会话（token + user 均已缓存）时自动跳转，不联网
  if (auth.isAuthenticated && auth.user) {
    routeByRole();
  }
});
```

> 注意：`routeByRole` 是 async（因 ensureElders），onMounted 里调用不 await（fire-and-forget，符合小程序生命周期）。bind 页在 Task 14 创建，此步先引用路径。

- [ ] **Step 2: 构建验证**

Run: `cd apps/miniapp && npx uni build -p mp-weixin`
微信开发者工具：
- 已登录 FAMILY（有缓存）→ 自动进 check-in
- 未登录 → 点"进入工作台" → 触发登录 → 进 check-in
- worker 账号 → 进 risk-tasks

- [ ] **Step 3: Commit**

```bash
git add apps/miniapp/src/pages/index/index.vue
git commit -m "feat(miniapp): unify role routing via routeByRole, integrate ensureElders"
```

---

## 阶段 C3：未绑定引导 + 老人切换

### Task 14: 新增未绑定引导页 bind/index.vue

**Files:**
- Create: `apps/miniapp/src/pagesElder/bind/index.vue`
- Modify: `apps/miniapp/src/pages.json`

- [ ] **Step 1: Create bind page**

Create `apps/miniapp/src/pagesElder/bind/index.vue`：

```vue
<template>
  <view class="page">
    <AppNavbar title="账号绑定" />
    <view class="bind">
      <text class="bind__icon">🔗</text>
      <text class="bind__title">您的账号尚未关联老人</text>
      <text class="bind__hint">请联系社区工作人员完成绑定后即可使用报平安、求助等服务。</text>
      <view class="bind__contact">
        <text class="bind__contact-label">社区服务电话</text>
        <text class="bind__contact-phone">400-000-0000</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppNavbar from '@/components/AppNavbar.vue';
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
}
.bind {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 96rpx 48rpx;
  gap: 24rpx;
}
.bind__icon { font-size: 96rpx; }
.bind__title { font-size: 32rpx; font-weight: 600; color: #2C2B29; }
.bind__hint { font-size: 28rpx; color: #6B6760; text-align: center; line-height: 1.6; }
.bind__contact {
  margin-top: 48rpx;
  background-color: #FEFDFB;
  border-radius: 12rpx;
  padding: 32rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 1rpx 0 #E8E3DA;
}
.bind__contact-label { font-size: 24rpx; color: #9E9990; }
.bind__contact-phone { font-size: 36rpx; font-weight: 600; color: #7A8B6E; }
</style>
```

- [ ] **Step 2: 注册路由**

在 `apps/miniapp/src/pages.json` 的 pagesElder subPackages.pages 数组里添加：
```json
{ "path": "bind/index", "style": { "navigationBarTitleText": "账号绑定" } }
```

- [ ] **Step 3: 构建验证**

Run: `cd apps/miniapp && npx uni build -p mp-weixin`
微信开发者工具：手动在 storage 清空 elders/currentElderId（或用一个未绑定账号登录）→ 进入应跳到 bind 页

- [ ] **Step 4: Commit**

```bash
git add apps/miniapp/src/pagesElder/bind/index.vue apps/miniapp/src/pages.json
git commit -m "feat(miniapp): add bind page for unlinked family users"
```

---

### Task 15: 老人切换入口（check-in/sos 顶部）

**Files:**
- Modify: `apps/miniapp/src/pagesElder/check-in/index.vue`
- Modify: `apps/miniapp/src/pagesElder/sos/index.vue`

- [ ] **Step 1: 在 check-in 页顶部加切换条**

在 `check-in/index.vue` 的 AppNavbar 之后、checkin 内容之前添加：

```vue
<!-- 老人切换条（仅多老人时可点击） -->
<view
  v-if="auth.elders.length > 1"
  class="elder-switch"
  @click="showElderPicker = true"
>
  <text class="elder-switch__name">{{ auth.currentElder?.name || '未选择' }}</text>
  <text class="elder-switch__arrow">切换 ▾</text>
</view>
<view v-else-if="auth.currentElder" class="elder-switch elder-switch--single">
  <text class="elder-switch__name">{{ auth.currentElder.name }}</text>
</view>

<wd-action-sheet
  :modelValue="showElderPicker"
  :actions="elderActions"
  @action="onElderSelect"
  @close="showElderPicker = false"
/>
```

script 加：
```typescript
import { watch } from 'vue';
const showElderPicker = ref(false);
const elderActions = computed(() =>
  auth.elders.map((e) => ({ name: e.name, value: e.id, color: e.id === auth.currentElderId ? '#7A8B6E' : '#2C2B29' }))
);
function onElderSelect({ item }: { item: { value: string } }) {
  auth.setCurrentElder(item.value);
  showElderPicker.value = false;
}
```

style 加（BEM 风格，沿用 token 色值）：
```css
.elder-switch {
  margin: 16rpx 20rpx 0;
  background-color: #FEFDFB;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1rpx 0 #E8E3DA;
}
.elder-switch--single { justify-content: center; }
.elder-switch__name { font-size: 28rpx; font-weight: 500; color: #2C2B29; }
.elder-switch__arrow { font-size: 24rpx; color: #6B6760; }
```

> sos 页同理添加（单老人时也显示名字，让家属确认在为哪位老人求助）。

- [ ] **Step 2: 构建验证**

Run: `cd apps/miniapp && npx uni build -p mp-weixin`
微信开发者工具：若 seed 了多个老人关联同一家属，顶部应出现切换条，点击可切换，切换后 check-in/order-progress 数据跟随变化。

- [ ] **Step 3: Commit**

```bash
git add apps/miniapp/src/pagesElder/check-in/index.vue apps/miniapp/src/pagesElder/sos/index.vue
git commit -m "feat(miniapp): add elder switcher bar in elder pages"
```

---

## 阶段 D：worker 端回归复核

### Task 16: worker 端回归验证（不改实现）

**Files:** 无修改（纯验证任务）

- [ ] **Step 1: 完整构建**

Run: `cd apps/miniapp && npx uni build -p mp-weixin`
Expected: 构建无错误

- [ ] **Step 2: 全量单测**

Run: `cd apps/miniapp && npx vitest run`
Expected: 所有测试通过（含新写的 + 现有的 useCheckIn/useVisitForm/useWorkOrderFlow/useOrderProgress/useRiskTaskList）

- [ ] **Step 3: 后端全量单测**

Run: `cd apps/api && pnpm jest --no-coverage`
Expected: 所有测试通过（含 Task 1/2/4 新增的 + 现有的）

- [ ] **Step 4: 微信开发者工具 worker 端回归**

用 GRID_WORKER/ADMIN 账号登录：
- risk-tasks 列表 → 点复核 → 提交复核（确认 Task 2 改 work-orders 鉴权没影响 worker）
- work-order list → detail → 接单/完成流程
- visit-form 填报 → 提交
Expected: 三个流程均正常，未被老人端重构带坏

- [ ] **Step 5: 若发现回归问题，记录并修复**

若 worker 端有回归问题（尤其 Task 2 改 findAll 对 worker 分支的副作用），按 systematic-debugging 流程定位修复。无问题则无需 commit。

---

## 最终验证

### Task 17: 三端主流程完整跑通

**Files:** 无修改（最终验收）

- [ ] **Step 1: 确认后端 + MinIO 启动**

Run: 后端 `pnpm dev`（localhost:3000）+ MinIO（docker，:9000）+ 数据库已 seed（Task 5）

- [ ] **Step 2: 老人端主流程（FAMILY）**

微信开发者工具导入 dist/build/mp-weixin，登录 FAMILY 账号：
- ✅ 启动 → 自动进 check-in（有缓存会话）
- ✅ 一键报平安 → "已报平安"
- ✅ 文字报平安 → 成功
- ✅ 长按语音报平安 → "发送中" → 成功（Network 见 POST /uploads/audio）
- ✅ 进 sos → 长按求助 → 成功
- ✅ 进 order-progress → 看到该老人工单
- ✅ 未绑定账号 → 进 bind 引导页

- [ ] **Step 3: 工人端主流程（WORKER/ADMIN）**

- ✅ 登录 → 进 risk-tasks → 复核
- ✅ work-order list/detail → 接单/完成
- ✅ visit-form 填报

- [ ] **Step 4: 提交最终状态**

若所有验收点通过，无需额外 commit。如有遗漏的修复，补提交后在这里打勾。

---

## 风险与备注

1. **模拟器录音风险**：微信开发者工具模拟器对 `getRecorderManager` 支持可能不完整（真机更可靠）。Task 9/10/11 若模拟器无法真实录音，标注"需真机验证"，不阻塞一键/文字报平安主流程。
2. **MinIO 未启动**：Task 4/10/11 的上传验证依赖 MinIO。若 MinIO 未配，后端 saveAudioFile 会报连接错误，前端 catch 给"语音提交失败"。降级路径：文字报平安不依赖录音。
3. **API base IP**：`src/api/client.ts` 的 `DEFAULT_API_BASE` 硬编码 `192.168.31.158`。换电脑开发时需改此 IP，否则所有请求超时。这是已知约束，不在本次重构范围。
4. **sos 语义**：本次 sos 复用 check-in 接口（求助 = VOICE 报平安），无独立紧急优先级标记。这是 spec §11.3 记录的待确认项，后续如需紧急标记要另起后端改动。
