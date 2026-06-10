# Epic 2 数据采集 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 实现报平安、巡访记录、设备数据上报三大数据采集模块，含文件上传、HMAC 签名校验、老人为中心的数据聚合。

**Architecture:** 4 个独立 NestJS 模块（uploads/check-ins/visits/devices），沿用 Epic 0/1 的模块模式。UploadsModule 为基础设施模块（MinIO 预签名 URL），被 check-ins 和 visits 引用。Devices 使用 HMAC 签名校验（非 JWT 鉴权）。

**Tech Stack:** NestJS 11.x, Prisma 6.x, TypeScript 5.7.x, Jest 29.x, class-validator, @aws-sdk/client-s3, Node crypto (HMAC)

**依赖:** Epic 0（脚手架）✅ + Epic 1（鉴权/用户/档案）✅

---

## 文件结构

```
apps/api/src/modules/
├── uploads/                       # ✨ 新增
│   ├── uploads.module.ts
│   ├── uploads.service.ts
│   ├── uploads.service.spec.ts
│   ├── uploads.controller.ts
│   └── dto/
│       └── presigned-url.dto.ts
├── check-ins/                     # ✨ 新增
│   ├── check-ins.module.ts
│   ├── check-ins.service.ts
│   ├── check-ins.service.spec.ts
│   ├── check-ins.controller.ts
│   └── dto/
│       ├── create-check-in.dto.ts
│       └── query-check-in.dto.ts
├── visits/                        # ✨ 新增
│   ├── visits.module.ts
│   ├── visits.service.ts
│   ├── visits.service.spec.ts
│   ├── visits.controller.ts
│   └── dto/
│       ├── create-visit.dto.ts
│       └── query-visit.dto.ts
├── devices/                       # ✨ 新增
│   ├── devices.module.ts
│   ├── devices.service.ts
│   ├── devices.service.spec.ts
│   ├── devices.controller.ts
│   ├── hmac/
│   │   ├── hmac.service.ts
│   │   ├── hmac.service.spec.ts
│   │   └── hmac.guard.ts
│   └── dto/
│       ├── device-data.dto.ts
│       └── query-device.dto.ts
├── elders/                        # 🔧 扩建 risk-profile
│   └── elders.service.ts         # getRiskProfile 扩建

apps/api/test/
├── check-ins.e2e-spec.ts         # ✨ 新增
├── visits.e2e-spec.ts            # ✨ 新增
└── devices.e2e-spec.ts           # ✨ 新增

apps/api/
├── package.json                  # 🔧 新增 @aws-sdk 依赖
└── .env.example                  # 🔧 新增 S3 / HMAC 环境变量
```

---

## Phase 1: UploadsModule（MinIO 预签名 URL）

### Task 1.1: 创建 UploadsModule 目录结构与 DTO

**Files:**
- Create: `apps/api/src/modules/uploads/dto/presigned-url.dto.ts`
- Create: `apps/api/src/modules/uploads/uploads.module.ts`

- [ ] **Step 1: 创建 DTO**

```typescript
// apps/api/src/modules/uploads/dto/presigned-url.dto.ts
import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlDto {
  @ApiProperty({ description: '文件名（含扩展名）', example: 'recording-001.mp3' })
  @IsString()
  fileName!: string;

  @ApiProperty({
    description: '文件 MIME 类型',
    example: 'audio/mp3',
    enum: ['audio/mp3', 'audio/wav', 'audio/m4a', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  })
  @IsString()
  contentType!: string;

  @ApiProperty({
    description: '存储目录',
    example: 'checkins',
    enum: ['checkins', 'visits'],
  })
  @IsString()
  @IsIn(['checkins', 'visits'])
  folder!: 'checkins' | 'visits';
}
```

- [ ] **Step 2: 创建模块文件**

```typescript
// apps/api/src/modules/uploads/uploads.module.ts
import { Module } from '@nestjs/common';
import { UploadsController } from './uploads.controller';
import { UploadsService } from './uploads.service';

@Module({
  controllers: [UploadsController],
  providers: [UploadsService],
  exports: [UploadsService],
})
export class UploadsModule {}
```

- [ ] **Step 3: 提交**

```bash
git add apps/api/src/modules/uploads/dto/presigned-url.dto.ts apps/api/src/modules/uploads/uploads.module.ts
git commit -m "chore: add UploadsModule scaffold with DTO"
```

---

### Task 1.2: 编写 UploadsService 测试 → 实现

**Files:**
- Create: `apps/api/src/modules/uploads/uploads.service.spec.ts`
- Create: `apps/api/src/modules/uploads/uploads.service.ts`

- [ ] **Step 1: 编写失败测试（Red）**

```typescript
// apps/api/src/modules/uploads/uploads.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';

describe('UploadsService', () => {
  let service: UploadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadsService],
    }).compile();
    service = module.get<UploadsService>(UploadsService);
  });

  describe('validateContentType', () => {
    it('should accept audio/mp3 for checkins folder', () => {
      expect(service.validateContentType('audio/mp3', ['audio/mp3', 'audio/wav', 'audio/m4a'])).toBe(true);
    });

    it('should accept audio/wav for checkins folder', () => {
      expect(service.validateContentType('audio/wav', ['audio/mp3', 'audio/wav', 'audio/m4a'])).toBe(true);
    });

    it('should accept audio/m4a for checkins folder', () => {
      expect(service.validateContentType('audio/m4a', ['audio/mp3', 'audio/wav', 'audio/m4a'])).toBe(true);
    });

    it('should reject video/mp4 for checkins folder', () => {
      expect(service.validateContentType('video/mp4', ['audio/mp3', 'audio/wav', 'audio/m4a'])).toBe(false);
    });

    it('should accept image/jpeg for visits folder', () => {
      expect(service.validateContentType('image/jpeg', ['image/jpeg', 'image/png', 'image/webp', 'image/heic'])).toBe(true);
    });

    it('should reject text/html for any folder', () => {
      expect(service.validateContentType('text/html', ['image/jpeg', 'image/png'])).toBe(false);
    });

    it('should reject empty content type', () => {
      expect(service.validateContentType('', ['audio/mp3'])).toBe(false);
    });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

```bash
cd apps/api && npx jest --testPathPattern="uploads.service.spec" --no-coverage
```
Expected: 7 tests FAIL (UploadsService not found)

- [ ] **Step 3: 编写最小实现（Green）**

```typescript
// apps/api/src/modules/uploads/uploads.service.ts
import { Injectable, BadRequestException } from '@nestjs/common';

export interface PresignedUrlResult {
  url: string;
  key: string;
  expiresIn: number;
}

