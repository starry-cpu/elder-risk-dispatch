# Epic 1：鉴权与用户/档案 — 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 Epic 0 脚手架之上实现社区多角色鉴权体系（微信 + 后台）、RBAC 权限控制、用户管理、老人档案管理（AES-256-GCM 字段加密）及风险画像聚合查询。

**Architecture:** 自底向上构建 — 加密服务 → JWT/守卫/装饰器 → Auth 模块 → Users 模块 → Elders 模块 → E2E 验证。每个模块严格 TDD：先写失败测试 → 最小实现使其通过 → 重构 → 提交。

**Tech Stack:** NestJS 11.x, Prisma 6.x, @nestjs/jwt 11.x, passport-jwt 4.x, bcryptjs 2.x, AES-256-GCM (Node crypto), class-validator 0.14.x

**10 Commits:**
1. `test: add failing tests for FieldEncryptionService` — RED
2. `feat: implement FieldEncryptionService with AES-256-GCM` — GREEN
3. `test: add failing tests for Auth module (guards, decorators, login)` — RED
4. `feat: implement JWT strategy, guards, decorators, wechat+admin login` — GREEN
5. `test: add failing tests for Users CRUD with RBAC` — RED
6. `feat: implement Users CRUD with role/district filtering` — GREEN
7. `test: add failing tests for Elders CRUD, encryption, risk-profile` — RED
8. `feat: implement Elders CRUD with field encryption and risk profile` — GREEN
9. `test: add auth E2E tests` — E2E
10. `chore: add auth deps and finalize app module` — 集成

---
## File Map

| File | Responsibility |
|------|---------------|
| `apps/api/package.json` | 新增 @nestjs/jwt, passport, bcryptjs 依赖 |
| `apps/api/src/common/crypto/field-encryption.service.ts` | AES-256-GCM 加密/解密 |
| `apps/api/src/common/crypto/field-encryption.service.spec.ts` | 加密服务单测 |
| `apps/api/src/common/guards/jwt-auth.guard.ts` | JWT 验证守卫 |
| `apps/api/src/common/guards/roles.guard.ts` | RBAC + 片区检查守卫 |
| `apps/api/src/common/decorators/roles.decorator.ts` | @Roles() 装饰器 |
| `apps/api/src/common/decorators/current-user.decorator.ts` | @CurrentUser() 装饰器 |
| `apps/api/src/common/decorators/public.decorator.ts` | @Public() 装饰器 |
| `apps/api/src/modules/auth/auth.module.ts` | Auth 模块定义 |
| `apps/api/src/modules/auth/auth.service.ts` | 登录逻辑 + 用户验证 |
| `apps/api/src/modules/auth/auth.controller.ts` | 登录/me 端点 |
| `apps/api/src/modules/auth/strategies/jwt.strategy.ts` | Passport JWT Strategy |
| `apps/api/src/modules/auth/dto/wechat-login.dto.ts` | 微信登录 DTO |
| `apps/api/src/modules/auth/dto/admin-login.dto.ts` | 后台登录 DTO |
| `apps/api/src/modules/auth/auth.service.spec.ts` | Auth 服务单测 |
| `apps/api/src/modules/auth/auth.controller.spec.ts` | Auth 控制器单测 |
| `apps/api/src/modules/users/users.module.ts` | Users 模块定义 |
| `apps/api/src/modules/users/users.service.ts` | Users CRUD + 加密 + RBAC |
| `apps/api/src/modules/users/users.controller.ts` | Users REST 端点 |
| `apps/api/src/modules/users/dto/create-user.dto.ts` | 创建用户 DTO |
| `apps/api/src/modules/users/dto/update-user.dto.ts` | 更新用户 DTO |
| `apps/api/src/modules/users/dto/user-response.dto.ts` | 用户响应 DTO |
| `apps/api/src/modules/users/users.service.spec.ts` | Users 服务单测 |
| `apps/api/src/modules/users/users.controller.spec.ts` | Users 控制器单测 |
| `apps/api/src/modules/elders/elders.module.ts` | Elders 模块定义 |
| `apps/api/src/modules/elders/elders.service.ts` | Elders CRUD + 加密 + 风险画像 |
| `apps/api/src/modules/elders/elders.controller.ts` | Elders REST 端点 |
| `apps/api/src/modules/elders/dto/create-elder.dto.ts` | 创建老人 DTO |
| `apps/api/src/modules/elders/dto/update-elder.dto.ts` | 更新老人 DTO |
| `apps/api/src/modules/elders/dto/create-contact.dto.ts` | 创建紧急联系人 DTO |
| `apps/api/src/modules/elders/dto/risk-profile.dto.ts` | 风险画像响应 DTO |
| `apps/api/src/modules/elders/elders.service.spec.ts` | Elders 服务单测 |
| `apps/api/src/modules/elders/elders.controller.spec.ts` | Elders 控制器单测 |
| `apps/api/src/app.module.ts` | 注册 ConfigModule + Auth/Users/Elders 模块 |
| `apps/api/test/auth.e2e-spec.ts` | Auth E2E（登录 → RBAC 越权拒绝） |

---
### Task 1: 安装鉴权依赖

- [ ] **Step 1: 安装依赖**

```bash
cd apps/api && pnpm add @nestjs/jwt @nestjs/passport passport passport-jwt bcryptjs
```

- [ ] **Step 2: 安装类型定义**

```bash
cd apps/api && pnpm add -D @types/passport-jwt @types/bcryptjs
```

- [ ] **Step 3: 验证安装**

```bash
cd apps/api && node -e "require('@nestjs/jwt'); require('passport-jwt'); require('bcryptjs'); console.log('OK')"
```

Expected: `OK`，无错误。

---

### Task 2: FieldEncryptionService — 编写 RED 测试

**Files created:** `apps/api/src/common/crypto/field-encryption.service.ts` (stub), `apps/api/src/common/crypto/field-encryption.service.spec.ts`

- [ ] **Step 1: 创建 stub**

```typescript
// apps/api/src/common/crypto/field-encryption.service.ts
export class FieldEncryptionService {
  encrypt(plaintext: string): string {
    throw new Error('Not implemented');
  }
  decrypt(ciphertext: string): string {
    throw new Error('Not implemented');
  }
}
```

- [ ] **Step 2: 编写 RED 测试**

```typescript
// apps/api/src/common/crypto/field-encryption.service.spec.ts
import { FieldEncryptionService } from './field-encryption.service';

describe('FieldEncryptionService', () => {
  let service: FieldEncryptionService;

  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = 'dGVzdC1rZXktMzItYnl0ZXMtbG9uZyEhIQ=='; // 32 bytes base64
    service = new FieldEncryptionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt plaintext and return a different string', () => {
    const plaintext = '110101199001011234';
    const encrypted = service.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');
  });

  it('should decrypt(encrypt(x)) to return x', () => {
    const plaintexts = [
      '110101199001011234',
      '北京市朝阳区某某街道100号',
      '13800138000',
      'Hello World',
      '包含中文和English的文本',
    ];
    for (const plaintext of plaintexts) {
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    }
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'sensitive data';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should throw when decrypting tampered ciphertext', () => {
    const plaintext = '13800138000';
    const encrypted = service.encrypt(plaintext);
    const tampered = encrypted.slice(0, -4) + 'ffff';
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('should throw when decrypting garbage data', () => {
    expect(() => service.decrypt('not-valid-hex:data')).toThrow();
  });

  it('should handle empty string', () => {
    const encrypted = service.encrypt('');
    expect(service.decrypt(encrypted)).toBe('');
  });

  it('should handle very long strings', () => {
    const longText = 'A'.repeat(10000);
    const encrypted = service.encrypt(longText);
    expect(service.decrypt(encrypted)).toBe(longText);
  });

  it('should throw if FIELD_ENCRYPTION_KEY is not set', () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => new FieldEncryptionService()).toThrow();
  });
});
```

