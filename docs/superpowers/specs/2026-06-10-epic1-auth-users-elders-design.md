# Epic 1：鉴权与用户/档案设计文档

> 日期：2026-06-10
> 关联：GitHub Issue [#10](https://github.com/starry-cpu/elder-risk-dispatch/issues/10) | DEVELOPMENT_PLAN.md §11 阶段 1

---

## 1. 概述

在 Epic 0 脚手架之上，实现社区多角色用户体系、统一鉴权（微信小程序 + 后台密码登录）、RBAC 权限控制、用户管理、老人档案管理（含字段加密）及风险画像聚合查询。

### 1.1 关键决策

| 决策项 | 选择 | 理由 |
|--------|------|------|
| JWT 策略 | 统一 JWT + `loginType` 字段 | 简单统一，管理方便 |
| RBAC 模型 | 片区隔离 + 角色分层 | 符合网格化管理业务模型 |
| 字段加密 | AES-256-GCM + Base64 编码，Service 层加解密 | 安全可控，不依赖特定 PG 扩展 |
| 密码哈希 | bcryptjs（纯 JS 实现） | Windows 兼容，无原生编译问题 |

---

## 2. 新增依赖

```json
{
  "@nestjs/jwt": "^11.0.2",
  "@nestjs/passport": "^11.0.5",
  "passport": "^0.7.0",
  "passport-jwt": "^4.0.1",
  "bcryptjs": "^3.0.3",
  "@types/passport-jwt": "^4.0.1",
  "@types/bcryptjs": "^3.0.0"
}
```

---

## 3. 模块架构

### 3.1 目录结构

```
apps/api/src/
├── app.module.ts                              # 新增 ConfigModule + Auth/Users/Elders
├── common/
│   ├── crypto/
│   │   ├── field-encryption.service.ts         # NEW - AES-256-GCM 加密/解密
│   │   └── field-encryption.service.spec.ts    # NEW
│   ├── guards/
│   │   ├── jwt-auth.guard.ts                   # NEW - JWT 验证守卫
│   │   └── roles.guard.ts                      # NEW - RBAC + 片区检查
│   └── decorators/
│       ├── roles.decorator.ts                  # NEW - @Roles(Role.ADMIN, ...)
│       ├── current-user.decorator.ts           # NEW - @CurrentUser() / @CurrentUser('sub')
│       └── public.decorator.ts                 # NEW - @Public() 跳过鉴权
├── modules/
│   ├── auth/
│   │   ├── auth.module.ts
│   │   ├── auth.controller.ts
│   │   ├── auth.service.ts
│   │   ├── strategies/
│   │   │   └── jwt.strategy.ts                 # Passport JWT Strategy
│   │   ├── dto/
│   │   │   ├── wechat-login.dto.ts
│   │   │   └── admin-login.dto.ts
│   │   ├── auth.controller.spec.ts
│   │   └── auth.service.spec.ts
│   ├── users/
│   │   ├── users.module.ts
│   │   ├── users.controller.ts
│   │   ├── users.service.ts
│   │   ├── dto/
│   │   │   ├── create-user.dto.ts
│   │   │   ├── update-user.dto.ts
│   │   │   └── user-response.dto.ts
│   │   ├── users.controller.spec.ts
│   │   └── users.service.spec.ts
│   └── elders/
│       ├── elders.module.ts
│       ├── elders.controller.ts
│       ├── elders.service.ts
│       ├── dto/
│       │   ├── create-elder.dto.ts
│       │   ├── update-elder.dto.ts
│       │   ├── create-contact.dto.ts
│       │   └── risk-profile.dto.ts
│       ├── elders.controller.spec.ts
│       └── elders.service.spec.ts
```

### 3.2 AppModule 变更

```typescript
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    EldersModule,
    HealthModule,
  ],
})
export class AppModule {}
```

---

## 4. Auth 模块

### 4.1 JWT Payload

```typescript
interface JwtPayload {
  sub: string;          // userId
  loginType: 'wechat' | 'admin';
  role: Role;
  district?: string;    // 片区（网格员/医生/物业/志愿者）
}
```

### 4.2 登录流程

**微信登录**：`POST /auth/wechat-login` → `{ code }`
```
客户端 → api → 微信服务器 GET /sns/jscode2session?code=
       → Upsert User (by openid, 首次创建 FAMILY 角色)
       → return { token, user }
```

**后台登录**：`POST /auth/admin-login` → `{ phone, password }`
```
客户端 → api → find User (phone + role != FAMILY)
       → bcrypt.compare(password, passwordHash)
       → return { token, user } (loginType=admin)
```

### 4.3 端点

| 方法 | 路径 | 鉴权 | 说明 |
|------|------|------|------|
| POST | `/auth/wechat-login` | @Public() | body: `{ code }` → `{ token, user }` |
| POST | `/auth/admin-login` | @Public() | body: `{ phone, password }` → `{ token, user }` |
| GET | `/auth/me` | JWT | 返回当前用户信息 |

### 4.4 守卫生效机制

```
请求 → JwtAuthGuard（验证 token 有效性）
     → RolesGuard（检查 @Roles() 装饰器 + 片区匹配）
     → Controller
```

- **JwtAuthGuard**：通过 `APP_GUARD` 全局注册，继承 `AuthGuard('jwt')`
- **@Public()** 装饰器标记的端点跳过 JWT 校验
- **RolesGuard**：读取 `@Roles()` 装饰器，仅检查标注了 `@Roles()` 的端点；未标注的端点不做角色限制
- **片区隔离**：通过对比 `req.user.district` 与资源 `district` 字段实现

### 4.5 装饰器

```typescript
@Public()                          // 跳过 JWT 验证（登录端点）
@Roles(Role.ADMIN)                 // 限制角色列表
@Roles(Role.ADMIN, Role.GRID_WORKER)  // 多角色
@CurrentUser()                     // 提取完整 payload
@CurrentUser('sub')                // 提取特定字段
```

---

## 5. Users 模块

### 5.1 端点与权限矩阵

| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| POST | `/users` | ADMIN | 创建用户 |
| GET | `/users` | ADMIN | 分页列表（按 role/district/dutyStatus 筛选） |
| GET | `/users/:id` | ADMIN / 本人 | 详情（phone 按角色解密） |
| PATCH | `/users/:id` | ADMIN | 更新信息（role 不可改） |
| PATCH | `/users/:id/duty` | ADMIN / 本人 | 切换 ON_DUTY ↔ OFF_DUTY |

### 5.2 DTO

```typescript
// CreateUserDto
{
  phone: string;           // 中国手机号
  name: string;            // 姓名
  role: Role;              // 角色枚举
  password?: string;       // 非 FAMILY 角色必填
  skills?: string[];       // 技能标签
  district?: string;       // 片区
}

// UpdateUserDto — 全部可选
{ name?, skills?, district?, dutyStatus? }

// UserResponseDto
{
  id, phone?, name, role, skills[], district?,
  dutyStatus, avgResponseMin?, createdAt
}
```

### 5.3 安全规则

- 创建：非 FAMILY 角色必须设置密码；FAMILY 不允许设密码
- 查询：非 ADMIN 只能看自己；ADMIN 看全量
- 更新：`role` 字段不可通过 PATCH 修改
- 电话号码：仅 ADMIN 和本人可见明文；其他人看到 `***`

---

## 6. Elders 模块

### 6.1 端点与权限矩阵

| 方法 | 路径 | 角色 | 说明 |
|------|------|------|------|
| POST | `/elders` | ADMIN, GRID_WORKER | 创建老人档案 |
| GET | `/elders` | 全部（需登录） | 分页列表 |
| GET | `/elders/:id` | 全部 | 详情（敏感字段按角色解密） |
| PATCH | `/elders/:id` | ADMIN, GRID_WORKER | 更新档案 |
| POST | `/elders/:id/contacts` | ADMIN, GRID_WORKER | 添加紧急联系人 |
| GET | `/elders/:id/contacts` | 全部 | 查看紧急联系人 |
| GET | `/elders/:id/risk-profile` | 全部 | 风险画像聚合 |
| POST | `/elders/:id/link-family` | ADMIN | 绑定家属账号 |

### 6.2 字段加密策略

- **算法**：AES-256-GCM，`FIELD_ENCRYPTION_KEY` 环境变量提供 32 字节密钥
- **存储格式**：`iv:authTag:ciphertext` 各为 hex 编码，以 `:` 分隔存入 DB
- **加密字段**：`idCard`、`address`、`phone`（Elder / EmergencyContact）
- **加解密位置**：Service 层显式调用 `encryptField()` / `decryptField()`

### 6.3 字段可见性矩阵

| 字段 | ADMIN | 同片区 GRID_WORKER | FAMILY（绑定） | 其他 |
|------|-------|-------------------|---------------|------|
| name, gender, birthDate | ✅ | ✅ | ✅ | ✅ |
| idCard | ✅ | ❌ | ❌ | ❌ |
| address | ✅ | ✅（脱敏） | ✅ | ❌ |
| phone | ✅ | ✅ | ✅ | ❌ |
| emergencyContact.phone | ✅ | ✅ | ✅ | ❌ |
| healthTags | ✅ | ✅ | ✅ | ✅ |
| district | ✅ | ✅ | ✅ | ✅ |

### 6.4 风险画像聚合

`GET /elders/:id/risk-profile` 返回：

```typescript
{
  elderId: string;
  elderName: string;
  serviceLevel: ServiceLevel;

  stats: {
    totalCheckIns: number;         // 近30天报平安次数
    missedCheckIns: number;        // 近30天未报平安次数
    abnormalCheckIns: number;      // 近30天异常文本次数
    totalVisits: number;           // 近30天巡访次数
    activeRiskEvents: number;      // 当前未处理风险事件数
    completedWorkOrders: number;   // 近30天已完成工单数
  };

  currentRisk: {
    latestRiskEvent?: RiskEvent;   // 最近一条风险事件
    level: RiskLevel;              // 当前风险等级
    activeAlerts: number;          // 活跃预警数
  };

  recentRiskEvents: RiskEvent[];   // 最近10条
  generatedAt: string;
}
```

---

## 7. FieldEncryptionService 设计

```typescript
@Injectable()
export class FieldEncryptionService {
  private readonly key: Buffer;   // 从 FIELD_ENCRYPTION_KEY 解码

  encrypt(plaintext: string): string {
    // 1. 生成 12 字节随机 IV
    // 2. AES-256-GCM 加密
    // 3. 返回 `hex(iv):hex(authTag):hex(ciphertext)`
  }

  decrypt(ciphertext: string): string {
    // 1. 解析 iv:authTag:ciphertext
    // 2. AES-256-GCM 解密
    // 3. 返回明文
  }
}
```

---

## 8. 测试策略

### 8.1 测试覆盖目标

- 后端整体 ≥ 80%
- Auth/Users/Elders 模块 ≥ 90%
- FieldEncryptionService 100%（边界 + 异常全覆盖）

### 8.2 TDD 测试清单

**FieldEncryptionService：**
- 加密后密文 ≠ 明文
- 解密(加密(明文)) = 明文
- 相同明文两次加密密文不同（随机 IV）
- 篡改密文后解密抛异常
- 空字符串 / 超长字符串 / 特殊字符 / 中文均正常加解密

**Auth：**
- 微信登录：有效 code → 返回 token + user
- 微信登录：新用户自动创建（FAMILY 角色）
- 后台登录：正确密码 → token
- 后台登录：错误密码 → 401
- 后台登录：FAMILY 角色拒绝
- JwtAuthGuard：无 token → 401
- JwtAuthGuard：过期 token → 401
- RolesGuard：无权限角色 → 403
- @Public() 端点跳过认证

**Users：**
- ADMIN 可创建用户（含必填校验）
- 非 FAMILY 角色无密码 → 400
- ADMIN 可查看全量列表（分页/筛选）
- 非 ADMIN 只能看自己
- 更新时 role 不可改
- 本人/ADMIN 可切换在岗状态
- phone 字段按角色可见

**Elders：**
- 创建老人 → 敏感字段加密入库
- 查询老人 → ADMIN 可见全字段
- 查询老人 → 同片区 GRID_WORKER 可见脱敏地址
- 查询老人 → FAMILY 仅见绑定老人
- 查询老人 → 其他角色不可见敏感字段
- 紧急联系人 CRUD（含加密）
- 风险画像聚合 → 返回正确统计数据
- 未绑定 FAMILY 查询 → 403

### 8.3 E2E 测试

```
POST /auth/admin-login → 获取 token
  → GET /users (Bearer token) → 200 + 分页数据
  → POST /elders (Bearer token) → 201
  → GET /elders/:id/risk-profile → 200 + 聚合数据
  → 无 token 访问 /users → 401
  → FAMILY token 访问 POST /users → 403
```

---

## 9. TDD 提交计划

10 个 Conventional Commit，每个先写 RED 测试再实现：

| # | Type | Message | 内容 |
|---|------|---------|------|
| 1 | chore | add auth deps (jwt, passport, bcryptjs) | 安装依赖 |
| 2 | test | add failing tests for FieldEncryptionService | RED — 加密服务测试 |
| 3 | feat | implement FieldEncryptionService with AES-256-GCM | GREEN — 加密服务实现 |
| 4 | test | add failing tests for Auth module (guards, decorators, login) | RED — Auth 全套测试 |
| 5 | feat | implement JWT strategy, guards, decorators, wechat+admin login | GREEN — Auth 实现 |
| 6 | test | add failing tests for Users CRUD with RBAC | RED — Users 测试 |
| 7 | feat | implement Users CRUD with role/district filtering | GREEN — Users 实现 |
| 8 | test | add failing tests for Elders CRUD, encryption, risk-profile | RED — Elders 测试 |
| 9 | feat | implement Elders CRUD with field encryption and risk profile | GREEN — Elders 实现 |
| 10 | test | add Auth E2E tests for login + RBAC enforcement | E2E 测试 |

---

## 10. Definition of Done

- [ ] 微信登录 + 后台登录均可获取 JWT
- [ ] RBAC 角色权限 + 片区隔离生效
- [ ] 越权请求返回 403
- [ ] 敏感字段（idCard/address/phone）加密存储
- [ ] 字段解密按角色可见性矩阵执行
- [ ] 风险画像聚合数据正确
- [ ] 所有测试 GREEN，覆盖率 ≥ 90%
- [ ] CI lint / test / e2e / build 全绿
- [ ] Swagger 文档自动生成