const AUDIO_TYPES = ['audio/mp3', 'audio/wav', 'audio/m4a'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const FOLDER_ALLOWED_TYPES: Record<string, string[]> = {
  checkins: AUDIO_TYPES,
  visits: IMAGE_TYPES,
};

@Injectable()
export class UploadsService {
  validateContentType(contentType: string, allowed: string[]): boolean {
    if (!contentType) return false;
    return allowed.includes(contentType);
  }

  getAllowedTypesForFolder(folder: string): string[] {
    return FOLDER_ALLOWED_TYPES[folder] || [];
  }
}
```

- [ ] **Step 4: 运行测试确认 GREEN**

```bash
cd apps/api && npx jest --testPathPattern="uploads.service.spec" --no-coverage
```
Expected: 7 tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/modules/uploads/uploads.service.spec.ts apps/api/src/modules/uploads/uploads.service.ts
git commit -m "test: add UploadsService content type validation with tests"
```

---

### Task 1.3: 实现预签名 URL 生成 + 测试

**Files:**
- Modify: `apps/api/src/modules/uploads/uploads.service.ts`
- Modify: `apps/api/src/modules/uploads/uploads.service.spec.ts`
- Modify: `apps/api/package.json` — 新增依赖

- [ ] **Step 1: 安装 AWS SDK 依赖**

```bash
cd apps/api && pnpm add @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
```

- [ ] **Step 2: 新增预签名 URL 测试**

在 `uploads.service.spec.ts` 顶部追加 mock 和测试（在现有 describe 内末尾追加）：

```typescript
// 在现有 imports 后追加:
import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

// 在现有 describe block 内末尾追加:
describe('generatePresignedUrl', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules();
    process.env = {
      ...OLD_ENV,
      S3_ENDPOINT: 'http://localhost:9000',
      S3_ACCESS_KEY: 'minioadmin',
      S3_SECRET_KEY: 'minioadmin',
      S3_BUCKET: 'care',
    };
    (getSignedUrl as jest.Mock).mockResolvedValue('https://minio.example.com/care/checkins/uuid-file.mp3?signature=xxx');
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('should generate presigned URL for valid checkins audio', async () => {
    const result = await service.generatePresignedUrl('recording.mp3', 'audio/mp3', 'checkins');
    expect(result.url).toContain('https://');
    expect(result.key).toContain('checkins/');
    expect(result.expiresIn).toBe(900);
  });

  it('should reject unsupported content type for checkins folder', async () => {
    await expect(
      service.generatePresignedUrl('bad.exe', 'application/x-msdownload', 'checkins'),
    ).rejects.toThrow('不支持的文件类型');
  });

  it('should generate presigned URL for valid visits image', async () => {
    (getSignedUrl as jest.Mock).mockResolvedValue('https://minio.example.com/care/visits/uuid-photo.jpg?signature=yyy');
    const result = await service.generatePresignedUrl('photo.jpg', 'image/jpeg', 'visits');
    expect(result.key).toContain('visits/');
  });
});
```

- [ ] **Step 3: 运行测试确认 RED**

```bash
cd apps/api && npx jest --testPathPattern="uploads.service.spec" --no-coverage
```
Expected: 3 new tests FAIL (generatePresignedUrl not defined)

- [ ] **Step 4: 实现 generatePresignedUrl**

在 `uploads.service.ts` 的 UploadsService 类中追加：

```typescript
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// ... 已有代码 ...

@Injectable()
export class UploadsService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true,
    });
    this.bucket = process.env.S3_BUCKET || 'care';
  }

  // ... validateContentType, getAllowedTypesForFolder 保持不变 ...

  async generatePresignedUrl(
    fileName: string,
    contentType: string,
    folder: 'checkins' | 'visits',
  ): Promise<PresignedUrlResult> {
    const allowed = this.getAllowedTypesForFolder(folder);
    if (!this.validateContentType(contentType, allowed)) {
      throw new BadRequestException(
        `不支持的文件类型: ${contentType}。${folder} 目录允许: ${allowed.join(', ')}`,
      );
    }

    const ext = fileName.split('.').pop() || '';
    const uniqueFileName = `${uuidv4()}.${ext}`;
    const key = `${folder}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
    return { url, key, expiresIn: 900 };
  }
}
```

- [ ] **Step 5: 安装 uuid 依赖**

```bash
cd apps/api && pnpm add uuid && pnpm add -D @types/uuid
```

- [ ] **Step 6: 运行测试确认 GREEN**

```bash
cd apps/api && npx jest --testPathPattern="uploads.service.spec" --no-coverage
```
Expected: all 10 tests PASS

- [ ] **Step 7: 提交**

```bash
git add apps/api/src/modules/uploads/uploads.service.ts apps/api/src/modules/uploads/uploads.service.spec.ts apps/api/package.json apps/api/pnpm-lock.yaml ../../pnpm-lock.yaml
git commit -m "feat: add presigned URL generation for MinIO uploads"
```

---

### Task 1.4: 创建 UploadsController

**Files:**
- Create: `apps/api/src/modules/uploads/uploads.controller.ts`

- [ ] **Step 1: 创建 Controller**

```typescript
// apps/api/src/modules/uploads/uploads.controller.ts
import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('presigned-url')
  @ApiOperation({ summary: '获取 MinIO 预签名上传 URL' })
  async getPresignedUrl(@Query() dto: PresignedUrlDto) {
    return this.uploadsService.generatePresignedUrl(
      dto.fileName,
      dto.contentType,
      dto.folder,
    );
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/api/src/modules/uploads/uploads.controller.ts
git commit -m "feat: add UploadsController for presigned URL endpoint"
```

---

## Phase 2: CheckInsModule（报平安）

### Task 2.1: 创建 CheckInsModule 脚手架与 DTO

**Files:**
- Create: `apps/api/src/modules/check-ins/dto/create-check-in.dto.ts`
- Create: `apps/api/src/modules/check-ins/dto/query-check-in.dto.ts`
- Create: `apps/api/src/modules/check-ins/check-ins.module.ts`

- [ ] **Step 1: 创建 DTO 文件**

```typescript
// apps/api/src/modules/check-ins/dto/create-check-in.dto.ts
import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CheckInMethod } from '@prisma/client';

export class CreateCheckInDto {
  @ApiProperty({ description: '关联老人 ID' })
  @IsString()
  elderId!: string;

  @ApiProperty({ description: '报到方式', enum: CheckInMethod })
  @IsEnum(CheckInMethod)
  method!: CheckInMethod;

  @ApiProperty({ description: '文本内容（TEXT/VOICE/PROXY 模式需要）', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: '语音文件 URL（VOICE 模式需要）', required: false })
  @IsOptional()
  @IsString()
  voiceUrl?: string;
}
```

```typescript
// apps/api/src/modules/check-ins/dto/query-check-in.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryCheckInDto {
  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '每页条数', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

- [ ] **Step 2: 创建模块文件**

```typescript
// apps/api/src/modules/check-ins/check-ins.module.ts
import { Module } from '@nestjs/common';
import { CheckInsController } from './check-ins.controller';
import { CheckInsService } from './check-ins.service';

@Module({
  controllers: [CheckInsController],
  providers: [CheckInsService],
  exports: [CheckInsService],
})
export class CheckInsModule {}
```

- [ ] **Step 3: 提交**

```bash
git add apps/api/src/modules/check-ins/
git commit -m "chore: add CheckInsModule scaffold with DTOs"
```

---

### Task 2.2: 编写 CheckInsService 测试 → 实现（核心校验逻辑）

**Files:**
- Create: `apps/api/src/modules/check-ins/check-ins.service.spec.ts`
- Create: `apps/api/src/modules/check-ins/check-ins.service.ts`

- [ ] **Step 1: 编写失败测试（Red）**