- [ ] **Step 3: 运行测试 — 验证 RED**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts field-encryption.service.spec.ts
```

Expected: 9 tests, 8 FAIL（仅 "should be defined" 通过）。

---

### Task 3: FieldEncryptionService — GREEN 实现

**Files modified:** `apps/api/src/common/crypto/field-encryption.service.ts`

- [ ] **Step 1: 实现加密服务**

```typescript
// apps/api/src/common/crypto/field-encryption.service.ts
import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;
  private readonly algorithm = 'aes-256-gcm';

  constructor() {
    const keyBase64 = process.env.FIELD_ENCRYPTION_KEY;
    if (!keyBase64) {
      throw new Error('FIELD_ENCRYPTION_KEY environment variable is required');
    }
    const decoded = Buffer.from(keyBase64, 'base64');
    if (decoded.length !== 32) {
      throw new Error(`FIELD_ENCRYPTION_KEY must be 32 bytes, got ${decoded.length}`);
    }
    this.key = decoded;
  }

  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv(this.algorithm, this.key, iv);
    const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  }

  decrypt(ciphertext: string): string {
    const parts = ciphertext.split(':');
    if (parts.length !== 3) {
      throw new Error('Invalid ciphertext format: expected iv:authTag:ciphertext');
    }
    const iv = Buffer.from(parts[0], 'hex');
    const authTag = Buffer.from(parts[1], 'hex');
    const encrypted = Buffer.from(parts[2], 'hex');
    const decipher = crypto.createDecipheriv(this.algorithm, this.key, iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  }
}
```

- [ ] **Step 2: 运行测试 — 验证 GREEN**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts field-encryption.service.spec.ts
```

Expected: 9 tests, all PASS.

- [ ] **Step 3: 提交**

```bash
git add apps/api/src/common/crypto/
git commit -m "test: add failing tests for FieldEncryptionService"
git add apps/api/src/common/crypto/field-encryption.service.ts
git commit -m "feat: implement FieldEncryptionService with AES-256-GCM"
```

---

### Task 4: Auth 装饰器 — 编写 RED 测试

**Files created:** `apps/api/src/common/decorators/public.decorator.ts`, `apps/api/src/common/decorators/roles.decorator.ts`, `apps/api/src/common/decorators/current-user.decorator.ts`

- [ ] **Step 1: 创建装饰器 stub**

```typescript
// apps/api/src/common/decorators/public.decorator.ts
import { SetMetadata } from '@nestjs/common';
export const IS_PUBLIC_KEY = 'isPublic';
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
```

```typescript
// apps/api/src/common/decorators/roles.decorator.ts
import { SetMetadata } from '@nestjs/common';
import { Role } from '@prisma/client';
export const ROLES_KEY = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES_KEY, roles);
```

```typescript
// apps/api/src/common/decorators/current-user.decorator.ts
import { createParamDecorator, ExecutionContext } from '@nestjs/common';
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
```

- [ ] **Step 2: 创建 Auth 模块 stub 文件（为后续测试准备）**

```typescript
// apps/api/src/modules/auth/strategies/jwt.strategy.ts (stub)
import { Injectable } from '@nestjs/common';
@Injectable()
export class JwtStrategy {}
```

```typescript
// apps/api/src/common/guards/jwt-auth.guard.ts (stub)
import { Injectable } from '@nestjs/common';
@Injectable()
export class JwtAuthGuard {}
```

```typescript
// apps/api/src/common/guards/roles.guard.ts (stub)
import { Injectable } from '@nestjs/common';
@Injectable()
export class RolesGuard {}
```

- [ ] **Step 3: 编写 Auth Service 的 RED 测试**

```typescript
// apps/api/src/modules/auth/auth.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwt = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  describe('adminLogin', () => {
    it('should return token and user for valid credentials', async () => {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('password123', 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        name: '管理员',
        role: Role.ADMIN,
        passwordHash: hash,
        district: '朝阳区',
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });

      const result = await service.adminLogin({ phone: '13800138000', password: 'password123' });

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.role).toBe(Role.ADMIN);
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { phone: '13800138000' },
      });
    });

    it('should throw for invalid password', async () => {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('password123', 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        phone: '13800138000',
        name: '管理员',
        role: Role.ADMIN,
        passwordHash: hash,
      });

      await expect(
        service.adminLogin({ phone: '13800138000', password: 'wrongpassword' }),
      ).rejects.toThrow();
    });

    it('should throw when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.adminLogin({ phone: '13900000000', password: 'anything' }),
      ).rejects.toThrow();
    });

    it('should reject FAMILY role from admin login', async () => {
      const bcrypt = require('bcryptjs');
      const hash = await bcrypt.hash('password123', 10);

      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        phone: '13900139000',
        name: '家属',
        role: Role.FAMILY,
        passwordHash: hash,
      });

      await expect(
        service.adminLogin({ phone: '13900139000', password: 'password123' }),
      ).rejects.toThrow();
    });
  });

  describe('wechatLogin', () => {
    it('should return token for existing wechat user', async () => {
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'user-3',
        openid: 'openid-abc',
        name: '微信用户',
        role: Role.FAMILY,
        district: null,
        phone: null,
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });

      const result = await service.wechatLogin('openid-abc', undefined);

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.role).toBe(Role.FAMILY);
    });

    it('should create new user on first wechat login', async () => {
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'user-4',
        openid: 'openid-new',
        name: '新用户',
        role: Role.FAMILY,
        district: null,
        phone: null,
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });

      const result = await service.wechatLogin('openid-new', undefined);

      expect(mockPrisma.user.upsert).toHaveBeenCalled();
      expect(result.user.openid).toBe('openid-new');
    });
  });

  describe('validateUser', () => {
    it('should return user payload for valid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: '管理员',
        role: Role.ADMIN,
        district: '朝阳区',
        phone: null,
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });

      const result = await service.validateUser('user-1');
      expect(result).toHaveProperty('sub', 'user-1');
      expect(result).toHaveProperty('role', Role.ADMIN);
      expect(result).toHaveProperty('district', '朝阳区');
    });

    it('should throw when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);

      await expect(service.validateUser('non-existent')).rejects.toThrow();
    });
  });
});
```

- [ ] **Step 4: 编写 Auth Controller 的 RED 测试**

```typescript
// apps/api/src/modules/auth/auth.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    wechatLogin: jest.fn(),
    adminLogin: jest.fn(),
    validateUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  describe('POST /auth/wechat-login', () => {
    it('should return token and user', async () => {
      mockAuthService.wechatLogin.mockResolvedValue({
        token: 'jwt-token',
        user: { id: '1', name: 'Test', role: Role.FAMILY },
      });

      const result = await controller.wechatLogin({ code: 'test-code' });
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
    });
  });

  describe('POST /auth/admin-login', () => {
    it('should return token and user', async () => {
      mockAuthService.adminLogin.mockResolvedValue({
        token: 'jwt-token',
        user: { id: '2', name: 'Admin', role: Role.ADMIN },
      });

      const result = await controller.adminLogin({ phone: '13800138000', password: 'pass' });
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      const user = { sub: '1', role: Role.ADMIN, district: '朝阳区', loginType: 'admin' };
      const result = await controller.getMe(user);
      expect(result).toEqual(user);
    });
  });
});
```

