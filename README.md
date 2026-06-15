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
- Docker Desktop（用于跑 Postgres/Redis/MinIO）

### 一键启动（推荐）

项目自带跨平台一键脚本，覆盖「启基础设施 → 装依赖 → 迁移 → 种子 → 起应用」全流程。

**macOS / Linux / Git Bash：**

```bash
pnpm install          # 首次：装依赖（脚本也会在缺时自动装）
pnpm start            # 等同于 ./scripts/dev.sh：起全部
```

**Windows（cmd / PowerShell）：**

```cmd
scripts\dev.cmd
```

启动后访问：

- API: http://localhost:3000/api/v1
- Swagger: http://localhost:3000/api/docs
- Admin: http://localhost:5173
- MinIO Console: http://localhost:9001（minioadmin / minioadmin）

小程序：用「微信开发者工具」打开 `apps/miniapp`，或执行 `./scripts/dev.sh miniapp` / `scripts\dev.cmd miniapp` 编译到 `dist/dev/mp-weixin`。

### 常用命令

| 命令 | 说明 |
|------|------|
| `pnpm start` 或 `scripts\dev.cmd` | 一键：起基础设施 + 装依赖 + 迁移 + 种子 + 起 api/admin（后台） |
| `pnpm start:bootstrap` / `… bootstrap` | 同上但不启动应用（只准备环境） |
| `pnpm infra:up` / `… up` | 仅起 Postgres + Redis + MinIO |
| `pnpm infra:down` / `… down` | 停基础设施（保留数据） |
| `pnpm infra:reset` / `… reset` | 停 + 删数据卷（**不可逆**） |
| `pnpm db:migrate` / `… db:migrate` | prisma migrate dev |
| `pnpm db:seed` / `… db:seed` | prisma seed |
| `pnpm db:reset` / `… db:reset` | prisma migrate reset（**不可逆**） |
| `pnpm stop` / `… stop` | 停掉后台启动的 api/admin |
| `./scripts/dev.sh api` / `scripts\dev.cmd api` | 仅前台起 api |
| `./scripts/dev.sh admin` / `scripts\dev.cmd admin` | 仅前台起 admin |
| `./scripts/dev.sh logs api` | 跟随后台 api 日志 |

完整命令清单见 `scripts/dev.sh --help`（macOS/Linux）或 `scripts\dev.cmd help`（Windows）。

### 手动逐步启动（等价于一键脚本内部步骤）

```bash
pnpm install
pnpm infra:up
cp .env.example apps/api/.env
pnpm db:migrate
pnpm db:seed
pnpm dev          # 或 pnpm dev:admin / pnpm dev:miniapp
```

### 运行测试 / 检查 / 构建

```bash
pnpm test         # 单元测试（api 集成测试需 Docker，CI 上自动跑）
pnpm test:e2e     # E2E 测试
pnpm lint         # 代码检查
pnpm build        # 构建
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
