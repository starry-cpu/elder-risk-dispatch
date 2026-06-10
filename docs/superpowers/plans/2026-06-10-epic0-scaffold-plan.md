# Epic 0：工程脚手架实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the pnpm monorepo scaffold with NestJS backend skeleton, Prisma database layer, Docker Compose infrastructure, and GitHub Actions CI pipeline.

**Architecture:** Linear build-up — monorepo → Docker → Prisma schema + client gen → RED tests → GREEN implementation → migration + seed → E2E → CI → README. Prisma schema is created early so `@prisma/client` types are available for TDD.

**Tech Stack:** Node.js 22 LTS, pnpm 9.x, TypeScript 5.7, NestJS 11.x, Prisma 6.x, PostgreSQL 16, Redis 7, Docker Compose, GitHub Actions

**6 Commits:**
1. `chore: init pnpm monorepo workspace` — root configs, ESLint, Prettier, commitlint, placeholders
2. `chore: add docker compose for pg redis minio` — docker-compose.yml, .env.example
3. `test: add failing tests for prisma service and global filters` — RED tests
4. `feat: implement nestjs skeleton with prisma, filters, interceptors, swagger` — GREEN implementation
5. `feat: add prisma schema migration and seed with risk rules` — migration run + seed
6. `chore: add ci workflow and readme` — CI + README.md

---

## File Map

| File | Responsibility |
|------|---------------|
| `package.json` (root) | Monorepo scripts, shared devDependencies |
| `pnpm-workspace.yaml` | Declare `apps/*` and `packages/*` |
| `.npmrc` | `shamefully-hoist=true` |
| `.nvmrc` | Pin Node.js 22 |
| `.gitignore` | Exclude node_modules, dist, .env, coverage |
| `.prettierrc` | singleQuote, trailingComma, 120 width |
| `eslint.config.mjs` | Flat config, @typescript-eslint |
| `commitlint.config.js` | Conventional Commits rules |
| `tsconfig.base.json` | strict, decorators, ES2023 |
| `docker/docker-compose.yml` | PG 16 + Redis 7 + MinIO |
| `.env.example` | All env vars template |
| `apps/api/package.json` | NestJS 11 + Prisma 6 + test deps |
| `apps/api/tsconfig.json` | Extends base, outDir dist |
| `apps/api/nest-cli.json` | @nestjs/schematics, deleteOutDir |
| `apps/api/jest.config.ts` | ts-jest, src rootDir |
| `apps/api/prisma/schema.prisma` | Full data model (15 models) |
| `apps/api/prisma/seed.ts` | 6 risk rules |
| `apps/api/src/main.ts` | Bootstrap: Swagger, global pipes/filters/interceptors |
| `apps/api/src/app.module.ts` | Root module |
| `apps/api/src/common/dto/api-response.dto.ts` | `{ code, data, message }` |
| `apps/api/src/common/prisma/prisma.module.ts` | @Global() module |
| `apps/api/src/common/prisma/prisma.service.ts` | extends PrismaClient, OnModuleInit |
| `apps/api/src/common/prisma/prisma.service.spec.ts` | Unit test |
| `apps/api/src/common/filters/all-exceptions.filter.ts` | ExceptionFilter |
| `apps/api/src/common/filters/all-exceptions.filter.spec.ts` | Unit test |
| `apps/api/src/common/interceptors/response.interceptor.ts` | NestInterceptor |
| `apps/api/src/common/interceptors/response.interceptor.spec.ts` | Unit test |
| `apps/api/src/modules/health/health.module.ts` | Module |
| `apps/api/src/modules/health/health.controller.ts` | GET /api/v1/health |
| `apps/api/src/modules/health/health.controller.spec.ts` | Unit test |
| `apps/api/test/setup.ts` | Testcontainers global setup |
| `apps/api/test/app.e2e-spec.ts` | E2E: health endpoint |
| `apps/api/test/jest-e2e.json` | E2E Jest config |
| `.github/workflows/ci.yml` | lint / test / e2e / build |
| `README.md` | Project intro + quick start |

---

### Task 0: Install pnpm globally

- [ ] **Step 1: Install pnpm 9.x**

```bash
npm install -g pnpm@9
```

- [ ] **Step 2: Verify**

```bash
pnpm --version
```

Expected: `9.x.x`

---

### Task 1: Root package.json and workspace config

**Files created:** `package.json`, `pnpm-workspace.yaml`, `.npmrc`

- [ ] **Step 1: Create root package.json**

```json
{
  "name": "care-dispatch-system",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter api dev",
    "build": "pnpm -r build",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter api test:e2e",
    "format": "prettier --write \"**/*.{ts,js,json,mjs,cjs,md}\"",
    "format:check": "prettier --check \"**/*.{ts,js,json,mjs,cjs,md}\"",
    "prepare": "husky"
  },
  "devDependencies": {
    "@commitlint/cli": "^19.0.0",
    "@commitlint/config-conventional": "^19.0.0",
    "@typescript-eslint/eslint-plugin": "^8.0.0",
    "@typescript-eslint/parser": "^8.0.0",
    "eslint": "^9.0.0",
    "husky": "^9.0.0",
    "prettier": "^3.0.0",
    "typescript": "~5.7.3"
  },
  "engines": {
    "node": ">=22.0.0",
    "pnpm": ">=9.0.0"
  }
}
```

- [ ] **Step 2: Create pnpm-workspace.yaml**

```yaml
packages:
  - "apps/*"
  - "packages/*"
```

- [ ] **Step 3: Create .npmrc**