- [ ] **Step 5: 运行测试 — 验证 RED**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts auth
```

Expected: tests FAIL（service stub 没有 adminLogin/wechatLogin/validateUser 方法）。

---

### Task 5: Auth — GREEN 实现（JWT Strategy + Service + Controller）

**Files created/modified:** `apps/api/src/modules/auth/strategies/jwt.strategy.ts`, `apps/api/src/modules/auth/auth.service.ts`, `apps/api/src/modules/auth/auth.controller.ts`, `apps/api/src/modules/auth/auth.module.ts`, `apps/api/src/modules/auth/dto/wechat-login.dto.ts`, `apps/api/src/modules/auth/dto/admin-login.dto.ts`

- [ ] **Step 1: 实现 DTO**

```typescript
// apps/api/src/modules/auth/dto/wechat-login.dto.ts
import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WechatLoginDto {
  @ApiProperty({ description: '微信登录 code (wx.login 获取)' })
  @IsString()
  code!: string;

  @ApiProperty({ description: '微信用户昵称（新用户时使用）', required: false })
  @IsOptional()
  @IsString()
  nickname?: string;
}
```

```typescript
// apps/api/src/modules/auth/dto/admin-login.dto.ts
import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AdminLoginDto {
  @ApiProperty({ description: '手机号' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @MinLength(6)
  password!: string;
}
```

- [ ] **Step 2: 实现 JWT Strategy**

```typescript
// apps/api/src/modules/auth/strategies/jwt.strategy.ts
import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService } from '../auth.service';

export interface JwtPayload {
  sub: string;
  loginType: 'wechat' | 'admin';
  role: string;
  district?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    // Verify the user still exists and is active
    await this.authService.validateUser(payload.sub);
    return payload;
  }
}
```

- [ ] **Step 3: 实现 AuthService**

```typescript
// apps/api/src/modules/auth/auth.service.ts
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  async adminLogin(dto: { phone: string; password: string }) {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
    });

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    if (user.role === Role.FAMILY) {
      throw new UnauthorizedException('家属账号不支持后台登录');
    }

    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('手机号或密码错误');
    }

    const payload: JwtPayload = {
      sub: user.id,
      loginType: 'admin',
      role: user.role,
      district: user.district ?? undefined,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async wechatLogin(openid: string, nickname?: string) {
    const user = await this.prisma.user.upsert({
      where: { openid },
      update: {},
      create: {
        openid,
        name: nickname || '微信用户',
        role: Role.FAMILY,
      },
    });

    const payload: JwtPayload = {
      sub: user.id,
      loginType: 'wechat',
      role: user.role,
      district: user.district ?? undefined,
    };

    const token = this.jwtService.sign(payload);

    return {
      token,
      user: this.sanitizeUser(user),
    };
  }

  async validateUser(userId: string): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    return {
      sub: user.id,
      loginType: 'admin',
      role: user.role,
      district: user.district ?? undefined,
    };
  }

  private sanitizeUser(user: {
    id: string;
    name: string;
    phone: string | null;
    role: Role;
    district: string | null;
    skills: string[];
    dutyStatus: string;
    openid?: string | null;
    createdAt: Date;
  }) {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      district: user.district,
      skills: user.skills,
      dutyStatus: user.dutyStatus,
      createdAt: user.createdAt,
    };
  }
}
```

- [ ] **Step 4: 实现 AuthController**

```typescript
// apps/api/src/modules/auth/auth.controller.ts
import { Controller, Post, Get, Body, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import { WechatLoginDto } from './dto/wechat-login.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { Public } from '../../common/decorators/public.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtPayload } from './strategies/jwt.strategy';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('wechat-login')
  @ApiOperation({ summary: '微信小程序登录' })
  wechatLogin(@Body() dto: WechatLoginDto) {
    return this.authService.wechatLogin(dto.code, dto.nickname);
  }

  @Public()
  @Post('admin-login')
  @ApiOperation({ summary: '后台管理端登录' })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: '获取当前用户信息' })
  getMe(@CurrentUser() user: JwtPayload) {
    return user;
  }
}
```

- [ ] **Step 5: 实现 AuthModule**

```typescript
// apps/api/src/modules/auth/auth.module.ts
import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('JWT_SECRET'),
        signOptions: {
          expiresIn: config.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  exports: [AuthService, JwtModule, PassportModule],
})
export class AuthModule {}
```

- [ ] **Step 6: 运行测试 — 验证 GREEN**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts auth
```

Expected: all auth unit tests PASS.

---

### Task 6: Auth 守卫 — GREEN 实现

**Files modified:** `apps/api/src/common/guards/jwt-auth.guard.ts`, `apps/api/src/common/guards/roles.guard.ts`

- [ ] **Step 1: 实现 JwtAuthGuard**

```typescript
// apps/api/src/common/guards/jwt-auth.guard.ts
import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) {
      return true;
    }
    return super.canActivate(context);
  }

  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('Token 无效或已过期');
    }
    return user;
  }
}
```

- [ ] **Step 2: 实现 RolesGuard**

```typescript
// apps/api/src/common/guards/roles.guard.ts
import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    // 未标注 @Roles() 的端点允许所有已认证用户访问
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    const userRole = user.role as Role;

    if (!requiredRoles.includes(userRole)) {
      throw new ForbiddenException(`角色 ${userRole} 无权限执行此操作`);
    }

    return true;
  }
}
```

- [ ] **Step 3: 运行测试确认守卫编译正确**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts auth --passWithNoTests
```

---

### Task 7: 注册全局守卫 + AppModule 更新

**Files modified:** `apps/api/src/app.module.ts`, `apps/api/src/main.ts`

- [ ] **Step 1: 更新 AppModule**

```typescript
// apps/api/src/app.module.ts
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { JwtAuthGuard } from './common/guards/jwt-auth.guard';
import { RolesGuard } from './common/guards/roles.guard';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: JwtAuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}
```

- [ ] **Step 2: 验证编译通过**

```bash
cd apps/api && pnpm build
```

Expected: `tsc` compiles without errors.

- [ ] **Step 3: 提交 Auth 实现**

```bash
git add apps/api/src/common/decorators/ apps/api/src/common/guards/ apps/api/src/modules/auth/ apps/api/src/app.module.ts
git commit -m "test: add failing tests for Auth module (guards, decorators, login)"
# Then after GREEN:
git commit -m "feat: implement JWT strategy, guards, decorators, wechat+admin login"
```

---

### Task 8: Users — 编写 RED 测试

**Files created:** `apps/api/src/modules/users/users.service.ts` (stub), `apps/api/src/modules/users/users.controller.ts` (stub), `apps/api/src/modules/users/users.service.spec.ts`, `apps/api/src/modules/users/users.controller.spec.ts`, `apps/api/src/modules/users/dto/create-user.dto.ts`, `apps/api/src/modules/users/dto/update-user.dto.ts`, `apps/api/src/modules/users/dto/user-response.dto.ts`

- [ ] **Step 1: 创建 DTO 文件**

```typescript
// apps/api/src/modules/users/dto/create-user.dto.ts
import { IsString, IsOptional, IsEnum, MinLength, IsArray, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: '手机号' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '姓名' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: '角色', enum: Role })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({ description: '密码（非 FAMILY 角色必填）', required: false })
  @ValidateIf((o: CreateUserDto) => o.role !== Role.FAMILY)
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ description: '技能标签', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({ description: '片区', required: false })
  @IsOptional()
  @IsString()
  district?: string;
}
```

```typescript
// apps/api/src/modules/users/dto/update-user.dto.ts
import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DutyStatus } from '@prisma/client';