```typescript
// apps/api/src/modules/check-ins/check-ins.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { CheckInsService } from './check-ins.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, CheckInMethod } from '@prisma/client';

describe('CheckInsService', () => {
  let service: CheckInsService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const familyUser = { sub: 'family-1', role: Role.FAMILY, district: undefined };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const otherWorker = { sub: 'worker-2', role: Role.GRID_WORKER, district: '海淀区' };

  const mockElder = {
    id: 'elder-1',
    name: '张大爷',
    district: '朝阳区',
    familyLinks: [{ userId: 'family-1', elderId: 'elder-1', relation: '子女' }],
  };

  const mockPrisma = {
    elder: {
      findUnique: jest.fn(),
    },
    checkIn: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<CheckInsService>(CheckInsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create ONE_TAP check-in for linked family member', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-1', elderId: 'elder-1', method: 'ONE_TAP',
        content: null, voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.ONE_TAP },
        familyUser,
      );
      expect(result.method).toBe('ONE_TAP');
      expect(result.status).toBe('NORMAL');
    });

    it('should create VOICE check-in with voiceUrl', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-2', elderId: 'elder-1', method: 'VOICE',
        content: null, voiceUrl: 'https://s3/care/checkins/abc.wav', status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.VOICE, voiceUrl: 'https://s3/care/checkins/abc.wav' },
        familyUser,
      );
      expect(result.voiceUrl).toBe('https://s3/care/checkins/abc.wav');
    });

    it('should create TEXT check-in with content', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-3', elderId: 'elder-1', method: 'TEXT',
        content: '今天一切正常', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '今天一切正常' },
        familyUser,
      );
      expect(result.content).toBe('今天一切正常');
    });

    it('should allow GRID_WORKER in same district to create PROXY check-in', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-4', elderId: 'elder-1', method: 'PROXY',
        content: '网格员代报', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.PROXY, content: '网格员代报' },
        worker,
      );
      expect(result.method).toBe('PROXY');
    });

    it('should reject FAMILY user without ElderFamilyLink binding', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        ...mockElder,
        familyLinks: [],
      });
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.ONE_TAP }, familyUser),
      ).rejects.toThrow('无权限');
    });

    it('should reject cross-district GRID_WORKER', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.ONE_TAP }, otherWorker),
      ).rejects.toThrow('无权限');
    });

    it('should throw 404 when elder not found', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ elderId: 'nonexistent', method: CheckInMethod.ONE_TAP }, admin),
      ).rejects.toThrow('老人不存在');
    });

    it('should reject VOICE without voiceUrl', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.VOICE }, familyUser),
      ).rejects.toThrow('语音文件 URL');
    });

    it('should reject TEXT without content', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.TEXT }, familyUser),
      ).rejects.toThrow('文本内容');
    });

    it('should reject PROXY without content from GRID_WORKER', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.PROXY }, worker),
      ).rejects.toThrow('备注说明');
    });
  });

  describe('findByElder', () => {
    it('should return paginated check-ins for authorized user', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.findMany.mockResolvedValue([
        { id: 'ci-1', elderId: 'elder-1', method: 'ONE_TAP', content: null, voiceUrl: null, status: 'NORMAL', createdAt: new Date() },
      ]);
      mockPrisma.checkIn.count.mockResolvedValue(1);

      const result = await service.findByElder('elder-1', { page: 1, limit: 20 }, worker);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should reject cross-district access', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.findByElder('elder-1', { page: 1, limit: 20 }, otherWorker),
      ).rejects.toThrow('无权限');
    });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

```bash
cd apps/api && npx jest --testPathPattern="check-ins.service.spec" --no-coverage
```
Expected: 12 tests FAIL (CheckInsService not found)

- [ ] **Step 3: 编写最小实现（Green）**

```typescript
// apps/api/src/modules/check-ins/check-ins.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, CheckInMethod } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class CheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { elderId: string; method: CheckInMethod; content?: string; voiceUrl?: string }, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: dto.elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    this.authorizeAccess(elder, requester);

    // 条件必填校验
    if (dto.method === CheckInMethod.VOICE && !dto.voiceUrl) {
      throw new BadRequestException('VOICE 模式必须提供语音文件 URL');
    }
    if (dto.method === CheckInMethod.TEXT && !dto.content) {
      throw new BadRequestException('TEXT 模式必须提供文本内容');
    }
    if (dto.method === CheckInMethod.PROXY && !dto.content) {
      throw new BadRequestException('PROXY 模式必须提供备注说明');
    }

    // VOICE 模式校验 voiceUrl MIME 类型（白名单）
    if (dto.voiceUrl) {
      this.validateVoiceUrl(dto.voiceUrl);
    }

    return this.prisma.checkIn.create({
      data: {
        elderId: dto.elderId,
        method: dto.method,
        content: dto.content || null,
        voiceUrl: dto.voiceUrl || null,
        status: 'NORMAL',
      },
    });
  }

  async findByElder(elderId: string, query: { page: number; limit: number }, requester: Requester) {
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

  private validateVoiceUrl(voiceUrl: string) {
    const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac'];
    const lower = voiceUrl.toLowerCase();
    const valid = allowedExtensions.some((ext) => lower.endsWith(ext));
    if (!valid) {
      throw new BadRequestException(`不支持的语音文件类型，允许: ${allowedExtensions.join(', ')}`);
    }
  }
}
```

- [ ] **Step 4: 运行测试确认 GREEN**

```bash
cd apps/api && npx jest --testPathPattern="check-ins.service.spec" --no-coverage
```
Expected: 12 tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/modules/check-ins/
git commit -m "feat: add CheckInsService with multi-method validation and district isolation"
```

---

### Task 2.3: 创建 CheckInsController

**Files:**
- Create: `apps/api/src/modules/check-ins/check-ins.controller.ts`

- [ ] **Step 1: 创建 Controller**

```typescript
// apps/api/src/modules/check-ins/check-ins.controller.ts
import { Controller, Get, Post, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { CheckInsService } from './check-ins.service';
import { CreateCheckInDto } from './dto/create-check-in.dto';
import { QueryCheckInDto } from './dto/query-check-in.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('CheckIns')
@ApiBearerAuth()
@Controller()
export class CheckInsController {
  constructor(private readonly checkInsService: CheckInsService) {}

  @Post('check-ins')
  @Roles(Role.FAMILY, Role.GRID_WORKER, Role.ADMIN)
  @ApiOperation({ summary: '提交报平安（一键/语音/文本/代填）' })
  create(@Body() dto: CreateCheckInDto, @CurrentUser() user: any) {
    return this.checkInsService.create(dto, user);
  }

  @Get('elders/:id/check-ins')
  @ApiOperation({ summary: '查询老人报平安记录' })
  findByElder(
    @Param('id') elderId: string,
    @Query() query: QueryCheckInDto,
    @CurrentUser() user: any,
  ) {
    return this.checkInsService.findByElder(elderId, query, user);
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/api/src/modules/check-ins/check-ins.controller.ts
git commit -m "feat: add CheckInsController with create and findByElder endpoints"
```

---

## Phase 3: VisitsModule（巡访记录）

### Task 3.1: 创建 VisitsModule 脚手架与 DTO

**Files:**
- Create: `apps/api/src/modules/visits/dto/create-visit.dto.ts`
- Create: `apps/api/src/modules/visits/dto/query-visit.dto.ts`
- Create: `apps/api/src/modules/visits/visits.module.ts`

- [ ] **Step 1: 创建 DTO**

```typescript
// apps/api/src/modules/visits/dto/create-visit.dto.ts
import { IsString, IsOptional, IsArray, IsNumber, Min, Max, MaxLength, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVisitDto {
  @ApiProperty({ description: '关联老人 ID' })
  @IsString()
  elderId!: string;

  @ApiProperty({ description: '观察记录', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  observation!: string;

  @ApiProperty({ description: '照片 URL 数组', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(9)
  photos?: string[];

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: '经度（中国范围: 73-135）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(73)
  @Max(135)
  longitude?: number;

  @ApiProperty({ description: '纬度（中国范围: 18-54）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(18)
  @Max(54)
  latitude?: number;

  @ApiProperty({ description: '巡访时间，默认当前时间', required: false })
  @IsOptional()
  @IsString()
  visitTime?: string;
}
```

```typescript
// apps/api/src/modules/visits/dto/query-visit.dto.ts
import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryVisitDto {
  @ApiProperty({ description: '按老人 ID 筛选', required: false })
  @IsOptional()
  @IsString()
  elderId?: string;

  @ApiProperty({ description: '起始日期 (ISO)', required: false })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ description: '结束日期 (ISO)', required: false })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '每页条数', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

- [ ] **Step 2: 创建模块文件**

```typescript
// apps/api/src/modules/visits/visits.module.ts
import { Module } from '@nestjs/common';
import { VisitsController } from './visits.controller';
import { VisitsService } from './visits.service';