```
shamefully-hoist=true
strict-peer-dependencies=false
```

- [ ] **Step 4: Install**

```bash
pnpm install
```

- [ ] **Step 5: Commit**

```bash
git add package.json pnpm-workspace.yaml .npmrc pnpm-lock.yaml
git commit -m "chore: init pnpm monorepo workspace"
```

---

### Task 2: TypeScript, ESLint, Prettier, git configs

**Files created:** `tsconfig.base.json`, `.prettierrc`, `eslint.config.mjs`, `.nvmrc`, `.gitignore`

- [ ] **Step 1: Create tsconfig.base.json**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "commonjs",
    "lib": ["ES2023"],
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "removeComments": true,
    "emitDecoratorMetadata": true,
    "experimentalDecorators": true,
    "allowSyntheticDefaultImports": true,
    "incremental": true,
    "noUnusedLocals": false,
    "noUnusedParameters": false,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

- [ ] **Step 2: Create .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "trailingComma": "all",
  "printWidth": 120,
  "tabWidth": 2,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

- [ ] **Step 3: Create eslint.config.mjs**

```javascript
import eslint from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';

export default [
  eslint.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        project: ['./tsconfig.base.json', './apps/*/tsconfig.json'],
        tsconfigRootDir: import.meta.dirname,
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
    },
  },
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/*.js', '**/*.mjs'],
  },
];
```

- [ ] **Step 4: Create .nvmrc**

```
22
```

- [ ] **Step 5: Create .gitignore**

```
node_modules/
dist/
.env
*.log
coverage/
.turbo/
.cache/
*.tsbuildinfo
docker/data/
```

- [ ] **Step 6: Commit**

```bash
git add tsconfig.base.json .prettierrc eslint.config.mjs .nvmrc .gitignore
git commit -m "chore: add tsconfig, eslint, prettier, and gitignore configs"
```

---

### Task 3: commitlint and husky

**Files created:** `commitlint.config.js`, `.husky/commit-msg`

- [ ] **Step 1: Create commitlint.config.js**

```javascript
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'test', 'refactor', 'docs', 'chore', 'perf', 'ci']],
    'subject-case': [0],
  },
};
```

- [ ] **Step 2: Initialize husky**

```bash
pnpm exec husky init
```

- [ ] **Step 3: Create commit-msg hook**

```bash
echo "pnpm exec commitlint --edit \$1" > .husky/commit-msg
```

- [ ] **Step 4: Verify hook content**

```bash
cat .husky/commit-msg
```

Expected: `pnpm exec commitlint --edit $1`

- [ ] **Step 5: Commit**

```bash
git add commitlint.config.js .husky/commit-msg
git commit -m "chore: add commitlint with husky hook"
```

---

### Task 4: Placeholder apps and packages

**Files created:** `apps/admin/package.json`, `apps/miniapp/package.json`, `packages/shared-types/package.json`, `packages/shared-types/src/index.ts`

- [ ] **Step 1: Create apps/admin/package.json**

```json
{
  "name": "@care/admin",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "echo 'admin placeholder'",
    "build": "echo 'admin build placeholder'",
    "lint": "echo 'admin lint placeholder'",
    "test": "echo 'admin test placeholder'"
  }
}
```

- [ ] **Step 2: Create apps/miniapp/package.json**

```json
{
  "name": "@care/miniapp",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev": "echo 'miniapp placeholder'",
    "build": "echo 'miniapp build placeholder'",
    "lint": "echo 'miniapp lint placeholder'",
    "test": "echo 'miniapp test placeholder'"
  }
}
```

- [ ] **Step 3: Create packages/shared-types/package.json**

```json
{
  "name": "@care/shared-types",
  "version": "0.0.1",
  "private": true,
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "lint": "echo 'shared-types lint placeholder'",
    "test": "echo 'shared-types test placeholder'"
  }
}
```

- [ ] **Step 4: Create packages/shared-types/src/index.ts**

```typescript
// Shared types and enums — to be populated in Epic 1+
export {};
```

- [ ] **Step 5: Verify workspace resolution**

```bash
pnpm list --depth 0 --recursive
```

Expected: lists `care-dispatch-system`, `@care/admin`, `@care/miniapp`, `@care/shared-types`

- [ ] **Step 6: Commit**

```bash
git add apps/ packages/
git commit -m "chore: add placeholder apps and shared-types package"
```

---

### Task 5: Docker Compose infrastructure

**Files created:** `docker/docker-compose.yml`, `.env.example`

- [ ] **Step 1: Create docker/docker-compose.yml**

```yaml
version: "3.9"

services:
  postgres:
    image: postgres:16-alpine
    container_name: care-postgres
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: care
    ports:
      - "5436:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U app -d care"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    container_name: care-redis
    ports:
      - "6383:6379"
    volumes:
      - redisdata:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  minio:
    image: minio/minio:latest
    container_name: care-minio
    command: server /data --console-address ":9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    ports:
      - "9000:9000"
      - "9001:9001"
    volumes:
      - miniodata:/data
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:9000/minio/health/live"]
      interval: 10s
      timeout: 5s
      retries: 5
    restart: unless-stopped

  minio-create-bucket:
    image: minio/mc:latest
    depends_on:
      minio:
        condition: service_healthy
    entrypoint: >
      /bin/sh -c "
      /usr/bin/mc alias set local http://minio:9000 minioadmin minioadmin;
      /usr/bin/mc mb local/care --ignore-existing;
      echo 'MinIO bucket care ready';
      exit 0;
      "

volumes:
  pgdata:
  redisdata:
  miniodata:
```