export class UpdateUserDto {
  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '技能标签', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({ description: '片区', required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ description: '在岗状态', required: false, enum: DutyStatus })
  @IsOptional()
  @IsEnum(DutyStatus)
  dutyStatus?: DutyStatus;
}
```

```typescript
// apps/api/src/modules/users/dto/user-response.dto.ts
import { Role, DutyStatus } from '@prisma/client';

export class UserResponseDto {
  id!: string;
  name!: string;
  phone?: string | null;
  role!: Role;
  skills!: string[];
  district?: string | null;
  dutyStatus!: DutyStatus;
  avgResponseMin?: number | null;
  createdAt!: Date;
}
```

- [ ] **Step 2: 创建 UsersService stub**

```typescript
// apps/api/src/modules/users/users.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  async create(dto: any, createdBy: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async findAll(query: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async findById(id: string, requester: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async update(id: string, dto: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async updateDutyStatus(id: string, status: string, requester: any): Promise<any> {
    throw new Error('Not implemented');
  }
}
```

- [ ] **Step 3: 编写 UsersService RED 测试**

```typescript
// apps/api/src/modules/users/users.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role, DutyStatus } from '@prisma/client';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let crypto: FieldEncryptionService;

  const encryptedPhone = 'ab:cd:ef123456';

  const mockPrisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockCrypto = {
    encrypt: jest.fn().mockReturnValue(encryptedPhone),
    decrypt: jest.fn().mockImplementation((val: string) => {
      if (val === encryptedPhone) return '13800138000';
      return val;
    }),
  };

  const adminUser = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区', loginType: 'admin' };
  const workerUser = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区', loginType: 'admin' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FieldEncryptionService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    crypto = module.get<FieldEncryptionService>(FieldEncryptionService);
  });

  describe('create', () => {
    it('should create a user with encrypted phone', async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1', phone: encryptedPhone, name: '网格员A',
        role: Role.GRID_WORKER, skills: [], district: '朝阳区',
        dutyStatus: 'OFF_DUTY', createdAt: new Date(),
      });

      const result = await service.create({
        phone: '13800138000', name: '网格员A', role: Role.GRID_WORKER,
        password: 'pass123', district: '朝阳区',
      }, adminUser);

      expect(crypto.encrypt).toHaveBeenCalledWith('13800138000');
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(result.name).toBe('网格员A');
    });

    it('should throw if non-FAMILY user has no password', async () => {
      await expect(
        service.create({
          phone: '13800138000', name: 'NoPass', role: Role.ADMIN,
        }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow FAMILY user without password', async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: 'fam-1', phone: encryptedPhone, name: '家属A',
        role: Role.FAMILY, skills: [], district: null,
        dutyStatus: 'OFF_DUTY', createdAt: new Date(),
      });

      const result = await service.create({
        phone: '13900139000', name: '家属A', role: Role.FAMILY,
      }, adminUser);

      expect(result.role).toBe(Role.FAMILY);
    });
  });

  describe('findAll', () => {
    it('should return paginated user list (ADMIN)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
    });
  });

  describe('findById', () => {
    it('ADMIN sees decrypted phone', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', phone: encryptedPhone, name: 'Test',
        role: Role.GRID_WORKER, district: '朝阳区', skills: [],
        dutyStatus: 'OFF_DUTY', createdAt: new Date(),
      });

      const result = await service.findById('user-1', adminUser);
      expect(result.phone).toBe('13800138000');
    });

    it('non-ADMIN user can only see self', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2', phone: encryptedPhone, name: 'Other',
        role: Role.GRID_WORKER, district: '朝阳区', skills: [],
        dutyStatus: 'OFF_DUTY', createdAt: new Date(),
      });

      const result = await service.findById('user-2', { ...workerUser, sub: 'user-3' });
      expect(result.phone).toBeNull();
    });
  });

  describe('updateDutyStatus', () => {
    it('should allow user to toggle their own status', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.GRID_WORKER });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', dutyStatus: 'ON_DUTY' });

      const result = await service.updateDutyStatus('user-1', DutyStatus.ON_DUTY, { sub: 'user-1', role: Role.GRID_WORKER });
      expect(result).toEqual({ id: 'user-1', dutyStatus: 'ON_DUTY' });
    });

    it('should throw ForbiddenException when others try to toggle', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.GRID_WORKER });

      await expect(
        service.updateDutyStatus('user-1', DutyStatus.ON_DUTY, { sub: 'user-2', role: Role.GRID_WORKER }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
```

- [ ] **Step 4: 运行测试 — 验证 RED**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts users.service.spec.ts
```

Expected: tests FAIL (stub throws "Not implemented").

---

### Task 9: UsersService — GREEN 实现

**Files modified:** `apps/api/src/modules/users/users.service.ts`

- [ ] **Step 1: 实现 UsersService**

```typescript
// apps/api/src/modules/users/users.service.ts
import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role, DutyStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async create(dto: { phone: string; name: string; role: Role; password?: string; skills?: string[]; district?: string }, requester: Requester) {
    if (dto.role !== Role.FAMILY && !dto.password) {
      throw new BadRequestException('非家属角色必须设置密码');
    }

    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const encryptedPhone = this.crypto.encrypt(dto.phone);

    const user = await this.prisma.user.create({
      data: {
        phone: encryptedPhone,
        name: dto.name,
        role: dto.role,
        passwordHash,
        skills: dto.skills ?? [],
        district: dto.district ?? null,
      },
    });

    return this.sanitizeUser(user, requester);
  }

  async findAll(query: { page?: number; limit?: number; role?: Role; district?: string }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.district) where.district = query.district;

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => this.maskPhone(u)),
      total,
      page,
      limit,
    };
  }

  async findById(id: string, requester: Requester) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('用户不存在');
    return this.sanitizeUser(user, requester);
  }

  async update(id: string, dto: { name?: string; skills?: string[]; district?: string; dutyStatus?: DutyStatus }) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.skills !== undefined && { skills: dto.skills }),
        ...(dto.district !== undefined && { district: dto.district }),
        ...(dto.dutyStatus !== undefined && { dutyStatus: dto.dutyStatus }),
      },
    });

    return this.maskPhone(user);
  }

  async updateDutyStatus(id: string, status: DutyStatus, requester: Requester) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('用户不存在');

    // Only ADMIN or the user themselves can update duty status
    if (requester.role !== Role.ADMIN && requester.sub !== id) {
      throw new ForbiddenException('无权限修改他人状态');
    }

    return this.prisma.user.update({
      where: { id },
      data: { dutyStatus: status },
      select: { id: true, dutyStatus: true },
    });
  }

  private sanitizeUser(user: any, requester: Requester) {
    const isAdmin = requester.role === Role.ADMIN;
    const isSelf = requester.sub === user.id;

    return {
      id: user.id,
      name: user.name,
      phone: isAdmin || isSelf ? this.tryDecrypt(user.phone) : null,
      role: user.role,
      skills: user.skills,
      district: user.district,
      dutyStatus: user.dutyStatus,
      avgResponseMin: user.avgResponseMin,
      createdAt: user.createdAt,
    };
  }

  private maskPhone(user: any) {
    return { ...user, phone: null };
  }

  private tryDecrypt(value: string | null): string | null {
    if (!value) return null;
    try {
      return this.crypto.decrypt(value);
    } catch {
      return value;
    }
  }
}
```

- [ ] **Step 2: 运行测试 — 验证 GREEN**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts users.service.spec.ts
```

Expected: all users service tests PASS.

---

### Task 10: UsersController + UsersModule — GREEN 实现

**Files created/modified:** `apps/api/src/modules/users/users.controller.ts`, `apps/api/src/modules/users/users.module.ts`

- [ ] **Step 1: 实现 UsersController**

```typescript
// apps/api/src/modules/users/users.controller.ts
import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, DutyStatus } from '@prisma/client';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '创建用户' })
  create(@Body() dto: CreateUserDto, @CurrentUser() user: any) {
    return this.usersService.create(dto, user);
  }

  @Get()
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '用户列表（分页，可选角色/片区筛选）' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('role') role?: Role,
    @Query('district') district?: string,
  ) {
    return this.usersService.findAll({ page, limit, role, district });
  }

  @Get(':id')
  @ApiOperation({ summary: '用户详情' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.usersService.findById(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '更新用户信息' })
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @Patch(':id/duty')
  @ApiOperation({ summary: '切换在岗/离岗状态' })
  updateDutyStatus(
    @Param('id') id: string,
    @Body('dutyStatus') dutyStatus: DutyStatus,
    @CurrentUser() user: any,
  ) {
    return this.usersService.updateDutyStatus(id, dutyStatus, user);
  }
}
```

- [ ] **Step 2: 实现 UsersModule**

```typescript
// apps/api/src/modules/users/users.module.ts
import { Module } from '@nestjs/common';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';