@Module({
  controllers: [VisitsController],
  providers: [VisitsService],
  exports: [VisitsService],
})
export class VisitsModule {}
```

- [ ] **Step 3: 提交**

```bash
git add apps/api/src/modules/visits/
git commit -m "chore: add VisitsModule scaffold with DTOs"
```

---

### Task 3.2: 编写 VisitsService 测试 → 实现

**Files:**
- Create: `apps/api/src/modules/visits/visits.service.spec.ts`
- Create: `apps/api/src/modules/visits/visits.service.ts`

- [ ] **Step 1: 编写失败测试（Red）**

```typescript
// apps/api/src/modules/visits/visits.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { VisitsService } from './visits.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('VisitsService', () => {
  let service: VisitsService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const otherWorker = { sub: 'worker-2', role: Role.GRID_WORKER, district: '海淀区' };
  const familyUser = { sub: 'family-1', role: Role.FAMILY, district: undefined };

  const mockElder = {
    id: 'elder-1', name: '张大爷', district: '朝阳区', familyLinks: [],
  };

  const mockPrisma = {
    elder: { findUnique: jest.fn() },
    visitRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<VisitsService>(VisitsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const validDto = {
      elderId: 'elder-1',
      observation: '老人精神状态良好，家中水电正常',
      photos: ['https://minio/care/visits/photo1.jpg'],
      longitude: 116.4,
      latitude: 39.9,
    };

    it('should create visit for GRID_WORKER in same district', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.visitRecord.create.mockResolvedValue({
        id: 'v-1', elderId: 'elder-1', gridWorkerId: 'worker-1',
        observation: validDto.observation, photos: validDto.photos,
        note: null, visitTime: new Date(),
      });

      const result = await service.create(validDto, worker);
      expect(result.observation).toBe(validDto.observation);
      expect(result.photos).toEqual(validDto.photos);
    });

    it('should save visit with empty photos array', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.visitRecord.create.mockResolvedValue({
        id: 'v-2', elderId: 'elder-1', gridWorkerId: 'worker-1',
        observation: '例行巡访', photos: [], note: null, visitTime: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', observation: '例行巡访' },
        worker,
      );
      expect(result.photos).toEqual([]);
    });

    it('should reject non GRID_WORKER (FAMILY)', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create(validDto, familyUser),
      ).rejects.toThrow('仅网格员');
    });

    it('should reject non GRID_WORKER (ADMIN)', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create(validDto, admin),
      ).rejects.toThrow('仅网格员');
    });

    it('should reject cross-district GRID_WORKER', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create(validDto, otherWorker),
      ).rejects.toThrow('无权限');
    });

    it('should reject empty observation', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ ...validDto, observation: '' }, worker),
      ).rejects.toThrow('观察记录');
    });

    it('should throw NotFoundException when elder not found', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(
        service.create(validDto, worker),
      ).rejects.toThrow('老人不存在');
    });
  });

  describe('findAll', () => {
    it('should filter by elderId for authorized user', async () => {
      mockPrisma.visitRecord.findMany.mockResolvedValue([
        { id: 'v-1', elderId: 'elder-1', gridWorkerId: 'worker-1', observation: '一切正常', photos: [], note: null, visitTime: new Date() },
      ]);
      mockPrisma.visitRecord.count.mockResolvedValue(1);

      const result = await service.findAll({ elderId: 'elder-1', page: 1, limit: 20 }, worker);
      expect(result.items).toHaveLength(1);
    });

    it('should filter by date range', async () => {
      mockPrisma.visitRecord.findMany.mockResolvedValue([]);
      mockPrisma.visitRecord.count.mockResolvedValue(0);

      await service.findAll(
        { from: '2026-01-01', to: '2026-01-31', page: 1, limit: 20 },
        admin,
      );
      expect(mockPrisma.visitRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visitTime: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should restrict non-ADMIN to own district', async () => {
      mockPrisma.visitRecord.findMany.mockResolvedValue([]);
      mockPrisma.visitRecord.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 }, worker);
      // Non-ADMIN should have district clause in query
      expect(mockPrisma.visitRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            elder: { district: '朝阳区' },
          }),
        }),
      );
    });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

```bash
cd apps/api && npx jest --testPathPattern="visits.service.spec" --no-coverage
```
Expected: 10 tests FAIL

- [ ] **Step 3: 编写实现（Green）**

```typescript
// apps/api/src/modules/visits/visits.service.ts
import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: {
    elderId: string;
    observation: string;
    photos?: string[];
    note?: string;
    longitude?: number;
    latitude?: number;
    visitTime?: string;
  }, requester: Requester) {
    // Only GRID_WORKER can create visits
    if (requester.role !== Role.GRID_WORKER) {
      throw new ForbiddenException('仅网格员可提交巡访记录');
    }

    const elder = await this.prisma.elder.findUnique({
      where: { id: dto.elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    // District isolation
    if (requester.district && elder.district !== requester.district) {
      throw new ForbiddenException('无权限操作其他片区的老人');
    }

    if (!dto.observation || dto.observation.trim().length === 0) {
      throw new BadRequestException('观察记录不能为空');
    }

    return this.prisma.visitRecord.create({
      data: {
        elderId: dto.elderId,
        gridWorkerId: requester.sub,
        observation: dto.observation,
        photos: dto.photos || [],
        note: dto.note || null,
        visitTime: dto.visitTime ? new Date(dto.visitTime) : new Date(),
      },
    });
  }

  async findAll(query: {
    elderId?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  }, requester: Requester) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.elderId) {
      where.elderId = query.elderId;
    }

    if (query.from || query.to) {
      where.visitTime = {};
      if (query.from) where.visitTime.gte = new Date(query.from);
      if (query.to) where.visitTime.lte = new Date(query.to);
    }

    // District isolation: non-ADMIN only see records in their district
    if (requester.role !== Role.ADMIN && requester.district) {
      where.elder = { district: requester.district };
    }

    const [items, total] = await Promise.all([
      this.prisma.visitRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitTime: 'desc' },
        include: {
          elder: { select: { id: true, name: true, district: true } },
        },
      }),
      this.prisma.visitRecord.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
```

- [ ] **Step 4: 运行测试确认 GREEN**

```bash
cd apps/api && npx jest --testPathPattern="visits.service.spec" --no-coverage
```
Expected: 10 tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/modules/visits/
git commit -m "feat: add VisitsService with district isolation and validation"
```

---

### Task 3.3: 创建 VisitsController

**Files:**
- Create: `apps/api/src/modules/visits/visits.controller.ts`

- [ ] **Step 1: 创建 Controller**

```typescript
// apps/api/src/modules/visits/visits.controller.ts
import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { VisitsService } from './visits.service';
import { CreateVisitDto } from './dto/create-visit.dto';
import { QueryVisitDto } from './dto/query-visit.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Visits')
@ApiBearerAuth()
@Controller('visits')
export class VisitsController {
  constructor(private readonly visitsService: VisitsService) {}