- [ ] **Step 2: Create .env.example**

```bash
# ========== Database & Cache ==========
DATABASE_URL=postgresql://app:app@localhost:5436/care
REDIS_URL=redis://localhost:6383

# ========== JWT ==========
JWT_SECRET=change_me_to_random_64_chars
JWT_EXPIRES_IN=7d

# ========== Field Encryption (AES-256-GCM, 32 bytes base64) ==========
FIELD_ENCRYPTION_KEY=AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=

# ========== WeChat Mini Program ==========
WECHAT_APPID=
WECHAT_SECRET=

# ========== DeepSeek AI (OpenAI compatible) ==========
OPENAI_API_KEY=
OPENAI_BASE_URL=https://api.deepseek.com
AI_MODEL=deepseek-chat

# ========== Object Storage (MinIO dev / Alibaba OSS prod) ==========
S3_ENDPOINT=http://localhost:9000
S3_ACCESS_KEY=minioadmin
S3_SECRET_KEY=minioadmin
S3_BUCKET=care
```

- [ ] **Step 3: Start services and verify**

```bash
docker compose -f docker/docker-compose.yml up -d
docker compose -f docker/docker-compose.yml ps
```

Expected: `care-postgres`, `care-redis`, `care-minio` all `Up` + `healthy`.

- [ ] **Step 4: Quick health checks**

```bash
docker exec care-postgres pg_isready -U app -d care
docker exec care-redis redis-cli ping
```

Expected: `accepting connections` and `PONG`.

- [ ] **Step 5: Commit**

```bash
git add docker/docker-compose.yml .env.example
git commit -m "chore: add docker compose for pg redis minio"
```

---

### Task 6: NestJS app — package.json and configs

**Files created:** `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/nest-cli.json`

- [ ] **Step 1: Create apps/api/package.json**

```json
{
  "name": "@care/api",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "build": "nest build",
    "dev": "nest start --watch",
    "start": "nest start",
    "start:prod": "node dist/main",
    "lint": "eslint \"{src,test}/**/*.ts\" --fix",
    "test": "jest",
    "test:watch": "jest --watch",
    "test:cov": "jest --coverage",
    "test:e2e": "jest --config ./test/jest-e2e.json --forceExit",
    "prisma:generate": "prisma generate",
    "prisma:migrate": "prisma migrate dev",
    "prisma:seed": "ts-node prisma/seed.ts"
  },
  "prisma": {
    "seed": "ts-node prisma/seed.ts"
  },
  "dependencies": {
    "@nestjs/common": "^11.0.0",
    "@nestjs/config": "^4.0.0",
    "@nestjs/core": "^11.0.0",
    "@nestjs/platform-express": "^11.0.0",
    "@nestjs/swagger": "^8.0.0",
    "@prisma/client": "^6.0.0",
    "class-transformer": "^0.5.0",
    "class-validator": "^0.14.0",
    "nestjs-pino": "^4.0.0",
    "pino": "^9.0.0",
    "reflect-metadata": "^0.2.0",
    "rxjs": "^7.8.0"
  },
  "devDependencies": {
    "@nestjs/cli": "^11.0.0",
    "@nestjs/schematics": "^11.0.0",
    "@nestjs/testing": "^11.0.0",
    "@testcontainers/postgresql": "^10.0.0",
    "@types/express": "^5.0.0",
    "@types/jest": "^29.0.0",
    "@types/node": "^22.0.0",
    "@types/supertest": "^6.0.0",
    "jest": "^29.0.0",
    "prisma": "^6.0.0",
    "supertest": "^7.0.0",
    "testcontainers": "^10.0.0",
    "ts-jest": "^29.0.0",
    "ts-node": "^10.0.0"
  }
}
```

- [ ] **Step 2: Create apps/api/tsconfig.json**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "baseUrl": "./",
    "paths": {
      "@src/*": ["src/*"]
    }
  },
  "include": ["src/**/*.ts", "test/**/*.ts", "prisma/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

- [ ] **Step 3: Create apps/api/nest-cli.json**

```json
{
  "$schema": "https://json.schemastore.org/nest-cli",
  "collection": "@nestjs/schematics",
  "sourceRoot": "src",
  "compilerOptions": {
    "deleteOutDir": true
  }
}
```

- [ ] **Step 4: Install dependencies and verify**

```bash
pnpm install
cd apps/api && pnpm exec nest --version
```

Expected: NestJS CLI version printed, no install errors.

---

### Task 7: Prisma schema file + client generation

**Files created:** `apps/api/prisma/schema.prisma`, `apps/api/.env`

> This must happen BEFORE writing tests, because `PrismaService` extends `PrismaClient` from `@prisma/client`, which requires a generated client.

- [ ] **Step 1: Copy .env.example to apps/api/.env**

```bash
cp .env.example apps/api/.env
```

- [ ] **Step 2: Create apps/api/prisma/schema.prisma**

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  GRID_WORKER
  COMMUNITY_DOCTOR
  PROPERTY
  VOLUNTEER
  ADMIN
  FAMILY
}

enum DutyStatus {
  ON_DUTY
  OFF_DUTY
}

enum ServiceLevel {
  NORMAL
  KEY
  HIGH
}

enum CheckInMethod {
  ONE_TAP
  VOICE
  TEXT
  PROXY
}

enum CheckInStatus {
  NORMAL
  ABNORMAL
  MISSED
}

enum RiskLevel {
  LOW
  MEDIUM
  HIGH
}