@Module({
  controllers: [UsersController],
  providers: [UsersService, FieldEncryptionService],
  exports: [UsersService],
})
export class UsersModule {}
```

- [ ] **Step 3: 编写 UsersController 测试**

```typescript
// apps/api/src/modules/users/users.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { Role } from '@prisma/client';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    updateDutyStatus: jest.fn(),
  };

  const adminPayload = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区', loginType: 'admin' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [{ provide: UsersService, useValue: mockService }],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  it('should create a user', async () => {
    mockService.create.mockResolvedValue({ id: '1', name: 'Test' });
    const result = await controller.create(
      { phone: '13800138000', name: 'Test', role: Role.GRID_WORKER, password: 'pass123' },
      adminPayload,
    );
    expect(result).toHaveProperty('id', '1');
  });

  it('should return paginated users', async () => {
    mockService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
    const result = await controller.findAll(1, 10);
    expect(result).toHaveProperty('items');
    expect(result).toHaveProperty('total');
  });

  it('should get user by id', async () => {
    mockService.findById.mockResolvedValue({ id: '1', name: 'Test' });
    const result = await controller.findById('1', adminPayload);
    expect(result).toHaveProperty('id', '1');
  });
});
```

- [ ] **Step 4: 注册 UsersModule 到 AppModule**

```typescript
// apps/api/src/app.module.ts — 在 imports 数组增加
UsersModule,
```

- [ ] **Step 5: 运行所有测试**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts
```

Expected: all tests GREEN.

- [ ] **Step 6: 提交 Users**

```bash
git add apps/api/src/modules/users/dto/ apps/api/src/modules/users/users.service.ts apps/api/src/modules/users/users.module.ts apps/api/src/modules/users/users.controller.ts
git commit -m "test: add failing tests for Users CRUD with RBAC"
git add apps/api/src/modules/users/
git commit -m "feat: implement Users CRUD with role/district filtering"
```

---

### Task 11: Elders — DTO 文件

**Files created:** `apps/api/src/modules/elders/dto/create-elder.dto.ts`, `apps/api/src/modules/elders/dto/update-elder.dto.ts`, `apps/api/src/modules/elders/dto/create-contact.dto.ts`, `apps/api/src/modules/elders/dto/risk-profile.dto.ts`

- [ ] **Step 1: 创建 DTO 文件**

```typescript
// apps/api/src/modules/elders/dto/create-elder.dto.ts
import { IsString, IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceLevel } from '@prisma/client';

export class CreateElderContactDto {
  @ApiProperty({ description: '联系人姓名' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '与老人关系' })
  @IsString()
  relation!: string;

  @ApiProperty({ description: '联系电话' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '是否主要联系人', required: false })
  @IsOptional()
  isPrimary?: boolean;
}

export class CreateElderDto {
  @ApiProperty({ description: '姓名' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '性别（M/F）', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ description: '出生日期', required: false })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiProperty({ description: '身份证号（加密存储）', required: false })
  @IsOptional()
  @IsString()
  idCard?: string;

  @ApiProperty({ description: '住址（加密存储）', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: '所属片区' })
  @IsString()
  district!: string;

  @ApiProperty({ description: '经度', required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ description: '纬度', required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ description: '健康标签', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  healthTags?: string[];

  @ApiProperty({ description: '服务等级', required: false, enum: ServiceLevel })
  @IsOptional()
  @IsEnum(ServiceLevel)
  serviceLevel?: ServiceLevel;

  @ApiProperty({ description: '居住状况', required: false })
  @IsOptional()
  @IsString()
  livingStatus?: string;

  @ApiProperty({ description: '紧急联系人', required: false, type: [CreateElderContactDto] })
  @IsOptional()
  @IsArray()
  contacts?: CreateElderContactDto[];
}
```

```typescript
// apps/api/src/modules/elders/dto/update-elder.dto.ts
import { IsString, IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceLevel } from '@prisma/client';

export class UpdateElderDto {
  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '性别', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ description: '出生日期', required: false })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiProperty({ description: '身份证号', required: false })
  @IsOptional()
  @IsString()
  idCard?: string;

  @ApiProperty({ description: '住址', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: '经度', required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ description: '纬度', required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ description: '健康标签', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  healthTags?: string[];

  @ApiProperty({ description: '服务等级', required: false, enum: ServiceLevel })
  @IsOptional()
  @IsEnum(ServiceLevel)
  serviceLevel?: ServiceLevel;

  @ApiProperty({ description: '居住状况', required: false })
  @IsOptional()
  @IsString()
  livingStatus?: string;
}
```

```typescript
// apps/api/src/modules/elders/dto/create-contact.dto.ts
import { IsString, IsOptional, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({ description: '联系人姓名' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '与老人关系' })
  @IsString()
  relation!: string;

  @ApiProperty({ description: '联系电话（加密存储）' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '是否主要联系人', required: false })
  @IsOptional()
  isPrimary?: boolean;
}
```

```typescript
// apps/api/src/modules/elders/dto/risk-profile.dto.ts
import { RiskLevel } from '@prisma/client';

export class RiskStatsDto {
  totalCheckIns!: number;
  missedCheckIns!: number;
  abnormalCheckIns!: number;
  totalVisits!: number;
  activeRiskEvents!: number;
  completedWorkOrders!: number;
}

export class CurrentRiskDto {
  level!: RiskLevel;
  activeAlerts!: number;
}

export class RiskProfileDto {
  elderId!: string;
  elderName!: string;
  serviceLevel!: string;
  stats!: RiskStatsDto;
  currentRisk!: CurrentRiskDto;
  recentRiskEvents!: any[];
  generatedAt!: string;
}
```

---

### Task 12: EldersService — 编写 RED 测试

**Files created:** `apps/api/src/modules/elders/elders.service.ts` (stub), `apps/api/src/modules/elders/elders.service.spec.ts`

- [ ] **Step 1: 创建 stub**

```typescript
// apps/api/src/modules/elders/elders.service.ts
import { Injectable } from '@nestjs/common';

@Injectable()
export class EldersService {
  async create(dto: any, requester: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async findAll(query: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async findById(id: string, requester: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async update(id: string, dto: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async addContact(elderId: string, dto: any): Promise<any> {
    throw new Error('Not implemented');
  }
  async getContacts(elderId: string): Promise<any> {
    throw new Error('Not implemented');
  }
  async getRiskProfile(elderId: string): Promise<any> {
    throw new Error('Not implemented');
  }
  async linkFamily(elderId: string, userId: string, relation: string): Promise<any> {
    throw new Error('Not implemented');
  }
}
```