  @Post()
  @Roles(Role.GRID_WORKER)
  @ApiOperation({ summary: '提交巡访记录（含定位、照片）' })
  create(@Body() dto: CreateVisitDto, @CurrentUser() user: any) {
    return this.visitsService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: '查询巡访记录（按老人/时间范围筛选）' })
  findAll(@Query() query: QueryVisitDto, @CurrentUser() user: any) {
    return this.visitsService.findAll(query, user);
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/api/src/modules/visits/visits.controller.ts
git commit -m "feat: add VisitsController with create and findAll endpoints"
```

---

## Phase 4: DevicesModule（设备数据上报 + HMAC 校验）

### Task 4.1: 创建 HMAC 服务测试 → 实现

**Files:**
- Create: `apps/api/src/modules/devices/hmac/hmac.service.spec.ts`
- Create: `apps/api/src/modules/devices/hmac/hmac.service.ts`

- [ ] **Step 1: 编写 HMAC 测试（Red）**

```typescript
// apps/api/src/modules/devices/hmac/hmac.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { HmacService } from './hmac.service';

describe('HmacService', () => {
  let service: HmacService;

  const OLD_ENV = process.env;

  beforeAll(() => {
    process.env = { ...OLD_ENV, DEVICE_HMAC_SECRET: 'test-shared-secret' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HmacService],
    }).compile();
    service = module.get<HmacService>(HmacService);
  });

  describe('sign', () => {
    it('should produce deterministic signature for same inputs', () => {
      const payload = { deviceId: 'dev-1', elderId: 'elder-1', alarm: false };
      const timestamp = 1700000000000;
      const sig1 = service.sign(payload, timestamp);
      const sig2 = service.sign(payload, timestamp);
      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different payloads', () => {
      const sig1 = service.sign({ a: 1 }, 1700000000000);
      const sig2 = service.sign({ a: 2 }, 1700000000000);
      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different timestamps', () => {
      const sig1 = service.sign({ a: 1 }, 1700000000000);
      const sig2 = service.sign({ a: 1 }, 1700000000001);
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verify', () => {
    it('should verify a valid signature', () => {
      const payload = { deviceId: 'dev-1', elderId: 'elder-1', deviceType: 'FALL_DETECTOR', metricType: 'FALL', alarm: false };
      const timestamp = Date.now();
      const signature = service.sign(payload, timestamp);
      expect(service.verify('dev-1', payload, signature, timestamp)).toBe(true);
    });

    it('should reject tampered payload', () => {
      const payload = { alarm: false };
      const timestamp = Date.now();
      const signature = service.sign(payload, timestamp);
      const tamperedPayload = { alarm: true };
      expect(service.verify('dev-1', tamperedPayload, signature, timestamp)).toBe(false);
    });

    it('should reject expired timestamp (>5 minutes)', () => {
      const payload = { test: true };
      const expiredTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      const signature = service.sign(payload, expiredTimestamp);
      expect(service.verify('dev-1', payload, signature, expiredTimestamp)).toBe(false);
    });

    it('should reject future timestamp (>5 minutes)', () => {
      const payload = { test: true };
      const futureTimestamp = Date.now() + 6 * 60 * 1000; // 6 minutes in future
      const signature = service.sign(payload, futureTimestamp);
      expect(service.verify('dev-1', payload, signature, futureTimestamp)).toBe(false);
    });

    it('should accept timestamp exactly at boundary (+5 min)', () => {
      const payload = { test: true };
      const boundaryTimestamp = Date.now() + 5 * 60 * 1000;
      const signature = service.sign(payload, boundaryTimestamp);
      expect(service.verify('dev-1', payload, signature, boundaryTimestamp)).toBe(true);
    });

    it('should accept timestamp exactly at boundary (-5 min)', () => {
      const payload = { test: true };
      const boundaryTimestamp = Date.now() - 5 * 60 * 1000;
      const signature = service.sign(payload, boundaryTimestamp);
      expect(service.verify('dev-1', payload, signature, boundaryTimestamp)).toBe(true);
    });

    it('should normalize JSON key order for consistent signatures', () => {
      const payload1 = { b: 2, a: 1 };
      const payload2 = { a: 1, b: 2 };
      const timestamp = 1700000000000;
      const sig1 = service.sign(payload1, timestamp);
      const sig2 = service.sign(payload2, timestamp);
      expect(sig1).toBe(sig2);
    });

    it('should throw when DEVICE_HMAC_SECRET is not set', () => {
      const oldSecret = process.env.DEVICE_HMAC_SECRET;
      delete process.env.DEVICE_HMAC_SECRET;
      expect(() => new (HmacService as any)()).toThrow('DEVICE_HMAC_SECRET');
      process.env.DEVICE_HMAC_SECRET = oldSecret;
    });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

```bash
cd apps/api && npx jest --testPathPattern="hmac.service.spec" --no-coverage
```
Expected: 11 tests FAIL (HmacService not found)

- [ ] **Step 3: 编写 HMAC 实现（Green）**

```typescript
// apps/api/src/modules/devices/hmac/hmac.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class HmacService {
  private readonly secret: Buffer;

  constructor() {
    const secretStr = process.env.DEVICE_HMAC_SECRET;
    if (!secretStr) {
      throw new Error('DEVICE_HMAC_SECRET environment variable is required');
    }
    this.secret = Buffer.from(secretStr, 'utf-8');
  }

  /**
   * Generate HMAC-SHA256 signature for a payload + timestamp.
   * Payload keys are sorted for determinism.
   * deviceId is accepted but currently unused (reserved for per-device key extension).
   */
  sign(payload: Record<string, unknown>, timestamp: number): string {
    const normalized = this.normalizePayload(payload);
    const message = `${timestamp}.${normalized}`;
    return crypto.createHmac('sha256', this.secret).update(message).digest('hex');
  }

  /**
   * Verify HMAC signature with replay protection (±5 minutes window).
   */
  verify(deviceId: string, payload: Record<string, unknown>, signature: string, timestamp: number): boolean {
    // Replay protection: ±5 minutes
    const now = Date.now();
    const drift = Math.abs(now - timestamp);
    if (drift > 5 * 60 * 1000) {
      return false;
    }

    const expected = this.sign(payload, timestamp);
    return crypto.timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(signature, 'hex'));
  }

  private normalizePayload(payload: Record<string, unknown>): string {
    return JSON.stringify(payload, Object.keys(payload).sort());
  }
}
```

- [ ] **Step 4: 运行测试确认 GREEN**

```bash
cd apps/api && npx jest --testPathPattern="hmac.service.spec" --no-coverage
```
Expected: 11 tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/modules/devices/hmac/
git commit -m "feat: add HmacService with SHA-256 signing, verification, and replay protection"
```

---

### Task 4.2: 创建 HMAC Guard

**Files:**
- Create: `apps/api/src/modules/devices/hmac/hmac.guard.ts`
- Create: `apps/api/src/modules/devices/hmac/hmac.guard.spec.ts` (optional, covered by e2e)

- [ ] **Step 1: 创建 HMAC Guard**

```typescript
// apps/api/src/modules/devices/hmac/hmac.guard.ts
import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { HmacService } from './hmac.service';

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(private readonly hmacService: HmacService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-hmac-signature'] as string;
    const timestamp = request.headers['x-hmac-timestamp'] as string;

    if (!signature) {
      throw new UnauthorizedException('缺少 HMAC 签名 (X-HMAC-Signature)');
    }
    if (!timestamp) {
      throw new UnauthorizedException('缺少 HMAC 时间戳 (X-HMAC-Timestamp)');
    }

    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) {
      throw new UnauthorizedException('HMAC 时间戳格式无效');
    }

    const deviceId = (request.headers['x-device-id'] as string) || 'unknown';
    const payload = request.body;

    if (!this.hmacService.verify(deviceId, payload, signature, ts)) {
      throw new UnauthorizedException('HMAC 签名校验失败');
    }

    return true;
  }
}
```

- [ ] **Step 2: 提交**

```bash
git add apps/api/src/modules/devices/hmac/hmac.guard.ts
git commit -m "feat: add HmacGuard for device data endpoint authentication"
```

---

### Task 4.3: 创建 DevicesService 测试 → 实现

**Files:**
- Create: `apps/api/src/modules/devices/devices.service.spec.ts`
- Create: `apps/api/src/modules/devices/devices.service.ts`

- [ ] **Step 1: 编写测试（Red）**

```typescript
// apps/api/src/modules/devices/devices.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('DevicesService', () => {
  let service: DevicesService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const otherWorker = { sub: 'worker-2', role: Role.GRID_WORKER, district: '海淀区' };

  const mockPrisma = {
    elder: { findUnique: jest.fn() },
    deviceData: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<DevicesService>(DevicesService);
    jest.clearAllMocks();
  });

  describe('ingest', () => {
    const validDto = {
      deviceId: 'dev-fall-001',
      elderId: 'elder-1',
      deviceType: 'FALL_DETECTOR',
      metricType: 'FALL',
      value: 'fall_detected',
      alarm: true,
      timestamp: Date.now(),
    };

    it('should ingest device data with alarm', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ id: 'elder-1' });
      mockPrisma.deviceData.create.mockResolvedValue({
        id: 'dd-1', elderId: 'elder-1', deviceType: 'FALL_DETECTOR',
        metricType: 'FALL', value: 'fall_detected', alarm: true,
        status: null, timestamp: new Date(),
      });

      const result = await service.ingest(validDto);
      expect(result.alarm).toBe(true);
      expect(result.metricType).toBe('FALL');
    });

    it('should ingest non-alarm device data', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ id: 'elder-1' });
      mockPrisma.deviceData.create.mockResolvedValue({
        id: 'dd-2', elderId: 'elder-1', deviceType: 'BLOOD_PRESSURE',
        metricType: 'BLOOD_PRESSURE', value: '120/80', alarm: false,
        status: null, timestamp: new Date(),
      });

      const result = await service.ingest({
        ...validDto, deviceType: 'BLOOD_PRESSURE', metricType: 'BLOOD_PRESSURE',
        value: '120/80', alarm: false,
      });
      expect(result.alarm).toBe(false);
    });

    it('should throw NotFoundException for non-existent elder', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(service.ingest(validDto)).rejects.toThrow('老人不存在');
    });
  });

  describe('findByElder', () => {
    it('should return paginated device data for same-district worker', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ id: 'elder-1', district: '朝阳区', familyLinks: [] });
      mockPrisma.deviceData.findMany.mockResolvedValue([]);
      mockPrisma.deviceData.count.mockResolvedValue(0);

      const result = await service.findByElder('elder-1', { page: 1, limit: 20 }, worker);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should reject cross-district access', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ id: 'elder-1', district: '朝阳区', familyLinks: [] });
      await expect(
        service.findByElder('elder-1', { page: 1, limit: 20 }, otherWorker),
      ).rejects.toThrow('无权限');
    });
  });
});
```

- [ ] **Step 2: 运行测试确认 RED**

```bash
cd apps/api && npx jest --testPathPattern="devices.service.spec" --no-coverage
```
Expected: 5 tests FAIL

- [ ] **Step 3: 编写实现（Green）**

```typescript
// apps/api/src/modules/devices/devices.service.ts
import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  async ingest(dto: {
    deviceId: string;
    elderId: string;
    deviceType: string;
    metricType: string;
    value?: string;
    alarm: boolean;
    timestamp: number;
  }) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: dto.elderId },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    // Note: alarm=true dispatch is reserved for Epic 5 (BullMQ injection point)
    return this.prisma.deviceData.create({
      data: {
        elderId: dto.elderId,
        deviceType: dto.deviceType,
        metricType: dto.metricType,
        value: dto.value || null,
        alarm: dto.alarm,
        timestamp: new Date(dto.timestamp),
      },
    });
  }

  async findByElder(elderId: string, query: { page: number; limit: number }, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    // District isolation
    if (requester.role !== Role.ADMIN) {
      if (requester.district && elder.district !== requester.district) {
        throw new ForbiddenException('无权限查看其他片区的设备数据');
      }
    }

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.deviceData.findMany({
        where: { elderId },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.deviceData.count({ where: { elderId } }),
    ]);

    return { items, total, page, limit };
  }
}
```

- [ ] **Step 4: 运行测试确认 GREEN**

```bash
cd apps/api && npx jest --testPathPattern="devices.service.spec" --no-coverage
```
Expected: 5 tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/modules/devices/devices.service.spec.ts apps/api/src/modules/devices/devices.service.ts
git commit -m "feat: add DevicesService with ingest and findByElder"
```