enum RiskSource {
  MISSED_CHECKIN
  ABNORMAL_TEXT
  DEVICE
  HISTORY
  MANUAL
}

enum RiskStatus {
  PENDING_REVIEW
  CONFIRMED
  IGNORED
  DISPATCHED
}

enum WorkOrderType {
  HEALTH
  LIFE
  REPAIR
  ESCORT
  COMPANION
  ERRAND
}

enum WorkOrderStatus {
  PENDING
  ASSIGNED
  IN_PROGRESS
  COMPLETED
  CANCELLED
}

model User {
  id             String      @id @default(cuid())
  openid         String?     @unique
  unionid        String?
  phone          String?     @unique
  name           String
  role           Role
  passwordHash   String?
  skills         String[]    @default([])
  district       String?
  dutyStatus     DutyStatus  @default(OFF_DUTY)
  avgResponseMin Int?
  createdAt      DateTime    @default(now())
  visits         VisitRecord[]
  workOrders     WorkOrder[] @relation("assignee")
  familyLinks    ElderFamilyLink[]
}

model Elder {
  id           String        @id @default(cuid())
  name         String
  gender       String?
  birthDate    DateTime?
  idCard       String?
  address      String?
  district     String
  longitude    Float?
  latitude     Float?
  healthTags   String[]      @default([])
  serviceLevel ServiceLevel  @default(NORMAL)
  livingStatus String?
  createdAt    DateTime      @default(now())
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
  phone     String
  isPrimary Boolean @default(false)
  elder     Elder   @relation(fields: [elderId], references: [id], onDelete: Cascade)

  @@index([elderId])
}

model ElderFamilyLink {
  id       String @id @default(cuid())
  elderId  String
  userId   String
  relation String
  elder    Elder  @relation(fields: [elderId], references: [id], onDelete: Cascade)
  user     User   @relation(fields: [userId], references: [id], onDelete: Cascade)

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
  elder     Elder         @relation(fields: [elderId], references: [id], onDelete: Cascade)

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
  elder        Elder    @relation(fields: [elderId], references: [id], onDelete: Cascade)
  gridWorker   User     @relation(fields: [gridWorkerId], references: [id])
}

model DeviceData {
  id         String   @id @default(cuid())
  elderId    String
  deviceType String
  metricType String
  value      String?
  alarm      Boolean  @default(false)
  status     String?
  timestamp  DateTime @default(now())
  elder      Elder    @relation(fields: [elderId], references: [id], onDelete: Cascade)

  @@index([elderId, timestamp])
}

model RiskEvent {
  id          String     @id @default(cuid())
  elderId     String
  level       RiskLevel
  source      RiskSource
  score       Int
  reason      String
  status      RiskStatus @default(PENDING_REVIEW)
  reviewedBy  String?
  ruleVersion String?
  createdAt   DateTime   @default(now())
  elder       Elder      @relation(fields: [elderId], references: [id], onDelete: Cascade)
  workOrder   WorkOrder?

  @@index([elderId, status])
}

model WorkOrder {
  id             String             @id @default(cuid())
  riskEventId    String?            @unique
  elderId        String
  type           WorkOrderType
  level          RiskLevel
  assigneeId     String?
  status         WorkOrderStatus    @default(PENDING)
  deadline       DateTime?
  dispatchReason String?
  result         String?
  completedAt    DateTime?
  createdById    String
  createdAt      DateTime           @default(now())
  elder          Elder              @relation(fields: [elderId], references: [id], onDelete: Cascade)
  riskEvent      RiskEvent?         @relation(fields: [riskEventId], references: [id])
  assignee       User?              @relation("assignee", fields: [assigneeId], references: [id])
  timeline       WorkOrderTimeline[]
  evaluation     ServiceEvaluation?

  @@index([status, deadline])
}

model WorkOrderTimeline {
  id          String    @id @default(cuid())
  workOrderId String
  action      String
  operatorId  String?
  note        String?
  createdAt   DateTime  @default(now())
  workOrder   WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
}

model ServiceEvaluation {
  id          String    @id @default(cuid())
  workOrderId String    @unique
  rating      Int
  comment     String?
  tags        String[]  @default([])
  createdAt   DateTime  @default(now())
  workOrder   WorkOrder @relation(fields: [workOrderId], references: [id], onDelete: Cascade)
}

model RiskRule {
  id          String   @id @default(cuid())
  name        String
  condition   Json
  weight      Int
  level       RiskLevel
  version     Int      @default(1)
  enabled     Boolean  @default(true)
  createdById String?
  updatedAt   DateTime @updatedAt
}

model AiInferenceLog {
  id              String   @id @default(cuid())
  type            String
  model           String
  input           Json
  output          Json
  humanCorrection Json?
  createdAt       DateTime @default(now())
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
  id         String    @id @default(cuid())
  targetType String
  targetId   String
  channel    String
  templateId String?
  payload    Json
  status     String    @default("PENDING")
  sentAt     DateTime?
  createdAt  DateTime  @default(now())
}
```

- [ ] **Step 3: Generate Prisma client**

```bash
cd apps/api && pnpm prisma:generate
```

Expected: `@prisma/client` generated successfully in `node_modules/.prisma/client/`.

---

### Task 8: Jest configuration

**Files created:** `apps/api/jest.config.ts`, `apps/api/test/jest-e2e.json`

- [ ] **Step 1: Create apps/api/jest.config.ts**

```typescript
import type { Config } from 'jest';

