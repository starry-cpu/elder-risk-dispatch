# 社区独居老人照护风险预警与服务调度系统

> Community Solitary Elder Care Risk Warning & Service Dispatch System

## 技术栈

| 层级 | 技术 | 版本 |
|------|------|------|
| 运行时 | Node.js | 22.x LTS |
| 语言 | TypeScript | 5.7.x |
| 后端框架 | NestJS | 11.x |
| ORM | Prisma | 6.x |
| 数据库 | PostgreSQL | 16.x |
| 缓存/队列 | Redis | 7.x |
| 对象存储 | MinIO | latest |
| 包管理 | pnpm | 9.x |
| 管理端 | Vue 3 + Element Plus | 3.4+ / 2.x |
| 小程序 | uni-app (Vue 3) | 4.x |

## 项目结构

```
care-dispatch-system/
├── apps/
│   ├── api/           # NestJS 后端
│   ├── admin/         # Vue3 后台管理端
│   └── miniapp/       # uni-app 小程序
├── packages/
│   └── shared-types/  # 共享类型定义
├── docker/
│   └── docker-compose.yml
└── .github/workflows/ci.yml
```

## 快速开始

### 前置条件

- Node.js >= 22
- pnpm >= 9
- Docker Desktop

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动基础设施

```bash
docker compose -f docker/docker-compose.yml up -d
```

### 3. 初始化数据库

```bash
cp .env.example apps/api/.env
cd apps/api
pnpm prisma:migrate
pnpm prisma:seed
```

### 4. 启动开发服务器

```bash
pnpm dev
```

访问：
- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs
- MinIO Console: http://localhost:9001

### 5. 运行测试

```bash
# 单元测试
pnpm test

# E2E 测试
pnpm test:e2e

# 代码检查
pnpm lint

# 构建
pnpm build
```

## 开发规范

- **TDD**: 先写失败测试 -> 实现 -> 重构
- **Commit**: Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`)
- **覆盖率**: 后端 >= 80%，核心域 >= 95%
- **CI**: 所有 PR 必须通过 lint / test / e2e / build

## 环境变量

参见 `.env.example`，关键变量：

| 变量 | 说明 |
|------|------|
| `DATABASE_URL` | PostgreSQL 连接串 |
| `REDIS_URL` | Redis 连接串 |
| `JWT_SECRET` | JWT 签名密钥 |
| `FIELD_ENCRYPTION_KEY` | 字段加密密钥（AES-256-GCM, 32字节 base64） |
| `S3_ENDPOINT` | 对象存储地址 |

## License

Private