---

### Task 4.4: 创建 DevicesModule 与 Controller

**Files:**
- Create: `apps/api/src/modules/devices/dto/device-data.dto.ts`
- Create: `apps/api/src/modules/devices/dto/query-device.dto.ts`
- Create: `apps/api/src/modules/devices/devices.module.ts`
- Create: `apps/api/src/modules/devices/devices.controller.ts`

- [ ] **Step 1: 创建 DTO**

```typescript
// apps/api/src/modules/devices/dto/device-data.dto.ts
import { IsString, IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeviceDataDto {
  @ApiProperty({ description: '设备标识' })
  @IsString()
  deviceId!: string;

  @ApiProperty({ description: '关联老人 ID' })
  @IsString()
  elderId!: string;

  @ApiProperty({ description: '设备类型 (BLOOD_PRESSURE/HEART_RATE/FALL_DETECTOR/SMOKE/WATER)' })
  @IsString()
  deviceType!: string;

  @ApiProperty({ description: '指标类型' })
  @IsString()
  metricType!: string;

  @ApiProperty({ description: '读数/值', required: false })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiProperty({ description: '是否告警' })
  @IsBoolean()
  alarm!: boolean;

  @ApiProperty({ description: '设备端 Unix 毫秒时间戳' })
  @IsNumber()
  timestamp!: number;
}
```

```typescript
// apps/api/src/modules/devices/dto/query-device.dto.ts
import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryDeviceDto {
  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '每页条数', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;
}
```

- [ ] **Step 2: 创建 Module**

```typescript
// apps/api/src/modules/devices/devices.module.ts
import { Module } from '@nestjs/common';
import { DevicesController } from './devices.controller';
import { DevicesService } from './devices.service';
import { HmacService } from './hmac/hmac.service';

@Module({
  controllers: [DevicesController],
  providers: [DevicesService, HmacService],
  exports: [DevicesService],
})
export class DevicesModule {}
```

- [ ] **Step 3: 创建 Controller**

```typescript
// apps/api/src/modules/devices/devices.controller.ts
import { Controller, Get, Post, Param, Body, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { DevicesService } from './devices.service';
import { DeviceDataDto } from './dto/device-data.dto';
import { QueryDeviceDto } from './dto/query-device.dto';
import { HmacGuard } from './hmac/hmac.guard';
import { Public } from '../../../common/decorators/public.decorator';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Devices')
@Controller()
export class DevicesController {
  constructor(private readonly devicesService: DevicesService) {}

  @Post('devices/data')
  @Public()
  @UseGuards(HmacGuard)
  @ApiOperation({ summary: '设备/网关数据上报（HMAC 签名校验）' })
  ingest(@Body() dto: DeviceDataDto) {
    return this.devicesService.ingest(dto);
  }

  @Get('elders/:id/devices')
  @ApiBearerAuth()
  @ApiOperation({ summary: '查询老人设备数据' })
  findByElder(
    @Param('id') elderId: string,
    @Query() query: QueryDeviceDto,
    @CurrentUser() user: any,
  ) {
    return this.devicesService.findByElder(elderId, query, user);
  }
}
```

- [ ] **Step 4: 提交**

```bash
git add apps/api/src/modules/devices/
git commit -m "feat: add DevicesModule with HMAC-protected ingest and query endpoints"
```

---

## Phase 5: 注册模块 + 扩建老人画像 + E2E 测试

### Task 5.1: 在 AppModule 注册新模块

**Files:**
- Modify: `apps/api/src/app.module.ts`

- [ ] **Step 1: 修改 AppModule**

将 `apps/api/src/app.module.ts` 的 imports 从：

```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  PrismaModule,
  AuthModule,
  UsersModule,
  EldersModule,
  HealthModule,
],
```

改为（新增 4 行）：

```typescript
imports: [
  ConfigModule.forRoot({ isGlobal: true }),
  PrismaModule,
  AuthModule,
  UsersModule,
  EldersModule,
  HealthModule,
  UploadsModule,       // ✨
  CheckInsModule,      // ✨
  VisitsModule,        // ✨
  DevicesModule,       // ✨
],
```

同时追加 imports：

```typescript
import { UploadsModule } from './modules/uploads/uploads.module';
import { CheckInsModule } from './modules/check-ins/check-ins.module';
import { VisitsModule } from './modules/visits/visits.module';
import { DevicesModule } from './modules/devices/devices.module';
```

- [ ] **Step 2: 验证编译**

```bash
cd apps/api && pnpm build
```
Expected: build succeeded

- [ ] **Step 3: 运行所有单测**

```bash
cd apps/api && pnpm test --no-coverage
```
Expected: all tests PASS（包括已有的 auth/users/elders 和新模块）

- [ ] **Step 4: 提交**

```bash
git add apps/api/src/app.module.ts
git commit -m "feat: register Uploads, CheckIns, Visits, and Devices modules in AppModule"
```

---

### Task 5.2: 扩建 getRiskProfile 接口

**Files:**
- Modify: `apps/api/src/modules/elders/elders.service.ts` — `getRiskProfile` 方法
- Modify: `apps/api/src/modules/elders/elders.service.spec.ts` — 扩建测试

- [ ] **Step 1: 扩建测试**

在 `elders.service.spec.ts` 的 `describe('getRiskProfile')` 中追加：