const config: Config = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: 'src',
  testRegex: '.*\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
  collectCoverageFrom: ['**/*.(t|j)s'],
  coverageDirectory: '../coverage',
  testEnvironment: 'node',
  moduleNameMapper: {
    '^@src/(.*)$': '<rootDir>/$1',
  },
};

export default config;
```

- [ ] **Step 2: Create apps/api/test/jest-e2e.json**

```json
{
  "moduleFileExtensions": ["js", "json", "ts"],
  "rootDir": "..",
  "testEnvironment": "node",
  "testRegex": ".e2e-spec.ts$",
  "transform": {
    "^.+\\.ts$": "ts-jest"
  },
  "moduleNameMapper": {
    "^@src/(.*)$": "<rootDir>/src/$1"
  },
  "globalSetup": "<rootDir>/test/setup.ts"
}
```

- [ ] **Step 3: Verify Jest loads the config**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts --listTests
```

Expected: No errors (no test files yet, but config is valid).

---

### Task 9: RED — Write failing test for PrismaService

**Files created:** `apps/api/src/common/prisma/prisma.service.ts` (stub), `apps/api/src/common/prisma/prisma.service.spec.ts` (test)

- [ ] **Step 1: Create minimal stub**

```typescript
// apps/api/src/common/prisma/prisma.service.ts
// STUB — will be fully implemented in GREEN phase.
export class PrismaService {}
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/api/src/common/prisma/prisma.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have a $connect method', () => {
    expect(typeof (service as any).$connect).toBe('function');
  });

  it('should have a $disconnect method', () => {
    expect(typeof (service as any).$disconnect).toBe('function');
  });

  it('should have an onModuleInit method', () => {
    expect(typeof (service as any).onModuleInit).toBe('function');
  });
});
```

- [ ] **Step 3: Run test — verify RED**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts prisma.service.spec.ts
```

Expected: 3 of 4 tests FAIL (stub has no `$connect`, `$disconnect`, `onModuleInit`).

---

### Task 10: RED — Write failing test for AllExceptionsFilter

**Files created:** `apps/api/src/common/filters/all-exceptions.filter.ts` (stub), `apps/api/src/common/filters/all-exceptions.filter.spec.ts`

- [ ] **Step 1: Create minimal stub**

```typescript
// apps/api/src/common/filters/all-exceptions.filter.ts
// STUB — will be fully implemented in GREEN phase.
export class AllExceptionsFilter {}
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/api/src/common/filters/all-exceptions.filter.spec.ts
import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  function createMockHost(): { host: ArgumentsHost; responseBody: Record<string, unknown> } {
    const responseBody: Record<string, unknown> = {};
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((body: Record<string, unknown>) => {
        Object.assign(responseBody, body);
      }),
    };
    const request = { url: '/test', method: 'GET' };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;
    return { host, responseBody };
  }

  it('should catch HttpException and return its status with message', () => {
    const { host, responseBody } = createMockHost();
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, host);

    expect(responseBody.code).toBe(403);
    expect(responseBody.data).toBeNull();
    expect(responseBody.message).toBe('Forbidden');
  });

  it('should catch unknown errors and return 500 with generic message', () => {
    const { host, responseBody } = createMockHost();
    const exception = new Error('Database connection failed');

    filter.catch(exception, host);

    expect(responseBody.code).toBe(500);
    expect(responseBody.data).toBeNull();
    expect(responseBody.message).toBe('Internal server error');
  });

  it('should handle HttpException with object response', () => {
    const { host, responseBody } = createMockHost();
    const exception = new HttpException(
      { message: ['name should not be empty', 'age must be positive'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);
    expect(responseBody.code).toBe(400);
    expect(responseBody.data).toBeNull();
  });
});
```

- [ ] **Step 3: Run test — verify RED**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts all-exceptions.filter.spec.ts
```

Expected: 3 tests FAIL (stub has no `catch` method).

---

### Task 11: RED — Write failing test for ResponseInterceptor

**Files created:** `apps/api/src/common/interceptors/response.interceptor.ts` (stub), `apps/api/src/common/interceptors/response.interceptor.spec.ts`

- [ ] **Step 1: Create minimal stub**

```typescript
// apps/api/src/common/interceptors/response.interceptor.ts
// STUB — will be fully implemented in GREEN phase.
export class ResponseInterceptor {}
```

- [ ] **Step 2: Write the failing test**

```typescript
// apps/api/src/common/interceptors/response.interceptor.spec.ts
import { ResponseInterceptor } from './response.interceptor';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor;

  beforeEach(() => {
    interceptor = new ResponseInterceptor();
  });

  function createMockContext(statusCode = 200): ExecutionContext {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
        getRequest: () => ({}),
      }),
    } as ExecutionContext;
  }

  function createCallHandler<T>(data: T): CallHandler {
    return { handle: () => of(data) };
  }

  it('should wrap plain response data in ApiResponse format', (done) => {
    const context = createMockContext(200);
    const handler = createCallHandler({ name: 'test', id: 1 });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({
        code: 0,
        data: { name: 'test', id: 1 },
        message: 'ok',
      });
      done();
    });
  });

  it('should pass through already-wrapped responses', (done) => {
    const context = createMockContext(200);
    const handler = createCallHandler({ code: 0, data: { a: 1 }, message: 'ok' });

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({ code: 0, data: { a: 1 }, message: 'ok' });
      done();
    });
  });

  it('should handle null data', (done) => {
    const context = createMockContext(200);
    const handler = createCallHandler(null);

    interceptor.intercept(context, handler).subscribe((result) => {
      expect(result).toEqual({ code: 0, data: null, message: 'ok' });
      done();
    });
  });
});
```