- [ ] **Step 2: 编写 RED 测试**

```typescript
// apps/api/src/modules/elders/elders.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EldersService } from './elders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role } from '@prisma/client';

describe('EldersService', () => {
  let service: EldersService;
  let prisma: PrismaService;
  let crypto: FieldEncryptionService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const otherWorker = { sub: 'worker-2', role: Role.GRID_WORKER, district: '海淀区' };
  const family = { sub: 'fam-1', role: Role.FAMILY };

  const encryptedIdCard = 'iv1:tag1:idcard-encrypted';
  const encryptedAddress = 'iv2:tag2:address-encrypted';
  const encryptedPhone = 'iv3:tag3:phone-encrypted';

  const mockPrisma = {
    elder: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    emergencyContact: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    elderFamilyLink: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    checkIn: {
      count: jest.fn(),
    },
    visitRecord: {
      count: jest.fn(),
    },
    riskEvent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    workOrder: {
      count: jest.fn(),
    },
  };

  const mockCrypto = {
    encrypt: jest.fn().mockImplementation((v: string) => {
      const map: Record<string, string> = {
        '110101199001011234': encryptedIdCard,
        '北京市朝阳区某某街道100号': encryptedAddress,
        '13800138000': encryptedPhone,
        '13900139000': 'iv4:tag4:contact-encrypted',
      };
      return map[v] || `encrypted:${v}`;
    }),
    decrypt: jest.fn().mockImplementation((v: string) => {
      const map: Record<string, string> = {
        [encryptedIdCard]: '110101199001011234',
        [encryptedAddress]: '北京市朝阳区某某街道100号',
        [encryptedPhone]: '13800138000',
        'iv4:tag4:contact-encrypted': '13900139000',
      };
      return map[v] || v;
    }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EldersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FieldEncryptionService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<EldersService>(EldersService);
    prisma = module.get<PrismaService>(PrismaService);
    crypto = module.get<FieldEncryptionService>(FieldEncryptionService);
  });

  describe('create', () => {
    it('should create elder with encrypted fields', async () => {
      mockPrisma.elder.create.mockResolvedValue({
        id: 'elder-1', name: '张大爷', gender: 'M', birthDate: new Date('1945-03-10'),
        idCard: encryptedIdCard, address: encryptedAddress,
        district: '朝阳区', longitude: 116.4, latitude: 39.9,
        healthTags: ['慢病', '独居'], serviceLevel: 'KEY',
        livingStatus: '独居', createdAt: new Date(),
      });

      const result = await service.create({
        name: '张大爷', gender: 'M', birthDate: '1945-03-10',
        idCard: '110101199001011234', address: '北京市朝阳区某某街道100号',
        district: '朝阳区', healthTags: ['慢病', '独居'],
        contacts: [{ name: '张小明', relation: '子女', phone: '13900139000' }],
      }, admin);

      expect(crypto.encrypt).toHaveBeenCalledWith('110101199001011234');
      expect(crypto.encrypt).toHaveBeenCalledWith('北京市朝阳区某某街道100号');
      expect(result.name).toBe('张大爷');
    });
  });

  describe('findById', () => {
    it('ADMIN sees all decrypted fields', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', name: '张大爷', gender: 'M', birthDate: new Date('1945-03-10'),
        idCard: encryptedIdCard, address: encryptedAddress,
        district: '朝阳区', healthTags: ['慢病'], serviceLevel: 'KEY',
        contacts: [{ id: 'c1', name: '张小明', relation: '子女', phone: 'iv4:tag4:contact-encrypted', isPrimary: true, elderId: 'elder-1' }],
        familyLinks: [{ id: 'fl1', userId: 'fam-1', relation: '子女', elderId: 'elder-1' }],
      });

      const result = await service.findById('elder-1', admin);
      expect(result.idCard).toBe('110101199001011234');
      expect(result.address).toBe('北京市朝阳区某某街道100号');
    });

    it('same-district worker sees masked idCard and decrypted address', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', name: '张大爷', gender: 'M', birthDate: new Date('1945-03-10'),
        idCard: encryptedIdCard, address: encryptedAddress,
        district: '朝阳区', healthTags: ['慢病'], serviceLevel: 'KEY',
        contacts: [{ id: 'c1', name: '张小明', relation: '子女', phone: 'iv4:tag4:contact-encrypted', isPrimary: true, elderId: 'elder-1' }],
        familyLinks: [],
      });

      const result = await service.findById('elder-1', worker);
      expect(result.idCard).toBeNull(); // worker can't see idCard
      expect(result.address).toBe('北京市朝阳区某某街道100号');
    });

    it('different-district worker gets 403', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', name: '张大爷', district: '朝阳区', gender: 'M', birthDate: null,
        idCard: null, address: null, healthTags: [], serviceLevel: 'NORMAL',
        contacts: [], familyLinks: [],
      });

      await expect(service.findById('elder-1', otherWorker)).rejects.toThrow();
    });
  });

  describe('getRiskProfile', () => {
    it('should return aggregated risk profile', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', name: '张大爷', serviceLevel: 'KEY',
      });
      mockPrisma.checkIn.count.mockResolvedValue(25);  // total checkins
      mockPrisma.visitRecord.count.mockResolvedValue(8);
      mockPrisma.riskEvent.findFirst.mockResolvedValue(null);
      mockPrisma.riskEvent.findMany.mockResolvedValue([]);
      mockPrisma.riskEvent.count.mockResolvedValue(0);
      mockPrisma.workOrder.count.mockResolvedValue(3);

      const result = await service.getRiskProfile('elder-1');
      expect(result).toHaveProperty('elderId', 'elder-1');
      expect(result).toHaveProperty('stats');
      expect(result.stats.totalCheckIns).toBe(25);
      expect(result.stats.completedWorkOrders).toBe(3);
      expect(result).toHaveProperty('currentRisk');
      expect(result).toHaveProperty('recentRiskEvents');
    });
  });
});
```

- [ ] **Step 3: 运行测试 — 验证 RED**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts elders.service.spec.ts
```

Expected: tests FAIL (stub throws "Not implemented").

---

### Task 13: EldersService — GREEN 实现

**Files modified:** `apps/api/src/modules/elders/elders.service.ts`

- [ ] **Step 1: 实现 EldersService**

```typescript
// apps/api/src/modules/elders/elders.service.ts
import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role, ServiceLevel, RiskLevel } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

const SENSITIVE_FIELDS = ['idCard', 'address'];
const ENCRYPT_FIELDS = ['idCard', 'address'];

@Injectable()
export class EldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async create(dto: any, requester: Requester) {
    const { contacts, ...elderData } = dto;

    // Encrypt sensitive fields before storing
    const encryptedData: any = { ...elderData };
    for (const field of ENCRYPT_FIELDS) {
      if (encryptedData[field]) {
        encryptedData[field] = this.crypto.encrypt(encryptedData[field]);
      }
    }

    // Handle birthDate conversion
    if (encryptedData.birthDate) {
      encryptedData.birthDate = new Date(encryptedData.birthDate);
    }

    const elder = await this.prisma.elder.create({
      data: {
        ...encryptedData,
        contacts: contacts
          ? {
              create: contacts.map((c: any) => ({
                name: c.name,
                relation: c.relation,
                phone: this.crypto.encrypt(c.phone),
                isPrimary: c.isPrimary ?? false,
              })),
            }
          : undefined,
      },
      include: {
        contacts: true,
      },
    });