```typescript
it('should include recent check-ins, visits and device alarms in profile', async () => {
  mockPrisma.elder.findUnique.mockResolvedValue({
    id: 'elder-1', name: '张大爷', serviceLevel: 'KEY',
    district: '朝阳区', familyLinks: [],
  });
  mockPrisma.checkIn.count.mockResolvedValue(25);
  mockPrisma.checkIn.findMany.mockResolvedValue([
    { id: 'ci-1', method: 'ONE_TAP', status: 'NORMAL', createdAt: new Date() },
  ]);
  mockPrisma.visitRecord.count.mockResolvedValue(8);
  mockPrisma.visitRecord.findMany.mockResolvedValue([
    { id: 'v-1', observation: '一切正常', visitTime: new Date() },
  ]);
  mockPrisma.deviceData.findMany.mockResolvedValue([
    { id: 'dd-1', deviceType: 'FALL_DETECTOR', metricType: 'FALL', alarm: true, timestamp: new Date() },
  ]);
  mockPrisma.riskEvent.findFirst.mockResolvedValue(null);
  mockPrisma.riskEvent.findMany.mockResolvedValue([]);
  mockPrisma.riskEvent.count.mockResolvedValue(0);
  mockPrisma.workOrder.count.mockResolvedValue(3);

  const result = await service.getRiskProfile('elder-1', admin);

  expect(result).toHaveProperty('recentCheckIns');
  expect(result.recentCheckIns).toHaveLength(1);
  expect(result).toHaveProperty('recentVisits');
  expect(result.recentVisits).toHaveLength(1);
  expect(result).toHaveProperty('recentDeviceAlarms');
  expect(result.recentDeviceAlarms).toHaveLength(1);
  expect(result).toHaveProperty('summary');
  expect(result.summary).toHaveProperty('checkInStreak');
  expect(result.summary).toHaveProperty('missedToday');
  expect(result.summary).toHaveProperty('activeAlarms');
});
```

- [ ] **Step 2: 运行测试确认 RED**

```bash
cd apps/api && npx jest --testPathPattern="elders.service.spec" --no-coverage
```
Expected: 新测试 FAIL

- [ ] **Step 3: 修改 getRiskProfile 实现**

将 `elders.service.ts` 中的 `getRiskProfile` 方法替换为（在原有代码基础上追加三个新查询和 summary 字段）：

```typescript
async getRiskProfile(elderId: string, requester: Requester) {
  const elder = await this.prisma.elder.findUnique({
    where: { id: elderId },
    include: { familyLinks: true },
  });
  if (!elder) throw new BadRequestException('老人不存在');
  this.authorizeAccess(elder, requester);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [
    totalCheckIns,
    missedCheckIns,
    abnormalCheckIns,
    totalVisits,
    activeRiskEvents,
    completedWorkOrders,
    latestRiskEvent,
    recentRiskEvents,
    // ✨ 新增
    recentCheckIns,
    recentVisits,
    recentDeviceAlarms,
    todayCheckIns,
  ] = await Promise.all([
    this.prisma.checkIn.count({
      where: { elderId, createdAt: { gte: thirtyDaysAgo } },
    }),
    this.prisma.checkIn.count({
      where: { elderId, status: 'MISSED', createdAt: { gte: thirtyDaysAgo } },
    }),
    this.prisma.checkIn.count({
      where: { elderId, status: 'ABNORMAL', createdAt: { gte: thirtyDaysAgo } },
    }),
    this.prisma.visitRecord.count({
      where: { elderId, visitTime: { gte: thirtyDaysAgo } },
    }),
    this.prisma.riskEvent.count({
      where: { elderId, status: { in: ['PENDING_REVIEW', 'CONFIRMED'] } },
    }),
    this.prisma.workOrder.count({
      where: { elderId, status: 'COMPLETED' },
    }),
    this.prisma.riskEvent.findFirst({
      where: { elderId },
      orderBy: { createdAt: 'desc' },
    }),
    this.prisma.riskEvent.findMany({
      where: { elderId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    }),
    // ✨ Recent 7-day check-ins
    this.prisma.checkIn.findMany({
      where: { elderId, createdAt: { gte: sevenDaysAgo } },
      orderBy: { createdAt: 'desc' },
      take: 30,
    }),
    // ✨ Recent 30-day visits
    this.prisma.visitRecord.findMany({
      where: { elderId, visitTime: { gte: thirtyDaysAgo } },
      orderBy: { visitTime: 'desc' },
      take: 20,
    }),
    // ✨ Recent device alarms
    this.prisma.deviceData.findMany({
      where: { elderId, alarm: true },
      orderBy: { timestamp: 'desc' },
      take: 20,
    }),
    // ✨ Today's check-ins
    this.prisma.checkIn.count({
      where: { elderId, createdAt: { gte: todayStart } },
    }),
  ]);

  // Calculate check-in streak
  let checkInStreak = 0;
  const sortedCheckIns = recentCheckIns
    .map((c) => c.createdAt)
    .sort((a, b) => b.getTime() - a.getTime());
  if (sortedCheckIns.length > 0) {
    let currentDate = new Date();
    currentDate.setHours(0, 0, 0, 0);
    for (const date of sortedCheckIns) {
      const checkDate = new Date(date);
      checkDate.setHours(0, 0, 0, 0);
      const diffDays = Math.floor((currentDate.getTime() - checkDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays <= checkInStreak + 1) {
        checkInStreak = diffDays === 0 ? 0 : diffDays <= 1 ? 1 : checkInStreak + 1;
      }
    }
    // Simplification: streak = consecutive days with check-ins
    const daySet = new Set<string>();
    for (const d of recentCheckIns) {
      const dateStr = new Date(d.createdAt).toISOString().split('T')[0];
      daySet.add(dateStr);
    }
    checkInStreak = 0;
    let checkDay = new Date();
    checkDay.setHours(0, 0, 0, 0);
    while (true) {
      const dayKey = checkDay.toISOString().split('T')[0];
      if (daySet.has(dayKey)) {
        checkInStreak++;
        checkDay.setDate(checkDay.getDate() - 1);
      } else if (checkDay.toISOString().split('T')[0] === new Date().toISOString().split('T')[0]) {
        // Today might not have check-in yet, skip
        checkDay.setDate(checkDay.getDate() - 1);
        continue;
      } else {
        break;
      }
    }
  }

  return {
    elderId: elder.id,
    elderName: elder.name,
    serviceLevel: elder.serviceLevel,
    stats: {
      totalCheckIns,
      missedCheckIns,
      abnormalCheckIns,
      totalVisits,
      activeRiskEvents,
      completedWorkOrders,
    },
    currentRisk: {
      latestRiskEvent,
      level: latestRiskEvent?.level ?? RiskLevel.LOW,
      activeAlerts: activeRiskEvents,
    },
    recentRiskEvents,
    // ✨ 新增
    recentCheckIns: recentCheckIns.slice(0, 7),
    recentVisits: recentVisits.slice(0, 5),
    recentDeviceAlarms,
    summary: {
      checkInStreak,
      missedToday: todayCheckIns === 0,
      activeAlarms: recentDeviceAlarms.length,
    },
    generatedAt: new Date().toISOString(),
  };
}
```

- [ ] **Step 4: 运行测试确认 GREEN**

```bash
cd apps/api && npx jest --testPathPattern="elders.service.spec" --no-coverage
```
Expected: all tests PASS

- [ ] **Step 5: 提交**

```bash
git add apps/api/src/modules/elders/elders.service.ts apps/api/src/modules/elders/elders.service.spec.ts
git commit -m "feat: expand risk-profile with recent data aggregation and summary stats"
```

---

### Task 5.3: 编写 CheckIns E2E 测试

**Files:**
- Create: `apps/api/test/check-ins.e2e-spec.ts`

- [ ] **Step 1: 创建 E2E 测试**