- [ ] **Step 3: Run test — verify RED**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts response.interceptor.spec.ts
```

Expected: 3 tests FAIL (stub has no `intercept` method).

---

### Task 12: RED — Verify all tests are RED and commit

- [ ] **Step 1: Run full test suite**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts
```

Expected: all tests FAIL (11 tests, all RED).

- [ ] **Step 2: Commit RED tests**

```bash
git add apps/api/src/common/ apps/api/jest.config.ts apps/api/test/jest-e2e.json
git commit -m "test: add failing tests for prisma service and global filters"
```

---

### Task 13: GREEN — Implement ApiResponseDto

**Files created:** `apps/api/src/common/dto/api-response.dto.ts`

- [ ] **Step 1: Create ApiResponseDto**

```typescript
import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T = unknown> {
  @ApiProperty({ description: '状态码，0 表示成功' })
  code: number;

  @ApiProperty({ description: '响应数据' })
  data?: T;

  @ApiProperty({ description: '响应消息' })
  message: string;

  static success<T>(data: T, message = 'ok'): ApiResponseDto<T> {
    return { code: 0, data, message };
  }

  static error(code: number, message: string): ApiResponseDto<null> {
    return { code, data: null, message };
  }
}
```

---

### Task 14: GREEN — Implement PrismaModule and PrismaService

**Files created:** `apps/api/src/common/prisma/prisma.module.ts`
**Files modified:** `apps/api/src/common/prisma/prisma.service.ts` (replace stub)

- [ ] **Step 1: Implement PrismaModule**

```typescript
import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
```

- [ ] **Step 2: Implement PrismaService (replace stub)**

```typescript
import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  async onModuleInit() {
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}
```

- [ ] **Step 3: Run test — verify GREEN**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts prisma.service.spec.ts
```

Expected: 4 tests PASS.

---

### Task 15: GREEN — Implement AllExceptionsFilter

**Files modified:** `apps/api/src/common/filters/all-exceptions.filter.ts` (replace stub)
**Files modified:** `apps/api/src/common/filters/all-exceptions.filter.spec.ts` (test imports already correct; needs `catch` → the implementation now provides it)

- [ ] **Step 1: Implement AllExceptionsFilter**

```typescript
import { ExceptionFilter, Catch, ArgumentsHost, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status: number;
    let message: string;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      message =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : (exceptionResponse as Record<string, unknown>).message?.toString() || exception.message;
    } else {
      status = HttpStatus.INTERNAL_SERVER_ERROR;
      message = 'Internal server error';
      const error = exception instanceof Error ? exception : new Error(String(exception));
      this.logger.error(
        { url: request.url, method: request.method, stack: error.stack },
        error.message,
      );
    }

    response.status(status).json({
      code: status,
      data: null,
      message,
    });
  }
}
```

- [ ] **Step 2: Run test — verify GREEN**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts all-exceptions.filter.spec.ts
```

Expected: 3 tests PASS.

---

### Task 16: GREEN — Implement ResponseInterceptor

**Files modified:** `apps/api/src/common/interceptors/response.interceptor.ts` (replace stub)

- [ ] **Step 1: Implement ResponseInterceptor**

```typescript
import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface WrappedResponse<T> {
  code: number;
  data: T;
  message: string;
}

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, WrappedResponse<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<WrappedResponse<T>> {
    return next.handle().pipe(
      map((data) => {
        if (data && typeof data === 'object' && 'code' in data && 'message' in data) {
          return data as WrappedResponse<T>;
        }
        return {
          code: 0,
          data,
          message: 'ok',
        };
      }),
    );
  }
}
```

- [ ] **Step 2: Run test — verify GREEN**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts response.interceptor.spec.ts
```

Expected: 3 tests PASS.

---

### Task 17: GREEN — Implement HealthController and HealthModule

**Files created:** `apps/api/src/modules/health/health.module.ts`, `apps/api/src/modules/health/health.controller.ts`, `apps/api/src/modules/health/health.controller.spec.ts`

- [ ] **Step 1: Create HealthModule**

```typescript
import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({
  controllers: [HealthController],
})
export class HealthModule {}
```

- [ ] **Step 2: Create HealthController**

```typescript
import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { PrismaService } from '../../common/prisma/prisma.service';

@ApiTags('Health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @ApiOperation({ summary: '健康检查 — 验证服务和数据库连通性' })
  async check() {
    let db = false;
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      db = true;
    } catch {
      db = false;
    }
    return { status: 'ok', db };
  }
}
```

- [ ] **Step 3: Create HealthController unit test**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('HealthController', () => {
  let controller: HealthController;
  let prisma: PrismaService;

  beforeEach(async () => {
    const mockPrisma = {
      $queryRaw: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('check() should return status ok and db true when DB is connected', async () => {
    (prisma.$queryRaw as jest.Mock).mockResolvedValue([{ 1: 1 }]);

    const result = await controller.check();

    expect(result).toEqual({ status: 'ok', db: true });
    expect(prisma.$queryRaw).toHaveBeenCalled();
  });

  it('check() should return db false when DB query fails', async () => {
    (prisma.$queryRaw as jest.Mock).mockRejectedValue(new Error('Connection refused'));

    const result = await controller.check();

    expect(result).toEqual({ status: 'ok', db: false });
  });
});
```