    return this.sanitizeElder(elder, requester);
  }

  async findAll(query: { page?: number; limit?: number; district?: string; serviceLevel?: ServiceLevel }) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (query.district) where.district = query.district;
    if (query.serviceLevel) where.serviceLevel = query.serviceLevel;

    const [items, total] = await Promise.all([
      this.prisma.elder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { contacts: true },
      }),
      this.prisma.elder.count({ where }),
    ]);

    return {
      items: items.map((e) => this.maskSensitive(e)),
      total,
      page,
      limit,
    };
  }

  async findById(id: string, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id },
      include: {
        contacts: true,
        familyLinks: true,
      },
    });

    if (!elder) {
      throw new BadRequestException('老人不存在');
    }

    // District check — only ADMIN can cross districts
    if (requester.role !== Role.ADMIN) {
      if (requester.role === Role.FAMILY) {
        const isLinked = elder.familyLinks.some((fl: any) => fl.userId === requester.sub);
        if (!isLinked) {
          throw new ForbiddenException('无权限查看此老人信息');
        }
      } else if (requester.district && elder.district !== requester.district) {
        throw new ForbiddenException('无权限查看其他片区的老人信息');
      }
    }

    return this.sanitizeElder(elder, requester);
  }

  async update(id: string, dto: any) {
    const encryptedData: any = { ...dto };
    for (const field of ENCRYPT_FIELDS) {
      if (encryptedData[field]) {
        encryptedData[field] = this.crypto.encrypt(encryptedData[field]);
      }
    }
    if (encryptedData.birthDate) {
      encryptedData.birthDate = new Date(encryptedData.birthDate);
    }

    const elder = await this.prisma.elder.update({
      where: { id },
      data: encryptedData,
      include: { contacts: true },
    });

    return this.maskSensitive(elder);
  }

  async addContact(elderId: string, dto: { name: string; relation: string; phone: string; isPrimary?: boolean }) {
    const contact = await this.prisma.emergencyContact.create({
      data: {
        elderId,
        name: dto.name,
        relation: dto.relation,
        phone: this.crypto.encrypt(dto.phone),
        isPrimary: dto.isPrimary ?? false,
      },
    });

    return {
      ...contact,
      phone: this.crypto.decrypt(contact.phone),
    };
  }

  async getContacts(elderId: string) {
    const contacts = await this.prisma.emergencyContact.findMany({
      where: { elderId },
    });

    return contacts.map((c) => ({
      ...c,
      phone: this.tryDecrypt(c.phone),
    }));
  }

  async getRiskProfile(elderId: string) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      select: { id: true, name: true, serviceLevel: true },
    });

    if (!elder) throw new BadRequestException('老人不存在');

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [
      totalCheckIns,
      missedCheckIns,
      abnormalCheckIns,
      totalVisits,
      activeRiskEvents,
      completedWorkOrders,
      latestRiskEvent,
      recentRiskEvents,
    ] = await Promise.all([
      this.prisma.checkIn.count({ where: { elderId, createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.checkIn.count({ where: { elderId, status: 'MISSED', createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.checkIn.count({ where: { elderId, status: 'ABNORMAL', createdAt: { gte: thirtyDaysAgo } } }),
      this.prisma.visitRecord.count({ where: { elderId, visitTime: { gte: thirtyDaysAgo } } }),
      this.prisma.riskEvent.count({
        where: { elderId, status: { in: ['PENDING_REVIEW', 'CONFIRMED'] } },
      }),
      this.prisma.workOrder.count({ where: { elderId, status: 'COMPLETED' } }),
      this.prisma.riskEvent.findFirst({
        where: { elderId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.riskEvent.findMany({
        where: { elderId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
    ]);

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
      generatedAt: new Date().toISOString(),
    };
  }

  async linkFamily(elderId: string, userId: string, relation: string) {
    return this.prisma.elderFamilyLink.create({
      data: { elderId, userId, relation },
    });
  }

  private sanitizeElder(elder: any, requester: Requester) {
    const isAdmin = requester.role === Role.ADMIN;
    const isFamily = requester.role === Role.FAMILY;
    const isSameDistrict = requester.district && elder.district === requester.district;
    const canSeeSensitive = isAdmin || isSameDistrict || isFamily;

    return {
      id: elder.id,
      name: elder.name,
      gender: elder.gender,
      birthDate: elder.birthDate,
      idCard: isAdmin ? this.tryDecrypt(elder.idCard) : null,
      address: canSeeSensitive ? this.tryDecrypt(elder.address) : null,
      district: elder.district,
      longitude: elder.longitude,
      latitude: elder.latitude,
      healthTags: elder.healthTags,
      serviceLevel: elder.serviceLevel,
      livingStatus: elder.livingStatus,
      createdAt: elder.createdAt,
      contacts: elder.contacts?.map((c: any) => ({
        id: c.id,
        name: c.name,
        relation: c.relation,
        phone: canSeeSensitive ? this.tryDecrypt(c.phone) : null,
        isPrimary: c.isPrimary,
      })),
    };
  }

  private maskSensitive(elder: any) {
    return {
      ...elder,
      idCard: null,
      address: null,
      contacts: elder.contacts?.map((c: any) => ({ ...c, phone: null })),
    };
  }

  private tryDecrypt(value: string | null): string | null {
    if (!value) return null;
    try {
      return this.crypto.decrypt(value);
    } catch {
      return value;
    }
  }
}
```

- [ ] **Step 2: 运行测试 — 验证 GREEN**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts elders.service.spec.ts
```

Expected: all elders service tests PASS.

---

### Task 14: EldersModule + EldersController — GREEN 实现

**Files created:** `apps/api/src/modules/elders/elders.module.ts`, `apps/api/src/modules/elders/elders.controller.ts`, `apps/api/src/modules/elders/elders.controller.spec.ts`

- [ ] **Step 1: 实现 EldersModule**

```typescript
// apps/api/src/modules/elders/elders.module.ts
import { Module } from '@nestjs/common';
import { EldersController } from './elders.controller';
import { EldersService } from './elders.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';

@Module({
  controllers: [EldersController],
  providers: [EldersService, FieldEncryptionService],
  exports: [EldersService],
})
export class EldersModule {}
```

- [ ] **Step 2: 实现 EldersController**

```typescript
// apps/api/src/modules/elders/elders.controller.ts
import { Controller, Get, Post, Patch, Param, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role, ServiceLevel } from '@prisma/client';
import { EldersService } from './elders.service';
import { CreateElderDto } from './dto/create-elder.dto';
import { UpdateElderDto } from './dto/update-elder.dto';
import { CreateContactDto } from './dto/create-contact.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';

@ApiTags('Elders')
@ApiBearerAuth()
@Controller('elders')
export class EldersController {
  constructor(private readonly eldersService: EldersService) {}

  @Post()
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '创建老人档案' })
  create(@Body() dto: CreateElderDto, @CurrentUser() user: any) {
    return this.eldersService.create(dto, user);
  }

  @Get()
  @ApiOperation({ summary: '老人列表（分页+片区+服务等级筛选）' })
  findAll(
    @Query('page') page?: number,
    @Query('limit') limit?: number,
    @Query('district') district?: string,
    @Query('serviceLevel') serviceLevel?: ServiceLevel,
  ) {
    return this.eldersService.findAll({ page, limit, district, serviceLevel });
  }

  @Get(':id')
  @ApiOperation({ summary: '老人详情（敏感字段按角色解密）' })
  findById(@Param('id') id: string, @CurrentUser() user: any) {
    return this.eldersService.findById(id, user);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '更新老人档案' })
  update(@Param('id') id: string, @Body() dto: UpdateElderDto) {
    return this.eldersService.update(id, dto);
  }

  @Post(':id/contacts')
  @Roles(Role.ADMIN, Role.GRID_WORKER)
  @ApiOperation({ summary: '添加紧急联系人' })
  addContact(@Param('id') elderId: string, @Body() dto: CreateContactDto) {
    return this.eldersService.addContact(elderId, dto);
  }

  @Get(':id/contacts')
  @ApiOperation({ summary: '查看紧急联系人' })
  getContacts(@Param('id') elderId: string) {
    return this.eldersService.getContacts(elderId);
  }

  @Get(':id/risk-profile')
  @ApiOperation({ summary: '风险画像聚合' })
  getRiskProfile(@Param('id') elderId: string) {
    return this.eldersService.getRiskProfile(elderId);
  }

  @Post(':id/link-family')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: '绑定家属账号' })
  linkFamily(
    @Param('id') elderId: string,
    @Body('userId') userId: string,
    @Body('relation') relation: string,
  ) {
    return this.eldersService.linkFamily(elderId, userId, relation);
  }
}
```

- [ ] **Step 3: 编写 EldersController 测试**

```typescript
// apps/api/src/modules/elders/elders.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { EldersController } from './elders.controller';
import { EldersService } from './elders.service';
import { Role } from '@prisma/client';

describe('EldersController', () => {
  let controller: EldersController;
  let service: EldersService;

  const mockService = {
    create: jest.fn(),
    findAll: jest.fn(),
    findById: jest.fn(),
    update: jest.fn(),
    addContact: jest.fn(),
    getContacts: jest.fn(),
    getRiskProfile: jest.fn(),
    linkFamily: jest.fn(),
  };

  const admin = { sub: '1', role: Role.ADMIN, district: '朝阳区', loginType: 'admin' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EldersController],
      providers: [{ provide: EldersService, useValue: mockService }],
    }).compile();

    controller = module.get<EldersController>(EldersController);
    service = module.get<EldersService>(EldersService);
  });

  it('should create an elder', async () => {
    mockService.create.mockResolvedValue({ id: '1', name: '张大爷' });
    const result = await controller.create({ name: '张大爷', district: '朝阳区' }, admin);
    expect(result).toHaveProperty('id', '1');
  });

  it('should return elder list', async () => {
    mockService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 10 });
    const result = await controller.findAll();
    expect(result).toHaveProperty('items');
  });

  it('should return risk profile', async () => {
    mockService.getRiskProfile.mockResolvedValue({
      elderId: '1', elderName: '张大爷', stats: {}, currentRisk: { level: 'LOW', activeAlerts: 0 },
      recentRiskEvents: [], generatedAt: new Date().toISOString(),
    });
    const result = await controller.getRiskProfile('1');
    expect(result).toHaveProperty('elderId', '1');
  });
});
```

- [ ] **Step 4: 注册 EldersModule 到 AppModule**

```typescript
// apps/api/src/app.module.ts — 在 imports 数组增加
EldersModule,
```

完整 import 语句新增：
```typescript
import { UsersModule } from './modules/users/users.module';
import { EldersModule } from './modules/elders/elders.module';
```

- [ ] **Step 5: 运行全量测试**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts
```

Expected: all tests GREEN (~35 tests total).

- [ ] **Step 6: 提交 Elders**

```bash
git add apps/api/src/modules/elders/dto/ apps/api/src/modules/elders/elders.service.ts apps/api/src/modules/elders/elders.module.ts apps/api/src/modules/elders/elders.controller.ts
git commit -m "test: add failing tests for Elders CRUD, encryption, risk-profile"
git add apps/api/src/modules/elders/
git commit -m "feat: implement Elders CRUD with field encryption and risk profile"
```

---

### Task 15: Auth E2E 测试

**Files created:** `apps/api/test/auth.e2e-spec.ts`

- [ ] **Step 1: 确保 Docker 服务运行**

```bash
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
```

Expected: postgres, redis, minio all `Up` + `healthy`.

- [ ] **Step 2: 运行迁移**

```bash
cd apps/api && pnpm prisma:migrate --name add_users_elders_auth
```

Expected: migration created successfully.

- [ ] **Step 3: Seed 一个 ADMIN 用户用于测试**

```bash
cd apps/api && node -e "
const { PrismaClient, Role } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const p = new PrismaClient();
(async () => {
  const hash = await bcrypt.hash('admin123', 10);
  await p.user.upsert({
    where: { phone: '13800000000' },
    update: {},
    create: {
      phone: '13800000000',
      name: '系统管理员',
      role: Role.ADMIN,
      passwordHash: hash,
      district: '朝阳区',
    }
  });
  console.log('Admin user seeded');
  await p.\$disconnect();
})();
"
```

- [ ] **Step 4: 编写 E2E 测试**

```typescript
// apps/api/test/auth.e2e-spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('Auth E2E', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/admin-login', () => {
    it('should return token for valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/admin-login')
        .send({ phone: '13800000000', password: 'admin123' })
        .expect(201);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.role).toBe('ADMIN');

      adminToken = response.body.data.token;
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/admin-login')
        .send({ phone: '13800000000', password: 'wrongpass' })
        .expect(401);

      expect(response.body.code).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('sub');
      expect(response.body.data).toHaveProperty('role', 'ADMIN');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  describe('RBAC enforcement', () => {
    it('should reject unauthenticated request to /users', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);
    });

    it('should allow ADMIN to access /users', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
    });
  });
});
```

- [ ] **Step 5: 运行 E2E 测试**

```bash
cd apps/api && pnpm test:e2e
```

Expected: all E2E tests PASS.

- [ ] **Step 6: 提交 E2E**

```bash
git add apps/api/test/auth.e2e-spec.ts
git commit -m "test: add auth E2E tests for login and RBAC enforcement"
```

---

### Task 16: 最终验证与推送

- [ ] **Step 1: 运行全量单元测试**

```bash
cd apps/api && pnpm test
```

Expected: all unit tests PASS (~35+ tests).

- [ ] **Step 2: 运行全量 E2E 测试**

```bash
cd apps/api && pnpm test:e2e
```

Expected: all E2E tests PASS (~6 tests total).

- [ ] **Step 3: Lint 检查**

```bash
cd apps/api && pnpm lint
```

Expected: no lint errors.

- [ ] **Step 4: Build 检查**

```bash
cd apps/api && pnpm build
```

Expected: `dist/` output created without errors.

- [ ] **Step 5: 检查覆盖率**

```bash
cd apps/api && pnpm test:cov
```

Expected: backend coverage ≥ 80%, auth/users/elders modules ≥ 90%.

- [ ] **Step 6: 查看提交历史**

```bash
git log --oneline
```

Expected: ~10 conventional commits.

- [ ] **Step 7: 推送分支到 GitHub**

```bash
git push -u origin epic1-auth-users-elders
```

---

## Definition of Done Checklist

- [ ] Task 1: 依赖安装完成，bcryptjs/passport-jwt 可正常 require
- [ ] Task 2-3: FieldEncryptionService RED→GREEN，9 个加密测试全过
- [ ] Task 4-7: Auth 模块（JWT/守卫/装饰器/登录/me）全部实现并测试通过
- [ ] Task 8-10: Users CRUD + RBAC 过滤 + phone 按角色可见
- [ ] Task 11-14: Elders CRUD + 字段加密 + 风险画像聚合
- [ ] Task 15: E2E 登录→RBAC 越权拒绝全链路通过
- [ ] Task 16: lint / test / e2e / build 全绿，覆盖率达标，推送到 GitHub