```typescript
// apps/api/test/check-ins.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Role } from '@prisma/client';

describe('CheckIns E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let elderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    prisma = app.get(PrismaService);

    // Seed admin & test data
    const bcrypt = require('bcryptjs');
    const cryptoService = (app as any).get('FieldEncryptionService');
    const passwordHash = await bcrypt.hash('admin123', 10);
    const phone = '13811111111';
    const phoneHash = cryptoService?.hashPhone
      ? cryptoService.hashPhone(phone)
      : phone;

    const admin = await prisma.user.upsert({
      where: { phoneHash },
      update: {},
      create: {
        phone: cryptoService?.encrypt ? cryptoService.encrypt(phone) : phone,
        phoneHash,
        name: 'E2E Admin',
        role: Role.ADMIN,
        passwordHash,
        district: '朝阳区',
      },
    });

    // Login
    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/admin-login')
      .send({ phone, password: 'admin123' });
    adminToken = res.body.data.token;

    // Create an elder for testing
    const elderRes = await request(app.getHttpServer())
      .post('/api/v1/elders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E测试老人', district: '朝阳区' });
    elderId = elderRes.body.data.id;
  });

  afterAll(async () => {
    if (elderId) {
      await prisma.checkIn.deleteMany({ where: { elderId } });
      await prisma.elder.delete({ where: { id: elderId } }).catch(() => {});
    }
    await app.close();
  });

  describe('POST /api/v1/check-ins', () => {
    it('should create ONE_TAP check-in', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, method: 'ONE_TAP' })
        .expect(201);
      expect(res.body.data.method).toBe('ONE_TAP');
    });

    it('should create TEXT check-in', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, method: 'TEXT', content: '今天一切正常' })
        .expect(201);
      expect(res.body.data.content).toBe('今天一切正常');
    });

    it('should reject TEXT without content', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, method: 'TEXT' })
        .expect(400);
    });

    it('should reject non-existent elder', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId: 'non-existent-id', method: 'ONE_TAP' })
        .expect(404);
    });
  });

  describe('GET /api/v1/elders/:id/check-ins', () => {
    it('should list check-ins for elder', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/elders/${elderId}/check-ins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });
  });
});
```

- [ ] **Step 2: 运行 E2E 确认**

```bash
cd apps/api && pnpm test:e2e -- --testPathPattern="check-ins.e2e-spec"
```
Expected: all E2E tests PASS

- [ ] **Step 3: 提交**

```bash
git add apps/api/test/check-ins.e2e-spec.ts
git commit -m "test: add CheckIns E2E tests"
```

---

### Task 5.4: 编写 Devices E2E 测试

**Files:**
- Create: `apps/api/test/devices.e2e-spec.ts`

- [ ] **Step 1: 创建 Devices E2E 测试**

```typescript
// apps/api/test/devices.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Role } from '@prisma/client';

describe('Devices E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let elderId: string;

  const HMAC_SECRET = process.env.DEVICE_HMAC_SECRET || 'test-shared-secret';

  function signPayload(payload: any): { signature: string; timestamp: string } {
    const timestamp = Date.now();
    const normalized = JSON.stringify(payload, Object.keys(payload).sort());
    const message = `${timestamp}.${normalized}`;
    const signature = crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
    return { signature, timestamp: String(timestamp) };
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    prisma = app.get(PrismaService);

    const bcrypt = require('bcryptjs');
    const passwordHash = await bcrypt.hash('admin123', 10);

    await prisma.user.upsert({
      where: { phoneHash: 'e2e-devices-admin-hash' },
      update: {},
      create: {
        phone: '13822222222',
        phoneHash: 'e2e-devices-admin-hash',
        name: 'E2E Devices Admin',
        role: Role.ADMIN,
        passwordHash,
        district: '朝阳区',
      },
    });

    const res = await request(app.getHttpServer())
      .post('/api/v1/auth/admin-login')
      .send({ phone: '13822222222', password: 'admin123' });
    adminToken = res.body.data.token;

    const elderRes = await request(app.getHttpServer())
      .post('/api/v1/elders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'E2E设备测试老人', district: '朝阳区' });
    elderId = elderRes.body.data.id;
  });

  afterAll(async () => {
    if (elderId) {
      await prisma.deviceData.deleteMany({ where: { elderId } });
      await prisma.elder.delete({ where: { id: elderId } }).catch(() => {});
    }
    await app.close();
  });

  describe('POST /api/v1/devices/data', () => {
    it('should accept valid HMAC-signed device data', async () => {
      const payload = {
        deviceId: 'dev-fall-001',
        elderId,
        deviceType: 'FALL_DETECTOR',
        metricType: 'FALL',
        value: 'fall_event',
        alarm: true,
        timestamp: Date.now(),
      };
      const { signature, timestamp } = signPayload(payload);

      const res = await request(app.getHttpServer())
        .post('/api/v1/devices/data')
        .set('X-HMAC-Signature', signature)
        .set('X-HMAC-Timestamp', timestamp)
        .set('X-Device-Id', 'dev-fall-001')
        .send(payload)
        .expect(201);

      expect(res.body.data.alarm).toBe(true);
    });

    it('should reject missing HMAC signature', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/devices/data')
        .send({ deviceId: 'dev-1', elderId, deviceType: 'SMOKE', metricType: 'SMOKE', alarm: false, timestamp: Date.now() })
        .expect(401);
    });

    it('should reject invalid HMAC signature', async () => {
      const payload = {
        deviceId: 'dev-fall-002',
        elderId,
        deviceType: 'FALL_DETECTOR',
        metricType: 'FALL',
        alarm: false,
        timestamp: Date.now(),
      };
      const { timestamp } = signPayload(payload);

      await request(app.getHttpServer())
        .post('/api/v1/devices/data')
        .set('X-HMAC-Signature', 'invalid-signature')
        .set('X-HMAC-Timestamp', timestamp)
        .send(payload)
        .expect(401);
    });
  });

  describe('GET /api/v1/elders/:id/devices', () => {
    it('should list devices for elder', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/elders/${elderId}/devices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });
  });
});
```

- [ ] **Step 2: 运行 E2E 确认**

```bash
cd apps/api && pnpm test:e2e -- --testPathPattern="devices.e2e-spec"
```
Expected: all E2E tests PASS

- [ ] **Step 3: 提交**

```bash
git add apps/api/test/devices.e2e-spec.ts
git commit -m "test: add Devices HMAC E2E tests"
```

---

## Phase 6: 配置与文档

### Task 6.1: 更新环境变量与 README

**Files:**
- Modify: `.env.example`
- Modify: `README.md`

- [ ] **Step 1: 更新 .env.example**

在 `.env.example` 末尾追加（在已有内容后）：

```bash
# S3 / 对象存储（MinIO/OSS）
S3_ENDPOINT=http://localhost:9000
S3_REGION=us-east-1
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=care

# 设备 HMAC 校验
DEVICE_HMAC_SECRET=shared-hmac-secret-for-devices
```

- [ ] **Step 2: 提交**

```bash
git add .env.example
git commit -m "chore: add S3 and HMAC environment variables to .env.example"
```

---

### Task 6.2: 最终验证与提交

- [ ] **Step 1: 运行全量测试**

```bash
cd apps/api && pnpm lint && pnpm test && pnpm test:e2e && pnpm build
```
Expected: all PASS

- [ ] **Step 2: 最终提交（如有遗漏）**

```bash
git status
git add -A
git commit -m "chore: Epic 2 complete — data collection modules with TDD"
```

---

## 测试统计

| 模块 | 单元测试 | E2E 测试 | 覆盖率目标 |
|------|---------|---------|-----------|
| Uploads | 10 | — | ≥ 80% |
| CheckIns | 12 | 5 | ≥ 90% |
| Visits | 10 | — | ≥ 80% |
| Devices + HMAC | 16 | 5 | HMAC ≥ 95% |
| Elders (扩建) | +1 | — | 保持 ≥ 80% |
| **合计** | **49+** | **10+** | **整体 ≥ 80%** |

## 依赖清单

| 依赖 | 版本 | 用途 |
|------|------|------|
| `@aws-sdk/client-s3` | ^3.x | MinIO S3 客户端 |
| `@aws-sdk/s3-request-presigner` | ^3.x | 预签名 URL 生成 |
| `uuid` | ^10.x | 唯一文件名 |
| `@types/uuid` | ^10.x | uuid 类型定义 |

---

## Definition of Done

- [ ] 4 个新模块 + 1 个扩建全部实现
- [ ] `pnpm lint` + `pnpm test` + `pnpm test:e2e` + `pnpm build` 全绿
- [ ] 覆盖率门禁达标（整体 ≥ 80%，HMAC ≥ 95%）
- [ ] Conventional Commits
- [ ] GitHub Issue #8 可关闭