- [ ] **Step 4: Run test — verify GREEN**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts health
```

Expected: 3 tests PASS.

---

### Task 18: GREEN — Implement main.ts and app.module.ts

**Files created:** `apps/api/src/main.ts`, `apps/api/src/app.module.ts`

- [ ] **Step 1: Create app.module.ts**

```typescript
import { Module } from '@nestjs/common';
import { PrismaModule } from './common/prisma/prisma.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [PrismaModule, HealthModule],
})
export class AppModule {}
```

- [ ] **Step 2: Create main.ts**

```typescript
import { NestFactory } from '@nestjs/core';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.setGlobalPrefix('api/v1');

  app.enableCors({
    origin: true,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalInterceptors(new ResponseInterceptor());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('社区独居老人照护风险预警与服务调度系统')
      .setDescription('API documentation for care dispatch system')
      .setVersion('0.1.0')
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Application running on http://localhost:${port}`);
  console.log(`Swagger docs: http://localhost:${port}/api/docs`);
}

bootstrap();
```

- [ ] **Step 3: Verify build passes**

```bash
cd apps/api && pnpm build
```

Expected: `tsc` compiles without errors, `dist/main.js` exists.

- [ ] **Step 4: Run full unit test suite — all GREEN**

```bash
cd apps/api && pnpm exec jest --config jest.config.ts
```

Expected: all 13 tests PASS.

- [ ] **Step 5: Commit GREEN implementation**

```bash
git add apps/api/
git commit -m "feat: implement nestjs skeleton with prisma, filters, interceptors, swagger"
```

---

### Task 19: Run Prisma migration and seed

**Files created:** `apps/api/prisma/migrations/*` (auto-generated), `apps/api/prisma/seed.ts`

- [ ] **Step 1: Run first migration against local PostgreSQL**

```bash
cd apps/api && pnpm prisma:migrate --name initial_schema
```

Expected: migration files created, all 15 tables created in PostgreSQL.

- [ ] **Step 2: Verify tables exist**

```bash
docker exec care-postgres psql -U app -d care -c "\dt"
```

Expected: 15 tables listed (User, Elder, EmergencyContact, ElderFamilyLink, CheckIn, VisitRecord, DeviceData, RiskEvent, RiskRule, WorkOrder, WorkOrderTimeline, ServiceEvaluation, AiInferenceLog, AuditLog, Notification).

- [ ] **Step 3: Create apps/api/prisma/seed.ts**

```typescript
import { PrismaClient, RiskLevel } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding risk rules...');

  const rules = [
    {
      name: '连续未报平安',
      condition: {
        description: '24小时内无报平安记录',
        field: 'hoursSinceLastCheckIn',
        operator: 'gte',
        value: 24,
      },
      weight: 40,
      level: RiskLevel.MEDIUM,
      version: 1,
      enabled: true,
    },
    {
      name: '设备跌倒报警',
      condition: {
        description: '设备检测到跌倒并触发报警',
        field: 'metricType',
        operator: 'eq',
        value: 'FALL',
        requireAlarm: true,
      },
      weight: 60,
      level: RiskLevel.HIGH,
      version: 1,
      enabled: true,
    },
    {
      name: '烟感/水浸报警',
      condition: {
        description: '烟感或水浸传感器触发报警',
        field: 'metricType',
        operator: 'in',
        value: ['SMOKE', 'WATER'],
        requireAlarm: true,
      },
      weight: 50,
      level: RiskLevel.HIGH,
      version: 1,
      enabled: true,
    },
    {
      name: '异常文本',
      condition: {
        description: 'AI分类识别到求助或异常表达',
        field: 'aiClassification',
        operator: 'in',
        value: ['求助', '异常'],
      },
      weight: 30,
      level: RiskLevel.MEDIUM,
      version: 1,
      enabled: true,
    },
    {
      name: '高龄+慢病叠加',
      condition: {
        description: '年龄≥80且带有慢性病标签',
        field: 'age',
        operator: 'gte',
        value: 80,
        requireChronicDisease: true,
      },
      weight: 15,
      level: RiskLevel.MEDIUM,
      version: 1,
      enabled: true,
    },
    {
      name: '近7天高风险史',
      condition: {
        description: '近7天内有HIGH级别风险事件记录',
        field: 'recentHighRisk',
        operator: 'eq',
        value: true,
        lookbackDays: 7,
      },
      weight: 10,
      level: RiskLevel.MEDIUM,
      version: 1,
      enabled: true,
    },
  ];

  for (const rule of rules) {
    const existing = await prisma.riskRule.findFirst({
      where: { name: rule.name, version: rule.version },
    });
    if (!existing) {
      await prisma.riskRule.create({ data: rule });
      console.log(`  Created rule: ${rule.name}`);
    } else {
      console.log(`  Skipped (already exists): ${rule.name}`);
    }
  }

  console.log('Seed completed.');
}

main()
  .catch((e) => {
    console.error('Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
```

- [ ] **Step 4: Run seed**

```bash
cd apps/api && pnpm prisma:seed
```

Expected: `Created rule:` for all 6 rules, `Seed completed.`

- [ ] **Step 5: Verify seed data**

```bash
docker exec care-postgres psql -U app -d care -c "SELECT name, weight, level::text FROM \"RiskRule\";"
```

Expected: 6 rows.

- [ ] **Step 6: Commit**

```bash
git add apps/api/prisma/
git commit -m "feat: add prisma schema migration and seed with risk rules"
```

---

### Task 20: E2E test with Testcontainers

**Files created:** `apps/api/test/setup.ts`, `apps/api/test/app.e2e-spec.ts`

- [ ] **Step 1: Create apps/api/test/setup.ts**

```typescript
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { execSync } from 'child_process';
import * as path from 'path';

declare global {
  var __PG_CONTAINER__: StartedPostgreSqlContainer | undefined;
}

export default async function globalSetup() {
  console.log('Starting PostgreSQL test container...');
  const pgContainer = await new PostgreSqlContainer('postgres:16-alpine')
    .withDatabase('care_test')
    .withUsername('test')
    .withPassword('test')
    .start();

  const url = pgContainer.getConnectionUri();
  process.env.DATABASE_URL = url;
  globalThis.__PG_CONTAINER__ = pgContainer;

  const prismaDir = path.join(__dirname, '..', 'prisma');
  execSync(`npx prisma migrate deploy`, {
    cwd: path.join(__dirname, '..'),
    stdio: 'pipe',
    env: { ...process.env, DATABASE_URL: url },
  });

  console.log('Test database ready');
}
```

- [ ] **Step 2: Create apps/api/test/app.e2e-spec.ts**

```typescript
import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('App E2E', () => {
  let app: INestApplication;

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

  it('GET /api/v1/health should return 200 with status ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toHaveProperty('code', 0);
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data).toHaveProperty('db');
    expect(response.body.message).toBe('ok');
  });

  it('GET /api/v1/health returns wrapped response format', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toHaveProperty('code');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('message');
  });

  it('GET /api/v1/nonexistent returns 404 in error format', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nonexistent').expect(404);

    expect(response.body).toHaveProperty('code', 404);
    expect(response.body.data).toBeNull();
    expect(response.body).toHaveProperty('message');
  });
});
```

- [ ] **Step 3: Run E2E tests**

```bash
cd apps/api && pnpm test:e2e
```

Expected: 3 E2E tests PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/api/test/
git commit -m "test: add e2e tests for health endpoint and error handling"
```

---

### Task 21: GitHub Actions CI

**Files created:** `.github/workflows/ci.yml`

- [ ] **Step 1: Create .github/workflows/ci.yml**

```yaml
name: CI

on:
  push:
    branches: ["**"]
  pull_request:
    branches: ["**"]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  lint:
    name: Lint
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: pnpm lint

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: app
          POSTGRES_PASSWORD: app
          POSTGRES_DB: care
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: cd apps/api && pnpm prisma:generate
      - run: cd apps/api && npx prisma migrate deploy
        env:
          DATABASE_URL: postgresql://app:app@localhost:5432/care
      - run: pnpm -r test --coverage
        env:
          DATABASE_URL: postgresql://app:app@localhost:5432/care
          REDIS_URL: redis://localhost:6379

  e2e:
    name: E2E Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: cd apps/api && pnpm prisma:generate
      - run: pnpm test:e2e

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v4
        with:
          version: 9
      - uses: actions/setup-node@v4
        with:
          node-version: 22
          cache: "pnpm"
      - run: pnpm install --frozen-lockfile
      - run: cd apps/api && pnpm prisma:generate
      - run: pnpm build
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "chore: add ci workflow with lint test e2e build jobs"
```

---

### Task 22: README.md

**Files created:** `README.md`

- [ ] **Step 1: Create README.md**

```markdown
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

- **TDD**: 先写失败测试 → 实现 → 重构
- **Commit**: Conventional Commits (`feat:`, `fix:`, `test:`, `refactor:`, `chore:`)
- **覆盖率**: 后端 ≥ 80%，核心域 ≥ 95%
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
```

- [ ] **Step 2: Commit**

```bash
git add README.md
git commit -m "docs: add project readme with structure and quick start guide"
```

---

### Task 23: Final verification and push

- [ ] **Step 1: Run all unit tests**

```bash
cd apps/api && pnpm test
```

Expected: all 13 unit tests PASS.

- [ ] **Step 2: Run all E2E tests**

```bash
cd apps/api && pnpm test:e2e
```

Expected: 3 E2E tests PASS.

- [ ] **Step 3: Run lint**

```bash
cd apps/api && pnpm lint
```

Expected: no lint errors.

- [ ] **Step 4: Run build**

```bash
cd apps/api && pnpm build
```

Expected: `dist/` output created without errors.

- [ ] **Step 5: Verify Docker services still healthy**

```bash
docker compose -f docker/docker-compose.yml ps
```

Expected: all three services `Up` and `healthy`.

- [ ] **Step 6: Verify commit history**

```bash
git log --oneline
```

Expected: ~8 commits (6 main + husky init + e2e test), all conventional format.

- [ ] **Step 7: Push to GitHub**

```bash
git push -u origin master
```

---

## Definition of Done Checklist

- [ ] Task 0: pnpm 9.x installed and verified
- [ ] Task 1-4 (Commit 1): Monorepo workspace, ESLint, Prettier, commitlint, placeholders
- [ ] Task 5 (Commit 2): Docker Compose starts PG/Redis/MinIO, all healthy
- [ ] Task 6-7: NestJS app configs, Prisma schema + client generated
- [ ] Task 8-12 (Commit 3): RED tests written and verified failing
- [ ] Task 13-18 (Commit 4): GREEN implementation, all unit tests pass (13 tests)
- [ ] Task 19 (Commit 5): Migration run, 15 tables created, 6 risk rules seeded
- [ ] Task 20: E2E tests pass (health endpoint, wrapped format, 404 error)
- [ ] Task 21 (Commit 6): CI workflow with lint/test/e2e/build jobs
- [ ] Task 22 (Commit 6): README.md with quick start guide
- [ ] Task 23: Final verification — all tests green, build clean, push to GitHub
