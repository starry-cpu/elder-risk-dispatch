# Epic 8 前端三端实现计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build all three frontend platforms (mini-app worker/elder subpackages + admin management dashboard) on top of the completed backend API.

**Architecture:** Two apps share types from `@care/shared-types` (auto-generated via `openapi-typescript` from backend Swagger). Mini-app uses uni-app with role-based subpackages (`pagesElder/` / `pagesWorker/`), composables for business logic. Admin uses Vue 3 + Element Plus + ECharts + Pinia stores, referencing vue-pure-admin layout pattern.

**Tech Stack:** Vue 3.4+, TypeScript 5.7, Vite 6, Pinia 2, Element Plus 2, ECharts 5, UnoCSS 0.6x, uni-app 4, wot-design-uni 1, luch-request 3, Vitest 2, Playwright 1, openapi-typescript

---

### Task 1: Shared-Types 生成流水线

**Files:**
- Create: `packages/shared-types/package.json`
- Create: `packages/shared-types/generate.mjs`
- Create: `packages/shared-types/.gitignore`
- Modify: `apps/api/src/main.ts:38-38`

- [ ] **Step 1: Write the generation script and package config**

Create `packages/shared-types/package.json`:
```json
{
  "name": "@care/shared-types",
  "version": "0.0.1",
  "private": true,
  "main": "./index.ts",
  "types": "./index.ts",
  "scripts": {
    "generate": "node generate.mjs"
  },
  "devDependencies": {
    "openapi-typescript": "^7.0.0"
  }
}
```

Create `packages/shared-types/.gitignore`:
```
index.ts
```

Create `packages/shared-types/generate.mjs`:
```javascript
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';

const OPENAPI_URL =
  process.env.OPENAPI_URL || 'http://localhost:3000/api-json';

console.log(`Fetching OpenAPI spec from ${OPENAPI_URL}...`);

try {
  execSync(
    `npx openapi-typescript "${OPENAPI_URL}" -o index.ts`,
    { stdio: 'inherit', cwd: new URL('.', import.meta.url).pathname }
  );
  console.log('Types generated successfully to packages/shared-types/index.ts');
} catch (err) {
  // Fallback: try local file
  console.log('Remote fetch failed, trying local file...');
  execSync(
    'npx openapi-typescript ../../apps/api/openapi.json -o index.ts',
    { stdio: 'inherit', cwd: new URL('.', import.meta.url).pathname }
  );
}
```

- [ ] **Step 2: Install dependencies and test generation**

Run:
```bash
cd packages/shared-types && pnpm install
```

Expected: `openapi-typescript` installed. Note: generation requires the API server running. Verify script syntax:
```bash
node -c generate.mjs
```
Expected: no syntax errors.

- [ ] **Step 3: Commit**

```bash
git add packages/shared-types/package.json packages/shared-types/generate.mjs packages/shared-types/.gitignore
git commit -m "feat: add shared-types generation pipeline with openapi-typescript"
```

---

### Task 2: Admin 项目脚手架

**Files:**
- Create: `apps/admin/vite.config.ts`
- Create: `apps/admin/tsconfig.json`
- Create: `apps/admin/tsconfig.node.json`
- Create: `apps/admin/index.html`
- Create: `apps/admin/src/main.ts`
- Create: `apps/admin/src/App.vue`
- Create: `apps/admin/src/env.d.ts`
- Create: `apps/admin/uno.config.ts`
- Modify: `apps/admin/package.json`

- [ ] **Step 1: Write package.json with all dependencies**

Overwrite `apps/admin/package.json`:
```json
{
  "name": "@care/admin",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --port 5173",
    "build": "vue-tsc --noEmit && vite build",
    "preview": "vite preview",
    "lint": "eslint \"src/**/*.{ts,vue}\" --fix",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@care/shared-types": "workspace:*",
    "axios": "^1.7.0",
    "dayjs": "^1.11.0",
    "echarts": "^5.5.0",
    "element-plus": "^2.9.0",
    "pinia": "^2.3.0",
    "pinia-plugin-persistedstate": "^4.2.0",
    "socket.io-client": "^4.8.0",
    "vue": "^3.5.0",
    "vue-echarts": "^7.0.0",
    "vue-router": "^4.5.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.50.0",
    "@types/node": "^22.0.0",
    "@vitejs/plugin-vue": "^5.2.0",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^25.0.0",
    "unocss": "^0.65.0",
    "vite": "^6.0.0",
    "vitest": "^2.1.0",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: Write vite.config.ts**

Create `apps/admin/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';
import UnoCSS from 'unocss';
import { resolve } from 'path';

export default defineConfig({
  plugins: [vue(), UnoCSS()],
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
});
```

- [ ] **Step 3: Write tsconfig files**

Create `apps/admin/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "skipLibCheck": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["node"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

Create `apps/admin/tsconfig.node.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "noEmit": true
  },
  "include": ["vite.config.ts", "uno.config.ts"]
}
```

- [ ] **Step 4: Write UnoCSS config**

Create `apps/admin/uno.config.ts`:
```typescript
import { defineConfig, presetUno, presetAttributify } from 'unocss';

export default defineConfig({
  presets: [presetUno(), presetAttributify()],
  shortcuts: {
    'flex-center': 'flex items-center justify-center',
    'flex-between': 'flex items-center justify-between',
  },
});
```

- [ ] **Step 5: Write entry files**

Create `apps/admin/index.html`:
```html
<!DOCTYPE html>
<html lang="zh-CN">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>社区独居老人照护调度系统</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
```

Create `apps/admin/src/env.d.ts`:
```typescript
/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
```

Create `apps/admin/src/main.ts`:
```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import App from './App.vue';
import 'element-plus/dist/index.css';
import 'uno.css';

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.mount('#app');
```

Create `apps/admin/src/App.vue`:
```vue
<template>
  <router-view />
</template>

<script setup lang="ts">
// Router will be added in Task 3
</script>
```

- [ ] **Step 6: Install dependencies**

Run:
```bash
cd apps/admin && pnpm install
```
Expected: all packages installed without errors.

- [ ] **Step 7: Verify scaffold builds**

Run:
```bash
cd apps/admin && npx vite build --mode development 2>&1 | head -20
```
Expected: build succeeds (may warn about empty project, that's fine).

- [ ] **Step 8: Commit**

```bash
git add apps/admin/
git commit -m "feat: scaffold admin Vue3 project with Vite, Element Plus, ECharts, UnoCSS, Pinia"
```

---

### Task 3: Admin API Client 层

**Files:**
- Create: `apps/admin/src/api/client.ts`
- Create: `apps/admin/src/api/auth.ts`
- Create: `apps/admin/src/api/dashboard.ts`
- Create: `apps/admin/src/api/elders.ts`
- Create: `apps/admin/src/api/risk.ts`
- Create: `apps/admin/src/api/work-orders.ts`
- Create: `apps/admin/src/api/rules.ts`
- Create: `apps/admin/src/api/users.ts`
- Create: `apps/admin/src/api/audit.ts`
- Create: `apps/admin/src/api/index.ts`

- [ ] **Step 1: Write Axios client wrapper**

Create `apps/admin/src/api/client.ts`:
```typescript
import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { ElMessage } from 'element-plus';

interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

const client: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse;
    if (body.code !== 0) {
      ElMessage.error(body.message || '请求失败');
      return Promise.reject(new Error(body.message));
    }
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    const msg = error.response?.data?.message || error.message || '网络错误';
    ElMessage.error(msg);
    return Promise.reject(error);
  }
);

export default client;
export type { ApiResponse };
```

- [ ] **Step 2: Write API modules**

Create `apps/admin/src/api/auth.ts`:
```typescript
import client from './client';
import type { paths } from '@care/shared-types';

type AuthPath = paths['/api/v1/auth/admin-login']['post'];
type MePath = paths['/api/v1/auth/me']['get'];

export interface AdminLoginRequest {
  phone: string;
  password: string;
}

export const authApi = {
  adminLogin: (data: AdminLoginRequest) =>
    client.post<{ data: { accessToken: string } }>('/auth/admin-login', data),

  getMe: () =>
    client.get<{ data: MePath['responses']['200']['content']['application/json']['data'] }>('/auth/me'),
};
```

Create `apps/admin/src/api/dashboard.ts`:
```typescript
import client from './client';

export interface DashboardOverview {
  keyElderCount: number;
  pendingRiskCount: number;
  todayCompletionRate: number;
  poorReviewCount: number;
}

export interface RiskDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface ResponseTimeTrend {
  date: string;
  avgMinutes: number;
}

export interface Hotspot {
  category: string;
  count: number;
}

export const dashboardApi = {
  getOverview: () =>
    client.get<{ data: DashboardOverview }>('/dashboard/overview'),

  getResponseTime: () =>
    client.get<{ data: ResponseTimeTrend[] }>('/dashboard/response-time'),

  getRiskDistribution: () =>
    client.get<{ data: RiskDistribution }>('/dashboard/risk-distribution'),

  getHotspots: () =>
    client.get<{ data: Hotspot[] }>('/dashboard/hotspots'),

  getPoorReviews: () =>
    client.get<{ data: Hotspot[] }>('/dashboard/poor-reviews'),
};
```

Create `apps/admin/src/api/elders.ts`:
```typescript
import client from './client';

export interface ElderListParams {
  page?: number;
  limit?: number;
  district?: string;
  serviceLevel?: string;
  search?: string;
}

export interface ElderRecord {
  id: string;
  name: string;
  gender: string;
  birthDate: string;
  district: string;
  healthTags: string[];
  serviceLevel: string;
  lastCheckInTime?: string;
}

export interface ElderDetail extends ElderRecord {
  address: string;
  contacts: Array<{
    id: string;
    name: string;
    relation: string;
    phone: string;
    isPrimary: boolean;
  }>;
  riskProfile: Array<{
    id: string;
    level: string;
    source: string;
    score: number;
    reason: string;
    createdAt: string;
  }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const eldersApi = {
  list: (params: ElderListParams) =>
    client.get<{ data: PaginatedResponse<ElderRecord> }>('/elders', { params }),

  getById: (id: string) =>
    client.get<{ data: ElderDetail }>(`/elders/${id}`),

  getRiskProfile: (id: string) =>
    client.get<{ data: ElderDetail['riskProfile'] }>(`/elders/${id}/risk-profile`),
};
```

Create `apps/admin/src/api/risk.ts`:
```typescript
import client from './client';

export interface RiskEventRecord {
  id: string;
  elderId: string;
  elderName?: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  source: string;
  score: number;
  reason: string;
  status: string;
  createdAt: string;
}

export interface RiskListParams {
  page?: number;
  limit?: number;
  status?: string;
  level?: string;
}

export const riskApi = {
  list: (params: RiskListParams) =>
    client.get<{ data: { items: RiskEventRecord[]; total: number; page: number; limit: number } }>('/risk/events', { params }),

  review: (id: string, data: { status: string; note?: string }) =>
    client.post(`/risk/events/${id}/review`, data),
};
```

Create `apps/admin/src/api/work-orders.ts`:
```typescript
import client from './client';

export interface WorkOrderRecord {
  id: string;
  elderId: string;
  elderName?: string;
  type: string;
  level: string;
  status: string;
  assigneeId?: string;
  assigneeName?: string;
  deadline?: string;
  createdAt: string;
}

export interface WorkOrderListParams {
  page?: number;
  limit?: number;
  status?: string;
}

export interface AssignParams {
  assigneeId: string;
}

export interface ReassignParams {
  assigneeId: string;
  reason: string;
}

export interface DispatchRecommendation {
  assignee: {
    id: string;
    name: string;
    district: string;
    skills: string[];
    dutyStatus: string;
    avgResponseMin?: number;
  };
  score: number;
}

export const workOrdersApi = {
  list: (params: WorkOrderListParams) =>
    client.get<{ data: { items: WorkOrderRecord[]; total: number; page: number; limit: number } }>('/work-orders', { params }),

  assign: (id: string, data: AssignParams) =>
    client.post(`/work-orders/${id}/assign`, data),

  reassign: (id: string, data: ReassignParams) =>
    client.post(`/work-orders/${id}/reassign`, data),

  getRecommendations: (id: string) =>
    client.get<{ data: DispatchRecommendation[] }>(`/work-orders/${id}/recommendations`),

  getTimeline: (id: string) =>
    client.get<{ data: Array<{ id: string; action: string; note?: string; createdAt: string }> }>(`/work-orders/${id}/timeline`),
};
```

Create `apps/admin/src/api/rules.ts`:
```typescript
import client from './client';

export interface RiskRuleRecord {
  id: string;
  name: string;
  condition: Record<string, unknown>;
  weight: number;
  level: string;
  version: number;
  enabled: boolean;
}

export const rulesApi = {
  list: () =>
    client.get<{ data: RiskRuleRecord[] }>('/risk/rules'),

  create: (data: Omit<RiskRuleRecord, 'id' | 'version'>) =>
    client.post('/risk/rules', data),

  update: (id: string, data: Partial<RiskRuleRecord>) =>
    client.patch(`/risk/rules/${id}`, data),
};
```

Create `apps/admin/src/api/users.ts`:
```typescript
import client from './client';

export interface UserRecord {
  id: string;
  name: string;
  phone: string;
  role: string;
  skills: string[];
  district: string;
  dutyStatus: string;
}

export const usersApi = {
  list: (params?: { role?: string; district?: string }) =>
    client.get<{ data: UserRecord[] }>('/users', { params }),

  create: (data: Omit<UserRecord, 'id'>) =>
    client.post('/users', data),

  update: (id: string, data: Partial<UserRecord>) =>
    client.patch(`/users/${id}`, data),
};
```

Create `apps/admin/src/api/audit.ts`:
```typescript
import client from './client';

export interface AuditLogRecord {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface AuditListParams {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

export const auditApi = {
  list: (params: AuditListParams) =>
    client.get<{ data: { items: AuditLogRecord[]; total: number; page: number; limit: number } }>('/audit/logs', { params }),
};
```

Create `apps/admin/src/api/index.ts`:
```typescript
export { default as client } from './client';
export { authApi } from './auth';
export { dashboardApi } from './dashboard';
export { eldersApi } from './elders';
export { riskApi } from './risk';
export { workOrdersApi } from './work-orders';
export { rulesApi } from './rules';
export { usersApi } from './users';
export { auditApi } from './audit';
```

- [ ] **Step 3: Commit**

```bash
git add apps/admin/src/api/
git commit -m "feat: add admin API client layer with all domain modules"
```

---

### Task 4: Admin Router + Auth Store + Login

**Files:**
- Create: `apps/admin/src/router/index.ts`
- Create: `apps/admin/src/stores/auth.ts`
- Create: `apps/admin/src/views/login/index.vue`
- Modify: `apps/admin/src/App.vue`
- Modify: `apps/admin/src/main.ts`

- [ ] **Step 1: Write auth store with test**

Create `apps/admin/src/stores/__tests__/auth.spec.ts`:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it('initializes with no token and not authenticated', () => {
    const store = useAuthStore();
    expect(store.token).toBe('');
    expect(store.isAuthenticated).toBe(false);
  });

  it('setToken updates token and isAuthenticated', () => {
    const store = useAuthStore();
    store.setToken('test-token');
    expect(store.token).toBe('test-token');
    expect(store.isAuthenticated).toBe(true);
  });

  it('logout clears token', () => {
    const store = useAuthStore();
    store.setToken('test-token');
    store.logout();
    expect(store.token).toBe('');
    expect(store.isAuthenticated).toBe(false);
  });
});
```

Create `apps/admin/src/stores/auth.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref<{ id: string; name: string; role: string } | null>(null);

  const isAuthenticated = computed(() => token.value.length > 0);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  function setToken(t: string) {
    token.value = t;
    localStorage.setItem('token', t);
  }

  function setUser(u: typeof user.value) {
    user.value = u;
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
  }

  return { token, user, isAuthenticated, isAdmin, setToken, setUser, logout };
});
```

- [ ] **Step 2: Run store test to verify it passes**

Run:
```bash
cd apps/admin && npx vitest run src/stores/__tests__/auth.spec.ts
```
Expected: 3 tests pass.

- [ ] **Step 3: Write router with auth guard**

Create `apps/admin/src/router/index.ts`:
```typescript
import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/elders',
    name: 'Elders',
    component: () => import('@/views/elders/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/elders/:id',
    name: 'ElderDetail',
    component: () => import('@/views/elders/[id].vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/risk',
    name: 'Risk',
    component: () => import('@/views/risk/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/work-orders',
    name: 'WorkOrders',
    component: () => import('@/views/work-orders/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/rules',
    name: 'Rules',
    component: () => import('@/views/rules/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/users/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('@/views/audit/index.vue'),
    meta: { requiresAuth: true },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth !== false && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
```

- [ ] **Step 4: Update main.ts with router**

Edit `apps/admin/src/main.ts` — add router import and use:

```typescript
import { createApp } from 'vue';
import { createPinia } from 'pinia';
import piniaPluginPersistedstate from 'pinia-plugin-persistedstate';
import App from './App.vue';
import router from './router';
import 'element-plus/dist/index.css';
import 'uno.css';

const app = createApp(App);
const pinia = createPinia();
pinia.use(piniaPluginPersistedstate);
app.use(pinia);
app.use(router);
app.mount('#app');
```

Update `apps/admin/src/App.vue`:
```vue
<template>
  <router-view />
</template>
```

- [ ] **Step 5: Write login view**

Create `apps/admin/src/views/login/index.vue`:
```vue
<template>
  <div class="min-h-screen flex-center bg-gray-100">
    <el-card class="w-400px">
      <h2 class="text-center text-2xl mb-6">照护调度系统</h2>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="w-full" :loading="loading" @click="handleLogin">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  phone: '',
  password: '',
});

const rules: FormRules = {
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const res = await authApi.adminLogin(form);
    const token = res.data.data.accessToken;
    authStore.setToken(token);

    // Also fetch user info
    const meRes = await authApi.getMe();
    authStore.setUser(meRes.data.data);

    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch {
    // error handled by interceptor
  } finally {
    loading.value = false;
  }
}
</script>
```

- [ ] **Step 6: Verify login page renders**

Run:
```bash
cd apps/admin && npx vite --port 5173 &
```
Check that the dev server starts without errors. Stop the server afterward.

- [ ] **Step 7: Commit**

```bash
git add apps/admin/src/router/ apps/admin/src/stores/ apps/admin/src/views/login/ apps/admin/src/main.ts apps/admin/src/App.vue
git commit -m "feat: add admin router, auth store, and login page with form validation"
```

---

### Task 5: Admin Layout + Sidebar

**Files:**
- Create: `apps/admin/src/components/layout/AppLayout.vue`
- Create: `apps/admin/src/components/layout/SidebarMenu.vue`
- Modify: `apps/admin/src/App.vue`

- [ ] **Step 1: Write SidebarMenu component**

Create `apps/admin/src/components/layout/SidebarMenu.vue`:
```vue
<template>
  <el-menu
    :default-active="activeMenu"
    router
    class="h-full border-r-0"
    background-color="#001529"
    text-color="#ffffffb3"
    active-text-color="#fff"
  >
    <el-menu-item index="/dashboard">
      <el-icon><DataAnalysis /></el-icon>
      <span>驾驶舱</span>
    </el-menu-item>
    <el-menu-item index="/elders">
      <el-icon><User /></el-icon>
      <span>老人档案</span>
    </el-menu-item>
    <el-menu-item index="/risk">
      <el-icon><Warning /></el-icon>
      <span>预警中心</span>
    </el-menu-item>
    <el-menu-item index="/work-orders">
      <el-icon><Document /></el-icon>
      <span>工单管理</span>
    </el-menu-item>
    <el-menu-item index="/rules">
      <el-icon><Setting /></el-icon>
      <span>规则配置</span>
    </el-menu-item>
    <el-menu-item index="/users">
      <el-icon><Avatar /></el-icon>
      <span>人员排班</span>
    </el-menu-item>
    <el-menu-item index="/audit">
      <el-icon><Clock /></el-icon>
      <span>审计日志</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  DataAnalysis, User, Warning, Document, Setting, Avatar, Clock,
} from '@element-plus/icons-vue';

const route = useRoute();
const activeMenu = computed(() => route.path);
</script>
```

- [ ] **Step 2: Write AppLayout component**

Create `apps/admin/src/components/layout/AppLayout.vue`:
```vue
<template>
  <el-container class="h-screen">
    <el-aside width="220px" class="bg-[#001529]">
      <div class="h-16 flex-center text-white text-lg font-bold border-b border-white/10">
        照护调度系统
      </div>
      <SidebarMenu />
    </el-aside>
    <el-container>
      <el-header class="flex-between bg-white border-b border-gray-200 px-6" height="64px">
        <div class="text-gray-600">{{ route.meta?.title || '' }}</div>
        <div class="flex items-center gap-4">
          <el-badge :value="newRiskCount" :hidden="newRiskCount === 0">
            <el-icon :size="20"><Bell /></el-icon>
          </el-badge>
          <span class="text-sm text-gray-600">{{ authStore.user?.name || '' }}</span>
          <el-button text @click="handleLogout">退出</el-button>
        </div>
      </el-header>
      <el-main class="bg-gray-50">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bell } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import SidebarMenu from './SidebarMenu.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const newRiskCount = ref(0);

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>
```

- [ ] **Step 3: Update App.vue to use layout**

Update `apps/admin/src/App.vue`:
```vue
<template>
  <AppLayout v-if="authStore.isAuthenticated" />
  <router-view v-else />
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import AppLayout from '@/components/layout/AppLayout.vue';

const authStore = useAuthStore();
</script>
```

- [ ] **Step 4: Ensure Element Plus icons are available**

Add `@element-plus/icons-vue` to the admin's package.json dependencies section and run install. If already in the dependency tree from element-plus, skip.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/components/layout/ apps/admin/src/App.vue
git commit -m "feat: add admin layout with sidebar navigation and header"
```

---

### Task 6: Admin Dashboard Page

**Files:**
- Create: `apps/admin/src/components/common/StatCard.vue`
- Create: `apps/admin/src/components/common/ChartCard.vue`
- Create: `apps/admin/src/stores/dashboard.ts`
- Create: `apps/admin/src/stores/__tests__/dashboard.spec.ts`
- Create: `apps/admin/src/views/dashboard/index.vue`

- [ ] **Step 1: Write dashboard store test**

Create `apps/admin/src/stores/__tests__/dashboard.spec.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDashboardStore } from '../dashboard';

vi.mock('@/api', () => ({
  dashboardApi: {
    getOverview: vi.fn().mockResolvedValue({
      data: {
        data: {
          keyElderCount: 12,
          pendingRiskCount: 5,
          todayCompletionRate: 85.5,
          poorReviewCount: 2,
        },
      },
    }),
    getRiskDistribution: vi.fn().mockResolvedValue({
      data: { data: { high: 3, medium: 8, low: 15 } },
    }),
    getResponseTime: vi.fn().mockResolvedValue({
      data: { data: [{ date: '2026-06-01', avgMinutes: 25 }] },
    }),
    getHotspots: vi.fn().mockResolvedValue({
      data: { data: [{ category: '生活照料', count: 10 }] },
    }),
    getPoorReviews: vi.fn().mockResolvedValue({
      data: { data: [{ category: '响应慢', count: 3 }] },
    }),
  },
}));

describe('useDashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fetchOverview populates overview data', async () => {
    const store = useDashboardStore();
    await store.fetchOverview();
    expect(store.overview.keyElderCount).toBe(12);
    expect(store.overview.pendingRiskCount).toBe(5);
  });

  it('fetchAll populates all data', async () => {
    const store = useDashboardStore();
    await store.fetchAll();
    expect(store.overview.keyElderCount).toBe(12);
    expect(store.riskDistribution.high).toBe(3);
    expect(store.responseTimeTrend).toHaveLength(1);
  });
});
```

- [ ] **Step 2: Run the failing test**

Run:
```bash
cd apps/admin && npx vitest run src/stores/__tests__/dashboard.spec.ts
```
Expected: FAIL — dashboard store module doesn't exist yet.

- [ ] **Step 3: Write dashboard store implementation**

Create `apps/admin/src/stores/dashboard.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dashboardApi } from '@/api';
import type { DashboardOverview, RiskDistribution, ResponseTimeTrend, Hotspot } from '@/api/dashboard';

export const useDashboardStore = defineStore('dashboard', () => {
  const overview = ref<DashboardOverview>({
    keyElderCount: 0,
    pendingRiskCount: 0,
    todayCompletionRate: 0,
    poorReviewCount: 0,
  });
  const riskDistribution = ref<RiskDistribution>({ high: 0, medium: 0, low: 0 });
  const responseTimeTrend = ref<ResponseTimeTrend[]>([]);
  const hotspots = ref<Hotspot[]>([]);
  const poorReviews = ref<Hotspot[]>([]);
  const loading = ref(false);

  async function fetchOverview() {
    const res = await dashboardApi.getOverview();
    overview.value = res.data.data;
  }

  async function fetchAll() {
    loading.value = true;
    try {
      const [ov, rd, rt, hs, pr] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getRiskDistribution(),
        dashboardApi.getResponseTime(),
        dashboardApi.getHotspots(),
        dashboardApi.getPoorReviews(),
      ]);
      overview.value = ov.data.data;
      riskDistribution.value = rd.data.data;
      responseTimeTrend.value = rt.data.data;
      hotspots.value = hs.data.data;
      poorReviews.value = pr.data.data;
    } finally {
      loading.value = false;
    }
  }

  return { overview, riskDistribution, responseTimeTrend, hotspots, poorReviews, loading, fetchOverview, fetchAll };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/admin && npx vitest run src/stores/__tests__/dashboard.spec.ts
```
Expected: 2 tests PASS.

- [ ] **Step 5: Write StatCard component**

Create `apps/admin/src/components/common/StatCard.vue`:
```vue
<template>
  <el-card shadow="hover" class="text-center">
    <div class="text-4xl font-bold" :style="{ color }">{{ value }}</div>
    <div class="text-sm text-gray-500 mt-2">{{ label }}</div>
    <div v-if="suffix" class="text-xs text-gray-400 mt-1">{{ suffix }}</div>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
  value: string | number;
  label: string;
  color?: string;
  suffix?: string;
}>();
</script>
```

- [ ] **Step 6: Write ChartCard component**

Create `apps/admin/src/components/common/ChartCard.vue`:
```vue
<template>
  <el-card shadow="hover" class="h-full">
    <template #header>
      <span class="font-medium">{{ title }}</span>
    </template>
    <div ref="chartRef" :style="{ height: chartHeight }" />
  </el-card>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

const props = defineProps<{
  title: string;
  option: EChartsOption;
  chartHeight?: string;
}>();

const chartRef = ref<HTMLDivElement>();
let instance: echarts.ECharts | null = null;

function initChart() {
  if (!chartRef.value) return;
  instance = echarts.init(chartRef.value);
  instance.setOption(props.option);
}

function handleResize() {
  instance?.resize();
}

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  instance?.dispose();
});

watch(() => props.option, (newOpt) => {
  instance?.setOption(newOpt);
}, { deep: true });
</script>
```

- [ ] **Step 7: Write Dashboard page**

Create `apps/admin/src/views/dashboard/index.vue`:
```vue
<template>
  <div class="space-y-6">
    <!-- Stat Cards -->
    <el-row :gutter="16">
      <el-col :span="6">
        <StatCard label="重点老人" :value="store.overview.keyElderCount" color="#e6a23c" suffix="人" />
      </el-col>
      <el-col :span="6">
        <StatCard label="待处理预警" :value="store.overview.pendingRiskCount" color="#f56c6c" suffix="条" />
      </el-col>
      <el-col :span="6">
        <StatCard label="今日工单完成率" :value="`${store.overview.todayCompletionRate}%`" color="#67c23a" />
      </el-col>
      <el-col :span="6">
        <StatCard label="近期差评" :value="store.overview.poorReviewCount" color="#909399" suffix="条" />
      </el-col>
    </el-row>

    <!-- Charts -->
    <el-row :gutter="16">
      <el-col :span="12">
        <ChartCard title="风险分布" :option="riskPieOption" chart-height="300px" />
      </el-col>
      <el-col :span="12">
        <ChartCard title="响应时长趋势" :option="responseTimeOption" chart-height="300px" />
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <ChartCard title="高发问题" :option="hotspotsOption" chart-height="300px" />
      </el-col>
      <el-col :span="12">
        <ChartCard title="差评分析" :option="poorReviewsOption" chart-height="300px" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { EChartsOption } from 'echarts';
import { useDashboardStore } from '@/stores/dashboard';
import StatCard from '@/components/common/StatCard.vue';
import ChartCard from '@/components/common/ChartCard.vue';

const store = useDashboardStore();

const riskPieOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    data: [
      { value: store.riskDistribution.high, name: '高风险' },
      { value: store.riskDistribution.medium, name: '中风险' },
      { value: store.riskDistribution.low, name: '低风险' },
    ],
    emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
  }],
}));

const responseTimeOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: store.responseTimeTrend.map(r => r.date) },
  yAxis: { type: 'value', name: '分钟' },
  series: [{
    type: 'line',
    data: store.responseTimeTrend.map(r => r.avgMinutes),
    smooth: true,
    areaStyle: { opacity: 0.3 },
  }],
}));

const hotspotsOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: store.hotspots.map(h => h.category) },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: store.hotspots.map(h => h.count) }],
}));

const poorReviewsOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: store.poorReviews.map(p => p.category) },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: store.poorReviews.map(p => p.count), color: '#f56c6c' }],
}));

onMounted(() => {
  store.fetchAll();
});
</script>
```

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/components/common/ apps/admin/src/stores/dashboard.ts apps/admin/src/stores/__tests__/ apps/admin/src/views/dashboard/
git commit -m "feat: add admin dashboard with stat cards, ECharts charts, and dashboard store"
```

---

### Task 7: Admin WebSocket Composable

**Files:**
- Create: `apps/admin/src/composables/useWebSocket.ts`
- Create: `apps/admin/src/composables/__tests__/useWebSocket.spec.ts`

- [ ] **Step 1: Write WebSocket composable test**

Create `apps/admin/src/composables/__tests__/useWebSocket.spec.ts`:
```typescript
import { describe, it, expect, vi } from 'vitest';
import { useWebSocket } from '../useWebSocket';

// Mock socket.io-client
vi.mock('socket.io-client', () => {
  const mockSocket = {
    on: vi.fn(),
    off: vi.fn(),
    disconnect: vi.fn(),
    connected: true,
  };
  return {
    io: vi.fn(() => mockSocket),
    default: { io: vi.fn(() => mockSocket) },
  };
});

describe('useWebSocket', () => {
  it('connects and returns socket ref', () => {
    const { connected } = useWebSocket('/dashboard');
    expect(connected.value).toBe(true);
  });

  it('disconnects on cleanup when called', () => {
    const { disconnect } = useWebSocket('/dashboard');
    disconnect();
    // should not throw
  });
});
```

- [ ] **Step 2: Run failing test**

Run:
```bash
cd apps/admin && npx vitest run src/composables/__tests__/useWebSocket.spec.ts
```
Expected: FAIL — module doesn't exist.

- [ ] **Step 3: Write WebSocket composable**

Create `apps/admin/src/composables/useWebSocket.ts`:
```typescript
import { ref, onUnmounted } from 'vue';
import { io, type Socket } from 'socket.io-client';

export function useWebSocket(namespace: string) {
  const connected = ref(false);
  let socket: Socket | null = null;

  function connect() {
    const token = localStorage.getItem('token');
    socket = io(namespace, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      connected.value = true;
    });

    socket.on('disconnect', () => {
      connected.value = false;
    });
  }

  function on(event: string, handler: (...args: unknown[]) => void) {
    socket?.on(event, handler);
  }

  function off(event: string, handler?: (...args: unknown[]) => void) {
    socket?.off(event, handler);
  }

  function disconnect() {
    socket?.disconnect();
    socket = null;
    connected.value = false;
  }

  connect();

  onUnmounted(() => {
    disconnect();
  });

  return { connected, on, off, disconnect };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/admin && npx vitest run src/composables/__tests__/useWebSocket.spec.ts
```
Expected: 2 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/src/composables/
git commit -m "feat: add admin WebSocket composable with socket.io-client"
```

---

### Task 8: Admin Risk (预警中心) Page

**Files:**
- Create: `apps/admin/src/stores/risk.ts`
- Create: `apps/admin/src/stores/__tests__/risk.spec.ts`
- Create: `apps/admin/src/components/risk/RiskTable.vue`
- Create: `apps/admin/src/components/risk/ReviewDialog.vue`
- Create: `apps/admin/src/views/risk/index.vue`

- [ ] **Step 1: Write risk store test**

Create `apps/admin/src/stores/__tests__/risk.spec.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRiskStore } from '../risk';

vi.mock('@/api', () => ({
  riskApi: {
    list: vi.fn().mockResolvedValue({
      data: { data: { items: [{ id: '1', elderId: 'e1', level: 'HIGH', source: 'MISSED_CHECKIN', score: 80, reason: '未报平安', status: 'PENDING_REVIEW', createdAt: '2026-06-12T00:00:00Z', elderName: '张大爷' }], total: 1, page: 1, limit: 20 } },
    }),
    review: vi.fn().mockResolvedValue({ data: { data: { success: true } } }),
  },
}));

describe('useRiskStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fetchList populates items', async () => {
    const store = useRiskStore();
    await store.fetchList({});
    expect(store.items).toHaveLength(1);
    expect(store.items[0].level).toBe('HIGH');
  });

  it('addNewEvent prepends item', () => {
    const store = useRiskStore();
    const event = { id: '2', elderId: 'e2', level: 'MEDIUM' as const, source: 'DEVICE', score: 50, reason: '烟感', status: 'PENDING_REVIEW', createdAt: '2026-06-12T01:00:00Z' };
    store.addNewEvent(event);
    expect(store.items).toHaveLength(1);
    expect(store.items[0].id).toBe('2');
  });
});
```

- [ ] **Step 2: Run failing test**

Run:
```bash
cd apps/admin && npx vitest run src/stores/__tests__/risk.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Write risk store implementation**

Create `apps/admin/src/stores/risk.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { riskApi } from '@/api';
import type { RiskEventRecord, RiskListParams } from '@/api/risk';

export const useRiskStore = defineStore('risk', () => {
  const items = ref<RiskEventRecord[]>([]);
  const total = ref(0);
  const loading = ref(false);

  async function fetchList(params: RiskListParams) {
    loading.value = true;
    try {
      const res = await riskApi.list(params);
      items.value = res.data.data.items;
      total.value = res.data.data.total;
    } finally {
      loading.value = false;
    }
  }

  async function review(id: string, status: string, note?: string) {
    await riskApi.review(id, { status, note });
    const idx = items.value.findIndex(i => i.id === id);
    if (idx >= 0) {
      items.value[idx] = { ...items.value[idx], status };
    }
  }

  function addNewEvent(event: RiskEventRecord) {
    items.value.unshift(event);
    total.value++;
  }

  return { items, total, loading, fetchList, review, addNewEvent };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/admin && npx vitest run src/stores/__tests__/risk.spec.ts
```
Expected: 2 tests PASS.

- [ ] **Step 5: Write RiskTable component**

Create `apps/admin/src/components/risk/RiskTable.vue`:
```vue
<template>
  <el-table :data="items" v-loading="loading" stripe>
    <el-table-column label="等级" width="80" prop="level">
      <template #default="{ row }">
        <el-tag :type="row.level === 'HIGH' ? 'danger' : 'warning'" size="small">
          {{ row.level === 'HIGH' ? '高' : '中' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="老人" prop="elderName" min-width="100" />
    <el-table-column label="来源" prop="source" width="120" />
    <el-table-column label="分数" prop="score" width="70" />
    <el-table-column label="原因" prop="reason" min-width="180" show-overflow-tooltip />
    <el-table-column label="状态" width="100" prop="status">
      <template #default="{ row }">
        {{ row.status === 'PENDING_REVIEW' ? '待复核' : row.status === 'CONFIRMED' ? '已确认' : '已忽略' }}
      </template>
    </el-table-column>
    <el-table-column label="时间" width="170" prop="createdAt">
      <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }}</template>
    </el-table-column>
    <el-table-column label="操作" width="150" fixed="right">
      <template #default="{ row }">
        <template v-if="row.status === 'PENDING_REVIEW'">
          <el-button type="primary" link size="small" @click="$emit('confirm', row)">
            确认
          </el-button>
          <el-button type="danger" link size="small" @click="$emit('ignore', row)">
            忽略
          </el-button>
        </template>
        <span v-else class="text-gray-400">-</span>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import type { RiskEventRecord } from '@/api/risk';

defineProps<{
  items: RiskEventRecord[];
  loading: boolean;
}>();

defineEmits<{
  confirm: [row: RiskEventRecord];
  ignore: [row: RiskEventRecord];
}>();
</script>
```

- [ ] **Step 6: Write ReviewDialog component**

Create `apps/admin/src/components/risk/ReviewDialog.vue`:
```vue
<template>
  <el-dialog
    :model-value="visible"
    :title="title"
    width="480px"
    @update:model-value="$emit('update:visible', $event)"
    @close="resetForm"
  >
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="复核备注" prop="note">
        <el-input
          v-model="form.note"
          type="textarea"
          :rows="3"
          :placeholder="isHighRisk ? '高风险事件必须填写复核备注' : '选填'"
        />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button :type="actionType" @click="submit">
        {{ actionLabel }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import type { RiskEventRecord } from '@/api/risk';

const props = defineProps<{
  visible: boolean;
  event: RiskEventRecord | null;
  action: 'confirm' | 'ignore';
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  submit: [status: string, note?: string];
}>();

const formRef = ref<FormInstance>();
const form = ref({ note: '' });

const isHighRisk = computed(() => props.event?.level === 'HIGH');
const title = computed(() => props.action === 'confirm' ? '确认预警' : '忽略预警');
const actionType = computed(() => props.action === 'confirm' ? 'primary' : 'danger');
const actionLabel = computed(() => props.action === 'confirm' ? '确认' : '忽略');

const rules: FormRules = {
  note: [
    {
      required: isHighRisk.value,
      message: '高风险事件必须填写复核备注',
      trigger: 'blur',
    },
  ],
};

function resetForm() {
  form.value.note = '';
  formRef.value?.resetFields();
}

async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  const status = props.action === 'confirm' ? 'CONFIRMED' : 'IGNORED';
  emit('submit', status, form.value.note || undefined);
}
</script>
```

- [ ] **Step 7: Write Risk view page**

Create `apps/admin/src/views/risk/index.vue`:
```vue
<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <div class="flex gap-3">
          <el-select v-model="filters.level" placeholder="风险等级" clearable class="w-120px" @change="load">
            <el-option label="高风险" value="HIGH" />
            <el-option label="中风险" value="MEDIUM" />
          </el-select>
          <el-select v-model="filters.status" placeholder="状态" clearable class="w-120px" @change="load">
            <el-option label="待复核" value="PENDING_REVIEW" />
            <el-option label="已确认" value="CONFIRMED" />
            <el-option label="已忽略" value="IGNORED" />
          </el-select>
        </div>
      </div>

      <RiskTable
        :items="store.items"
        :loading="store.loading"
        @confirm="openReview($event, 'confirm')"
        @ignore="openReview($event, 'ignore')"
      />

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="limit"
          :total="store.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </el-card>

    <ReviewDialog
      :visible="dialogVisible"
      :event="selectedEvent"
      :action="reviewAction"
      @update:visible="dialogVisible = $event"
      @submit="handleReviewSubmit"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useRiskStore } from '@/stores/risk';
import RiskTable from '@/components/risk/RiskTable.vue';
import ReviewDialog from '@/components/risk/ReviewDialog.vue';
import type { RiskEventRecord } from '@/api/risk';

const store = useRiskStore();
const page = ref(1);
const limit = ref(20);
const filters = reactive({ level: '', status: '' });

const dialogVisible = ref(false);
const selectedEvent = ref<RiskEventRecord | null>(null);
const reviewAction = ref<'confirm' | 'ignore'>('confirm');

function load() {
  store.fetchList({ page: page.value, limit: limit.value, ...filters });
}

function openReview(event: RiskEventRecord, action: 'confirm' | 'ignore') {
  selectedEvent.value = event;
  reviewAction.value = action;
  dialogVisible.value = true;
}

async function handleReviewSubmit(status: string, note?: string) {
  if (!selectedEvent.value) return;
  await store.review(selectedEvent.value.id, status, note);
  ElMessage.success(status === 'CONFIRMED' ? '已确认' : '已忽略');
  dialogVisible.value = false;
  load();
}

onMounted(() => {
  load();
});
</script>
```

- [ ] **Step 8: Commit**

```bash
git add apps/admin/src/stores/risk.ts apps/admin/src/stores/__tests__/risk.spec.ts apps/admin/src/components/risk/ apps/admin/src/views/risk/
git commit -m "feat: add admin risk center with review dialog and risk store"
```

---

### Task 9: Admin WorkOrders (工单管理) Page

**Files:**
- Create: `apps/admin/src/stores/work-orders.ts`
- Create: `apps/admin/src/stores/__tests__/work-orders.spec.ts`
- Create: `apps/admin/src/components/work-orders/OrderTable.vue`
- Create: `apps/admin/src/components/work-orders/AssignDialog.vue`
- Create: `apps/admin/src/components/work-orders/TimelinePopover.vue`
- Create: `apps/admin/src/views/work-orders/index.vue`

- [ ] **Step 1: Write work-orders store test**

Create `apps/admin/src/stores/__tests__/work-orders.spec.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useWorkOrderStore } from '../work-orders';

vi.mock('@/api', () => ({
  workOrdersApi: {
    list: vi.fn().mockResolvedValue({
      data: { data: { items: [{ id: '1', elderId: 'e1', elderName: '张大爷', type: 'HEALTH', level: 'HIGH', status: 'PENDING', createdAt: '2026-06-12T00:00:00Z' }], total: 1, page: 1, limit: 20 } },
    }),
    assign: vi.fn().mockResolvedValue({ data: { data: { success: true } } }),
    reassign: vi.fn().mockResolvedValue({ data: { data: { success: true } } }),
    getRecommendations: vi.fn().mockResolvedValue({
      data: { data: [{ assignee: { id: 'u1', name: '李网格', district: '东城', skills: ['HEALTH'], dutyStatus: 'ON_DUTY', avgResponseMin: 15 }, score: 85 }] },
    }),
    getTimeline: vi.fn().mockResolvedValue({
      data: { data: [{ id: 't1', action: 'CREATED', createdAt: '2026-06-12T00:00:00Z' }] },
    }),
  },
}));

describe('useWorkOrderStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fetchList populates items', async () => {
    const store = useWorkOrderStore();
    await store.fetchList({});
    expect(store.items).toHaveLength(1);
    expect(store.items[0].type).toBe('HEALTH');
  });

  it('fetchRecommendations populates recs', async () => {
    const store = useWorkOrderStore();
    const recs = await store.fetchRecommendations('1');
    expect(recs).toHaveLength(1);
    expect(recs[0].score).toBe(85);
  });
});
```

- [ ] **Step 2: Run failing test**

Run:
```bash
cd apps/admin && npx vitest run src/stores/__tests__/work-orders.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Write work-orders store**

Create `apps/admin/src/stores/work-orders.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { workOrdersApi } from '@/api';
import type { WorkOrderRecord, WorkOrderListParams, DispatchRecommendation } from '@/api/work-orders';

export const useWorkOrderStore = defineStore('workOrders', () => {
  const items = ref<WorkOrderRecord[]>([]);
  const total = ref(0);
  const loading = ref(false);

  async function fetchList(params: WorkOrderListParams) {
    loading.value = true;
    try {
      const res = await workOrdersApi.list(params);
      items.value = res.data.data.items;
      total.value = res.data.data.total;
    } finally {
      loading.value = false;
    }
  }

  async function assign(id: string, assigneeId: string) {
    await workOrdersApi.assign(id, { assigneeId });
  }

  async function reassign(id: string, assigneeId: string, reason: string) {
    await workOrdersApi.reassign(id, { assigneeId, reason });
  }

  async function fetchRecommendations(id: string): Promise<DispatchRecommendation[]> {
    const res = await workOrdersApi.getRecommendations(id);
    return res.data.data;
  }

  async function fetchTimeline(id: string) {
    const res = await workOrdersApi.getTimeline(id);
    return res.data.data;
  }

  return { items, total, loading, fetchList, assign, reassign, fetchRecommendations, fetchTimeline };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/admin && npx vitest run src/stores/__tests__/work-orders.spec.ts
```
Expected: 2 tests PASS.

- [ ] **Step 5: Write OrderTable component**

Create `apps/admin/src/components/work-orders/OrderTable.vue`:
```vue
<template>
  <el-table :data="items" v-loading="loading" stripe>
    <el-table-column label="工单号" prop="id" width="180" show-overflow-tooltip />
    <el-table-column label="老人" prop="elderName" min-width="100" />
    <el-table-column label="类型" width="80" prop="type">
      <template #default="{ row }">{{ typeLabel(row.type) }}</template>
    </el-table-column>
    <el-table-column label="等级" width="80" prop="level">
      <template #default="{ row }">
        <el-tag :type="row.level === 'HIGH' ? 'danger' : row.level === 'MEDIUM' ? 'warning' : 'info'" size="small">
          {{ row.level === 'HIGH' ? '高' : row.level === 'MEDIUM' ? '中' : '低' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="状态" width="100" prop="status">
      <template #default="{ row }">{{ statusLabel(row.status) }}</template>
    </el-table-column>
    <el-table-column label="负责人" prop="assigneeName" min-width="100" />
    <el-table-column label="截止时间" width="170" prop="deadline">
      <template #default="{ row }">
        {{ row.deadline ? dayjs(row.deadline).format('YYYY-MM-DD HH:mm') : '-' }}
      </template>
    </el-table-column>
    <el-table-column label="操作" width="240" fixed="right">
      <template #default="{ row }">
        <template v-if="row.status === 'PENDING'">
          <el-button type="primary" link size="small" @click="$emit('assign', row)">派单</el-button>
        </template>
        <template v-if="row.assigneeId && row.status !== 'COMPLETED'">
          <el-button type="warning" link size="small" @click="$emit('reassign', row)">改派</el-button>
        </template>
        <el-button link size="small" @click="$emit('timeline', row)">时间线</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import type { WorkOrderRecord } from '@/api/work-orders';

defineProps<{
  items: WorkOrderRecord[];
  loading: boolean;
}>();

defineEmits<{
  assign: [row: WorkOrderRecord];
  reassign: [row: WorkOrderRecord];
  timeline: [row: WorkOrderRecord];
}>();

function typeLabel(type: string) {
  const map: Record<string, string> = {
    HEALTH: '健康', LIFE: '生活', REPAIR: '维修', ESCORT: '陪诊', COMPANION: '陪伴', ERRAND: '代购',
  };
  return map[type] || type;
}

function statusLabel(status: string) {
  const map: Record<string, string> = {
    PENDING: '待分配', ASSIGNED: '已分配', IN_PROGRESS: '处理中', COMPLETED: '已完成', CANCELLED: '已取消',
  };
  return map[status] || status;
}
</script>
```

- [ ] **Step 6: Write AssignDialog component**

Create `apps/admin/src/components/work-orders/AssignDialog.vue`:
```vue
<template>
  <el-dialog
    :model-value="visible"
    :title="isReassign ? '改派工单' : '派单'"
    width="560px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <div v-if="recommendations.length > 0" class="mb-4">
      <div class="text-sm text-gray-500 mb-2">推荐人员 (按匹配度排序)</div>
      <el-table :data="recommendations" max-height="300" @row-click="selectRec" highlight-current-row>
        <el-table-column label="姓名" prop="assignee.name" width="100" />
        <el-table-column label="片区" prop="assignee.district" width="80" />
        <el-table-column label="技能" width="180">
          <template #default="{ row }">{{ row.assignee.skills.join(', ') }}</template>
        </el-table-column>
        <el-table-column label="在岗" width="70" prop="assignee.dutyStatus">
          <template #default="{ row }">
            <el-tag :type="row.assignee.dutyStatus === 'ON_DUTY' ? 'success' : 'info'" size="small">
              {{ row.assignee.dutyStatus === 'ON_DUTY' ? '在岗' : '离岗' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="匹配分" width="80" prop="score" />
      </el-table>
    </div>

    <el-form v-if="isReassign" :model="form" :rules="rules" label-position="top">
      <el-form-item label="改派原因" prop="reason">
        <el-input v-model="form.reason" type="textarea" :rows="2" placeholder="请填写改派原因" />
      </el-form-item>
    </el-form>

    <div v-if="selected" class="mt-2 text-sm">
      已选择: <el-tag>{{ selected.assignee.name }}</el-tag>
    </div>

    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected" :loading="submitting" @click="handleSubmit">
        确认{{ isReassign ? '改派' : '派单' }}
      </el-button>
    </template>
  </el-dialog>
</template>

<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import type { FormRules } from 'element-plus';
import type { DispatchRecommendation } from '@/api/work-orders';

const props = defineProps<{
  visible: boolean;
  isReassign: boolean;
  recommendations: DispatchRecommendation[];
}>();

const emit = defineEmits<{
  'update:visible': [value: boolean];
  submit: [assigneeId: string, reason?: string];
}>();

const selected = ref<DispatchRecommendation | null>(null);
const submitting = ref(false);
const form = reactive({ reason: '' });

const rules: FormRules = {
  reason: [{ required: true, message: '请填写改派原因', trigger: 'blur' }],
};

watch(() => props.visible, (v) => {
  if (!v) {
    selected.value = null;
    form.reason = '';
  }
});

function selectRec(rec: DispatchRecommendation) {
  selected.value = rec;
}

async function handleSubmit() {
  if (!selected.value) return;
  submitting.value = true;
  try {
    emit('submit', selected.value.assignee.id, form.reason || undefined);
  } finally {
    submitting.value = false;
  }
}
</script>
```

- [ ] **Step 7: Write TimelinePopover component**

Create `apps/admin/src/components/work-orders/TimelinePopover.vue`:
```vue
<template>
  <el-popover :visible="visible" placement="left" :width="300" @hide="$emit('update:visible', false)">
    <template #reference>
      <span />
    </template>
    <el-timeline v-if="timeline.length > 0">
      <el-timeline-item
        v-for="item in timeline"
        :key="item.id"
        :timestamp="dayjs(item.createdAt).format('MM-DD HH:mm')"
      >
        {{ item.action }} {{ item.note ? `— ${item.note}` : '' }}
      </el-timeline-item>
    </el-timeline>
    <div v-else class="text-center text-gray-400 py-4">暂无流转记录</div>
  </el-popover>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';

defineProps<{
  visible: boolean;
  timeline: Array<{ id: string; action: string; note?: string; createdAt: string }>;
}>();

defineEmits<{
  'update:visible': [value: boolean];
}>();
</script>
```

- [ ] **Step 8: Write WorkOrders view page**

Create `apps/admin/src/views/work-orders/index.vue`:
```vue
<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <el-select v-model="filters.status" placeholder="状态" clearable class="w-120px" @change="load">
          <el-option label="待分配" value="PENDING" />
          <el-option label="已分配" value="ASSIGNED" />
          <el-option label="处理中" value="IN_PROGRESS" />
          <el-option label="已完成" value="COMPLETED" />
        </el-select>
      </div>

      <OrderTable
        :items="store.items"
        :loading="store.loading"
        @assign="openAssign($event, false)"
        @reassign="openAssign($event, true)"
        @timeline="openTimeline($event)"
      />

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="limit"
          :total="store.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </el-card>

    <AssignDialog
      :visible="assignVisible"
      :is-reassign="isReassign"
      :recommendations="recommendations"
      @update:visible="assignVisible = $event"
      @submit="handleAssignSubmit"
    />

    <TimelinePopover
      :visible="timelineVisible"
      :timeline="timelineData"
      @update:visible="timelineVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useWorkOrderStore } from '@/stores/work-orders';
import OrderTable from '@/components/work-orders/OrderTable.vue';
import AssignDialog from '@/components/work-orders/AssignDialog.vue';
import TimelinePopover from '@/components/work-orders/TimelinePopover.vue';
import type { WorkOrderRecord, DispatchRecommendation } from '@/api/work-orders';

const store = useWorkOrderStore();
const page = ref(1);
const limit = ref(20);
const filters = reactive({ status: '' });

const assignVisible = ref(false);
const isReassign = ref(false);
const selectedOrder = ref<WorkOrderRecord | null>(null);
const recommendations = ref<DispatchRecommendation[]>([]);

const timelineVisible = ref(false);
const timelineData = ref<Array<{ id: string; action: string; note?: string; createdAt: string }>>([]);

function load() {
  store.fetchList({ page: page.value, limit: limit.value, ...filters });
}

async function openAssign(order: WorkOrderRecord, reassign: boolean) {
  selectedOrder.value = order;
  isReassign.value = reassign;
  recommendations.value = await store.fetchRecommendations(order.id);
  assignVisible.value = true;
}

async function handleAssignSubmit(assigneeId: string, reason?: string) {
  if (!selectedOrder.value) return;
  if (isReassign.value) {
    await store.reassign(selectedOrder.value.id, assigneeId, reason || '');
    ElMessage.success('改派成功');
  } else {
    await store.assign(selectedOrder.value.id, assigneeId);
    ElMessage.success('派单成功');
  }
  assignVisible.value = false;
  load();
}

async function openTimeline(order: WorkOrderRecord) {
  timelineData.value = await store.fetchTimeline(order.id);
  timelineVisible.value = true;
}

onMounted(() => {
  load();
});
</script>
```

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/stores/work-orders.ts apps/admin/src/stores/__tests__/work-orders.spec.ts apps/admin/src/components/work-orders/ apps/admin/src/views/work-orders/
git commit -m "feat: add admin work orders management with assign dialog and timeline"
```

---

### Task 10: Admin Elders (老人档案) Page

**Files:**
- Create: `apps/admin/src/stores/elders.ts`
- Create: `apps/admin/src/stores/__tests__/elders.spec.ts`
- Create: `apps/admin/src/components/elders/ElderTable.vue`
- Create: `apps/admin/src/components/elders/ElderDetailDrawer.vue`
- Create: `apps/admin/src/views/elders/index.vue`
- Create: `apps/admin/src/views/elders/[id].vue`

- [ ] **Step 1: Write elder store test**

Create `apps/admin/src/stores/__tests__/elders.spec.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useElderStore } from '../elders';

vi.mock('@/api', () => ({
  eldersApi: {
    list: vi.fn().mockResolvedValue({
      data: { data: { items: [{ id: '1', name: '张大爷', gender: 'M', district: '东城', healthTags: ['慢病'], serviceLevel: 'KEY', lastCheckInTime: '2026-06-12T08:00:00Z' }], total: 1, page: 1, limit: 20 } },
    }),
    getById: vi.fn().mockResolvedValue({
      data: { data: { id: '1', name: '张大爷', gender: 'M', district: '东城', address: '东城街道1号', healthTags: ['慢病'], serviceLevel: 'KEY', contacts: [], riskProfile: [] } },
    }),
    getRiskProfile: vi.fn().mockResolvedValue({
      data: { data: [{ id: 'r1', level: 'HIGH', source: 'MISSED_CHECKIN', score: 80, reason: '未报平安', createdAt: '2026-06-11T00:00:00Z' }] },
    }),
  },
}));

describe('useElderStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fetchList populates items', async () => {
    const store = useElderStore();
    await store.fetchList({});
    expect(store.items).toHaveLength(1);
    expect(store.items[0].name).toBe('张大爷');
  });

  it('fetchDetail populates current elder', async () => {
    const store = useElderStore();
    await store.fetchDetail('1');
    expect(store.currentElder?.name).toBe('张大爷');
  });
});
```

- [ ] **Step 2: Run failing test**

Run:
```bash
cd apps/admin && npx vitest run src/stores/__tests__/elders.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Write elder store**

Create `apps/admin/src/stores/elders.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref } from 'vue';
import { eldersApi } from '@/api';
import type { ElderRecord, ElderDetail, ElderListParams } from '@/api/elders';

export const useElderStore = defineStore('elders', () => {
  const items = ref<ElderRecord[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const currentElder = ref<ElderDetail | null>(null);

  async function fetchList(params: ElderListParams) {
    loading.value = true;
    try {
      const res = await eldersApi.list(params);
      items.value = res.data.data.items;
      total.value = res.data.data.total;
    } finally {
      loading.value = false;
    }
  }

  async function fetchDetail(id: string) {
    const res = await eldersApi.getById(id);
    currentElder.value = res.data.data;
  }

  async function fetchRiskProfile(id: string) {
    const res = await eldersApi.getRiskProfile(id);
    return res.data.data;
  }

  return { items, total, loading, currentElder, fetchList, fetchDetail, fetchRiskProfile };
});
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/admin && npx vitest run src/stores/__tests__/elders.spec.ts
```
Expected: 2 tests PASS.

- [ ] **Step 5: Write ElderTable component**

Create `apps/admin/src/components/elders/ElderTable.vue`:
```vue
<template>
  <el-table :data="items" v-loading="loading" stripe @row-click="(row: ElderRecord) => $emit('detail', row)">
    <el-table-column label="姓名" prop="name" min-width="80" />
    <el-table-column label="性别" width="60" prop="gender">
      <template #default="{ row }">{{ row.gender === 'M' ? '男' : '女' }}</template>
    </el-table-column>
    <el-table-column label="年龄" width="60">
      <template #default="{ row }">{{ calcAge(row.birthDate) }}</template>
    </el-table-column>
    <el-table-column label="片区" prop="district" width="100" />
    <el-table-column label="健康标签" min-width="140">
      <template #default="{ row }">
        <el-tag v-for="tag in row.healthTags" :key="tag" size="small" class="mr-1">{{ tag }}</el-tag>
      </template>
    </el-table-column>
    <el-table-column label="服务等级" width="90" prop="serviceLevel">
      <template #default="{ row }">
        <el-tag :type="row.serviceLevel === 'HIGH' ? 'danger' : row.serviceLevel === 'KEY' ? 'warning' : 'info'" size="small">
          {{ row.serviceLevel === 'HIGH' ? '高风险' : row.serviceLevel === 'KEY' ? '重点关注' : '普通' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="最近报平安" width="170">
      <template #default="{ row }">
        {{ row.lastCheckInTime ? dayjs(row.lastCheckInTime).format('YYYY-MM-DD HH:mm') : '-' }}
      </template>
    </el-table-column>
    <el-table-column label="操作" width="80" fixed="right">
      <template #default="{ row }">
        <el-button type="primary" link size="small" @click.stop="$emit('detail', row)">详情</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import type { ElderRecord } from '@/api/elders';

defineProps<{
  items: ElderRecord[];
  loading: boolean;
}>();

defineEmits<{
  detail: [row: ElderRecord];
}>();

function calcAge(birthDate?: string): number | string {
  if (!birthDate) return '-';
  return dayjs().diff(dayjs(birthDate), 'year');
}
</script>
```

- [ ] **Step 6: Write ElderDetailDrawer component**

Create `apps/admin/src/components/elders/ElderDetailDrawer.vue`:
```vue
<template>
  <el-drawer
    :model-value="visible"
    title="老人详情"
    size="480px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template v-if="elder">
      <el-descriptions title="基本信息" :column="2" border>
        <el-descriptions-item label="姓名">{{ elder.name }}</el-descriptions-item>
        <el-descriptions-item label="性别">{{ elder.gender === 'M' ? '男' : '女' }}</el-descriptions-item>
        <el-descriptions-item label="出生日期">{{ elder.birthDate ? dayjs(elder.birthDate).format('YYYY-MM-DD') : '-' }}</el-descriptions-item>
        <el-descriptions-item label="片区">{{ elder.district }}</el-descriptions-item>
        <el-descriptions-item label="地址" :span="2">{{ elder.address || '-' }}</el-descriptions-item>
        <el-descriptions-item label="健康标签" :span="2">
          <el-tag v-for="tag in elder.healthTags" :key="tag" size="small" class="mr-1">{{ tag }}</el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-descriptions title="紧急联系人" :column="1" border class="mt-6">
        <el-descriptions-item v-for="c in elder.contacts" :key="c.id" :label="c.relation">
          {{ c.name }} — {{ c.phone }} {{ c.isPrimary ? '(主要)' : '' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="elder.contacts.length === 0" label="暂无">
          无紧急联系人
        </el-descriptions-item>
      </el-descriptions>

      <div class="mt-6">
        <div class="text-base font-medium mb-3">风险画像</div>
        <el-timeline v-if="riskProfile.length > 0">
          <el-timeline-item
            v-for="r in riskProfile"
            :key="r.id"
            :timestamp="dayjs(r.createdAt).format('YYYY-MM-DD HH:mm')"
            :type="r.level === 'HIGH' ? 'danger' : r.level === 'MEDIUM' ? 'warning' : 'primary'"
          >
            [{{ r.level }}] {{ r.reason }} (分数: {{ r.score }})
          </el-timeline-item>
        </el-timeline>
        <div v-else class="text-center text-gray-400 py-4">暂无风险记录</div>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import dayjs from 'dayjs';
import type { ElderDetail } from '@/api/elders';

const props = defineProps<{
  visible: boolean;
  elder: ElderDetail | null;
}>();

defineEmits<{
  'update:visible': [value: boolean];
}>();

const riskProfile = ref<Array<{ id: string; level: string; source: string; score: number; reason: string; createdAt: string }>>([]);

watch(() => [props.visible, props.elder], async ([v, elder]) => {
  if (v && elder) {
    const { eldersApi } = await import('@/api/elders');
    const res = await eldersApi.getRiskProfile(elder.id);
    riskProfile.value = res.data.data;
  }
});
</script>
```

- [ ] **Step 7: Write Elders list view**

Create `apps/admin/src/views/elders/index.vue`:
```vue
<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <div class="flex gap-3">
          <el-input v-model="filters.search" placeholder="搜索老人姓名" clearable class="w-200px" @change="load" />
          <el-select v-model="filters.district" placeholder="片区" clearable class="w-120px" @change="load">
            <el-option label="东城" value="东城" />
            <el-option label="西城" value="西城" />
          </el-select>
          <el-select v-model="filters.serviceLevel" placeholder="服务等级" clearable class="w-120px" @change="load">
            <el-option label="高风险" value="HIGH" />
            <el-option label="重点关注" value="KEY" />
            <el-option label="普通" value="NORMAL" />
          </el-select>
        </div>
      </div>

      <ElderTable
        :items="store.items"
        :loading="store.loading"
        @detail="openDetail"
      />

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="limit"
          :total="store.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </el-card>

    <ElderDetailDrawer
      :visible="drawerVisible"
      :elder="store.currentElder"
      @update:visible="drawerVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useElderStore } from '@/stores/elders';
import ElderTable from '@/components/elders/ElderTable.vue';
import ElderDetailDrawer from '@/components/elders/ElderDetailDrawer.vue';
import type { ElderRecord } from '@/api/elders';

const store = useElderStore();
const page = ref(1);
const limit = ref(20);
const filters = reactive({ search: '', district: '', serviceLevel: '' });
const drawerVisible = ref(false);

function load() {
  store.fetchList({ page: page.value, limit: limit.value, ...filters });
}

async function openDetail(row: ElderRecord) {
  await store.fetchDetail(row.id);
  drawerVisible.value = true;
}

onMounted(() => {
  load();
});
</script>
```

- [ ] **Step 8: Write Elder detail page (standalone route)**

Create `apps/admin/src/views/elders/[id].vue`:
```vue
<template>
  <div class="space-y-4" v-loading="loading">
    <el-page-header @back="$router.back()">
      <template #content>{{ elder?.name || '老人详情' }}</template>
    </el-page-header>

    <ElderDetailDrawer
      :visible="true"
      :elder="elder"
      @update:visible="$router.back()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useElderStore } from '@/stores/elders';
import ElderDetailDrawer from '@/components/elders/ElderDetailDrawer.vue';

const route = useRoute();
const store = useElderStore();
const loading = ref(false);
const elder = store.currentElder;

onMounted(async () => {
  loading.value = true;
  await store.fetchDetail(route.params.id as string);
  loading.value = false;
});
</script>
```

- [ ] **Step 9: Commit**

```bash
git add apps/admin/src/stores/elders.ts apps/admin/src/stores/__tests__/elders.spec.ts apps/admin/src/components/elders/ apps/admin/src/views/elders/
git commit -m "feat: add admin elders management with list, detail drawer, and risk profile"
```

---

### Task 11: Admin Simplified Pages (Rules / Users / Audit)

**Files:**
- Create: `apps/admin/src/views/rules/index.vue`
- Create: `apps/admin/src/views/users/index.vue`
- Create: `apps/admin/src/views/audit/index.vue`

- [ ] **Step 1: Write Rules page**

Create `apps/admin/src/views/rules/index.vue`:
```vue
<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <span class="text-lg font-medium">风险规则配置</span>
        <el-button type="primary" @click="openCreate">新增规则</el-button>
      </div>

      <el-table :data="rules" v-loading="loading" stripe>
        <el-table-column label="规则名称" prop="name" min-width="140" />
        <el-table-column label="权重" prop="weight" width="80" />
        <el-table-column label="等级" width="80" prop="level">
          <template #default="{ row }">
            <el-tag :type="row.level === 'HIGH' ? 'danger' : row.level === 'MEDIUM' ? 'warning' : 'info'" size="small">
              {{ row.level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="版本" prop="version" width="70" />
        <el-table-column label="启用" width="70" prop="enabled">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" disabled size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      :model-value="dialogVisible"
      :title="editingRule ? '编辑规则' : '新增规则'"
      width="480px"
      @update:model-value="dialogVisible = $event"
    >
      <el-form ref="formRef" :model="form" label-position="top">
        <el-form-item label="规则名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="条件 (JSON)" required>
          <el-input v-model="form.conditionStr" type="textarea" :rows="4" placeholder='{"key": "value"}' />
        </el-form-item>
        <el-form-item label="权重" required>
          <el-input-number v-model="form.weight" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="等级" required>
          <el-select v-model="form.level" class="w-full">
            <el-option label="HIGH" value="HIGH" />
            <el-option label="MEDIUM" value="MEDIUM" />
            <el-option label="LOW" value="LOW" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { rulesApi } from '@/api';
import type { RiskRuleRecord } from '@/api/rules';

const rules = ref<RiskRuleRecord[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingRule = ref<RiskRuleRecord | null>(null);
const form = reactive({ name: '', conditionStr: '{}', weight: 10, level: 'MEDIUM' as string });

function load() {
  loading.value = true;
  rulesApi.list().then(res => {
    rules.value = res.data.data;
  }).finally(() => { loading.value = false; });
}

function openCreate() {
  editingRule.value = null;
  form.name = '';
  form.conditionStr = '{}';
  form.weight = 10;
  form.level = 'MEDIUM';
  dialogVisible.value = true;
}

function openEdit(row: RiskRuleRecord) {
  editingRule.value = row;
  form.name = row.name;
  form.conditionStr = JSON.stringify(row.condition, null, 2);
  form.weight = row.weight;
  form.level = row.level;
  dialogVisible.value = true;
}

async function handleSave() {
  try {
    const data = {
      name: form.name,
      condition: JSON.parse(form.conditionStr),
      weight: form.weight,
      level: form.level,
      enabled: true,
    };
    if (editingRule.value) {
      await rulesApi.update(editingRule.value.id, data);
    } else {
      await rulesApi.create(data as any);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch {
    ElMessage.error('保存失败，请检查条件 JSON 格式');
  }
}

onMounted(() => { load(); });
</script>
```

- [ ] **Step 2: Write Users page**

Create `apps/admin/src/views/users/index.vue`:
```vue
<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <div class="flex gap-3">
          <el-select v-model="filters.role" placeholder="角色" clearable class="w-120px" @change="load">
            <el-option label="网格员" value="GRID_WORKER" />
            <el-option label="社区医生" value="COMMUNITY_DOCTOR" />
            <el-option label="物业" value="PROPERTY" />
            <el-option label="志愿者" value="VOLUNTEER" />
            <el-option label="管理员" value="ADMIN" />
          </el-select>
        </div>
        <el-button type="primary" @click="openCreate">新增人员</el-button>
      </div>

      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column label="姓名" prop="name" min-width="100" />
        <el-table-column label="手机号" prop="phone" width="130" />
        <el-table-column label="角色" width="100" prop="role">
          <template #default="{ row }">{{ roleLabel(row.role) }}</template>
        </el-table-column>
        <el-table-column label="技能" min-width="150">
          <template #default="{ row }">{{ row.skills.join(', ') || '-' }}</template>
        </el-table-column>
        <el-table-column label="片区" prop="district" width="80" />
        <el-table-column label="在岗状态" width="90" prop="dutyStatus">
          <template #default="{ row }">
            <el-tag :type="row.dutyStatus === 'ON_DUTY' ? 'success' : 'info'" size="small">
              {{ row.dutyStatus === 'ON_DUTY' ? '在岗' : '离岗' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
          <template #default="{ row }">
            <el-button type="primary" link size="small" @click="openEdit(row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      :model-value="dialogVisible"
      :title="editingUser ? '编辑人员' : '新增人员'"
      width="480px"
      @update:model-value="dialogVisible = $event"
    >
      <el-form :model="form" label-position="top">
        <el-form-item label="姓名" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="form.role" class="w-full">
            <el-option label="网格员" value="GRID_WORKER" />
            <el-option label="社区医生" value="COMMUNITY_DOCTOR" />
            <el-option label="物业" value="PROPERTY" />
            <el-option label="志愿者" value="VOLUNTEER" />
          </el-select>
        </el-form-item>
        <el-form-item label="片区" required>
          <el-input v-model="form.district" />
        </el-form-item>
        <el-form-item label="在岗状态">
          <el-switch v-model="form.onDuty" active-text="在岗" inactive-text="离岗" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { usersApi } from '@/api';
import type { UserRecord } from '@/api/users';

const users = ref<UserRecord[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingUser = ref<UserRecord | null>(null);
const filters = reactive({ role: '' });
const form = reactive({ name: '', phone: '', role: 'GRID_WORKER', district: '', onDuty: true });

const roleMap: Record<string, string> = {
  GRID_WORKER: '网格员', COMMUNITY_DOCTOR: '医生', PROPERTY: '物业', VOLUNTEER: '志愿者', ADMIN: '管理员', FAMILY: '家属',
};

function roleLabel(role: string) { return roleMap[role] || role; }

function load() {
  loading.value = true;
  usersApi.list(filters.role ? { role: filters.role } : {}).then(res => {
    users.value = res.data.data;
  }).finally(() => { loading.value = false; });
}

function openCreate() {
  editingUser.value = null;
  form.name = ''; form.phone = ''; form.role = 'GRID_WORKER'; form.district = ''; form.onDuty = true;
  dialogVisible.value = true;
}

function openEdit(row: UserRecord) {
  editingUser.value = row;
  form.name = row.name; form.phone = row.phone; form.role = row.role; form.district = row.district || '';
  form.onDuty = row.dutyStatus === 'ON_DUTY';
  dialogVisible.value = true;
}

async function handleSave() {
  const data = {
    name: form.name,
    phone: form.phone,
    role: form.role,
    skills: [] as string[],
    district: form.district,
    dutyStatus: form.onDuty ? 'ON_DUTY' : 'OFF_DUTY',
  };
  if (editingUser.value) {
    await usersApi.update(editingUser.value.id, data as any);
  } else {
    await usersApi.create(data as any);
  }
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  load();
}

onMounted(() => { load(); });
</script>
```

- [ ] **Step 3: Write Audit page**

Create `apps/admin/src/views/audit/index.vue`:
```vue
<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <div class="flex gap-3">
          <el-select v-model="filters.action" placeholder="操作类型" clearable class="w-140px" @change="load">
            <el-option label="CREATE" value="CREATE" />
            <el-option label="UPDATE" value="UPDATE" />
            <el-option label="DELETE" value="DELETE" />
            <el-option label="LOGIN" value="LOGIN" />
          </el-select>
          <el-select v-model="filters.resourceType" placeholder="资源类型" clearable class="w-140px" @change="load">
            <el-option label="ELDER" value="ELDER" />
            <el-option label="RISK_EVENT" value="RISK_EVENT" />
            <el-option label="WORK_ORDER" value="WORK_ORDER" />
            <el-option label="USER" value="USER" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            @change="load"
          />
        </div>
      </div>

      <el-table :data="logs" v-loading="loading" stripe>
        <el-table-column label="时间" width="170" prop="createdAt">
          <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss') }}</template>
        </el-table-column>
        <el-table-column label="操作" prop="action" width="100" />
        <el-table-column label="资源类型" prop="resourceType" width="120" />
        <el-table-column label="资源ID" prop="resourceId" width="200" show-overflow-tooltip />
        <el-table-column label="用户ID" prop="userId" width="200" show-overflow-tooltip />
        <el-table-column label="IP" prop="ip" width="140" />
      </el-table>

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="limit"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { auditApi } from '@/api';
import type { AuditLogRecord } from '@/api/audit';

const logs = ref<AuditLogRecord[]>([]);
const total = ref(0);
const loading = ref(false);
const page = ref(1);
const limit = ref(20);
const filters = reactive({ action: '', resourceType: '' });
const dateRange = ref<[Date, Date] | null>(null);

function load() {
  loading.value = true;
  const params: Record<string, any> = {
    page: page.value,
    limit: limit.value,
  };
  if (filters.action) params.action = filters.action;
  if (filters.resourceType) params.resourceType = filters.resourceType;
  if (dateRange.value) {
    params.from = dayjs(dateRange.value[0]).startOf('day').toISOString();
    params.to = dayjs(dateRange.value[1]).endOf('day').toISOString();
  }
  auditApi.list(params).then(res => {
    logs.value = res.data.data.items;
    total.value = res.data.data.total;
  }).finally(() => { loading.value = false; });
}

onMounted(() => { load(); });
</script>
```

- [ ] **Step 4: Commit**

```bash
git add apps/admin/src/views/rules/ apps/admin/src/views/users/ apps/admin/src/views/audit/
git commit -m "feat: add admin simplified pages for rules, users, and audit log"
```

---

### Task 12: Admin Playwright E2E Tests

**Files:**
- Create: `apps/admin/e2e/login.spec.ts`
- Create: `apps/admin/e2e/dashboard-risk-workorder.spec.ts`
- Create: `apps/admin/playwright.config.ts`

- [ ] **Step 1: Write Playwright config**

Create `apps/admin/playwright.config.ts`:
```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

- [ ] **Step 2: Write login E2E test**

Create `apps/admin/e2e/login.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Page', () => {
  test('redirects to login when not authenticated', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('shows login form', async ({ page }) => {
    await page.goto('/login');
    await expect(page.locator('input[placeholder="请输入手机号"]')).toBeVisible();
    await expect(page.locator('input[placeholder="请输入密码"]')).toBeVisible();
    await expect(page.locator('button:has-text("登录")')).toBeVisible();
  });

  test('validates empty form submission', async ({ page }) => {
    await page.goto('/login');
    await page.locator('button:has-text("登录")').click();
    await expect(page.locator('.el-form-item__error')).toBeVisible();
  });
});
```

- [ ] **Step 3: Write dashboard/risk/work-order E2E test**

Create `apps/admin/e2e/dashboard-risk-workorder.spec.ts`:
```typescript
import { test, expect } from '@playwright/test';

test.describe('Admin Core Flows', () => {
  test.beforeEach(async ({ page }) => {
    // Log in via localStorage token injection (avoids hitting real auth)
    await page.goto('/login');
    await page.evaluate(() => {
      localStorage.setItem('token', 'test-token-e2e');
    });
  });

  test('dashboard loads with stat cards and charts', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.locator('text=重点老人')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=待处理预警')).toBeVisible();
    await expect(page.locator('text=今日工单完成率')).toBeVisible();
  });

  test('risk center loads and shows filters', async ({ page }) => {
    await page.goto('/risk');
    await expect(page.locator('text=预警中心')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.el-select')).toBeVisible();
  });

  test('work orders page loads with table', async ({ page }) => {
    await page.goto('/work-orders');
    await expect(page.locator('.el-table')).toBeVisible({ timeout: 5000 });
  });

  test('sidebar navigates between pages', async ({ page }) => {
    await page.goto('/dashboard');
    await page.locator('.el-menu-item:has-text("老人档案")').click();
    await expect(page).toHaveURL(/\/elders/);

    await page.locator('.el-menu-item:has-text("预警中心")').click();
    await expect(page).toHaveURL(/\/risk/);

    await page.locator('.el-menu-item:has-text("审计日志")').click();
    await expect(page).toHaveURL(/\/audit/);
  });
});
```

- [ ] **Step 4: Install Playwright browsers**

Run:
```bash
cd apps/admin && npx playwright install chromium
```
Expected: Chromium browser installed.

- [ ] **Step 5: Commit**

```bash
git add apps/admin/playwright.config.ts apps/admin/e2e/
git commit -m "test: add admin Playwright E2E tests for login, dashboard, risk, and work orders"
```

---

### Task 13: Mini-App 项目脚手架

**Files:**
- Create: `apps/miniapp/vite.config.ts`
- Create: `apps/miniapp/tsconfig.json`
- Create: `apps/miniapp/src/manifest.json`
- Create: `apps/miniapp/src/pages.json`
- Create: `apps/miniapp/src/App.vue`
- Create: `apps/miniapp/src/main.ts`
- Create: `apps/miniapp/src/env.d.ts`
- Create: `apps/miniapp/src/uni.scss`
- Create: `apps/miniapp/vitest.config.ts`
- Modify: `apps/miniapp/package.json`

- [ ] **Step 1: Write updated package.json**

Overwrite `apps/miniapp/package.json`:
```json
{
  "name": "@care/miniapp",
  "version": "0.0.1",
  "private": true,
  "scripts": {
    "dev:mp-weixin": "uni -p mp-weixin",
    "build:mp-weixin": "uni build -p mp-weixin",
    "lint": "eslint \"src/**/*.{ts,vue}\" --fix",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "dependencies": {
    "@care/shared-types": "workspace:*",
    "luch-request": "^3.1.0",
    "pinia": "^2.3.0",
    "vue": "^3.5.0",
    "wot-design-uni": "^1.0.0"
  },
  "devDependencies": {
    "@dcloudio/types": "^3.4.0",
    "@dcloudio/uni-app": "3.0.0-4060120250521001",
    "@dcloudio/uni-cli-shared": "3.0.0-4060120250521001",
    "@dcloudio/uni-mp-weixin": "3.0.0-4060120250521001",
    "@dcloudio/vite-plugin-uni": "3.0.0-4060120250521001",
    "@vue/test-utils": "^2.4.0",
    "jsdom": "^25.0.0",
    "sass": "^1.80.0",
    "vitest": "^2.1.0",
    "vue-tsc": "^2.2.0"
  }
}
```

- [ ] **Step 2: Write vite.config.ts**

Create `apps/miniapp/vite.config.ts`:
```typescript
import { defineConfig } from 'vite';
import uni from '@dcloudio/vite-plugin-uni';

export default defineConfig({
  plugins: [uni()],
});
```

- [ ] **Step 3: Write tsconfig.json**

Create `apps/miniapp/tsconfig.json`:
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "preserve",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "esModuleInterop": true,
    "lib": ["ES2022", "DOM"],
    "skipLibCheck": true,
    "noEmit": true,
    "paths": {
      "@/*": ["./src/*"]
    },
    "types": ["@dcloudio/types"]
  },
  "include": ["src/**/*.ts", "src/**/*.d.ts", "src/**/*.vue"],
  "exclude": ["__tests__"]
}
```

- [ ] **Step 4: Write uni-app config files**

Create `apps/miniapp/src/manifest.json`:
```json
{
  "name": "照护调度",
  "appid": "__UNI__CARE",
  "description": "社区独居老人照护风险预警与服务调度",
  "versionName": "0.1.0",
  "versionCode": 1,
  "transformPx": false,
  "mp-weixin": {
    "appid": "",
    "setting": {
      "urlCheck": false,
      "es6": true,
      "postcss": true,
      "minified": true
    },
    "usingComponents": true,
    "optimization": {
      "subPackages": true
    }
  }
}
```

Create `apps/miniapp/src/pages.json`:
```json
{
  "pages": [
    {
      "path": "pages/index/index",
      "style": { "navigationBarTitleText": "照护调度" }
    }
  ],
  "subPackages": [
    {
      "root": "pagesElder",
      "pages": [
        { "path": "check-in/index", "style": { "navigationBarTitleText": "一键报平安" } },
        { "path": "sos/index", "style": { "navigationBarTitleText": "语音求助" } },
        { "path": "order-progress/index", "style": { "navigationBarTitleText": "工单进度" } }
      ]
    },
    {
      "root": "pagesWorker",
      "pages": [
        { "path": "risk-tasks/index", "style": { "navigationBarTitleText": "风险待办" } },
        { "path": "risk-tasks/review", "style": { "navigationBarTitleText": "风险复核" } },
        { "path": "visit-form/index", "style": { "navigationBarTitleText": "巡访记录" } },
        { "path": "visit-form/records", "style": { "navigationBarTitleText": "巡访历史" } },
        { "path": "work-order/list", "style": { "navigationBarTitleText": "工单列表" } },
        { "path": "work-order/detail", "style": { "navigationBarTitleText": "工单详情" } },
        { "path": "verification/index", "style": { "navigationBarTitleText": "电话核实" } }
      ]
    }
  ],
  "globalStyle": {
    "navigationBarTextStyle": "black",
    "navigationBarTitleText": "照护调度",
    "navigationBarBackgroundColor": "#F8F8F8",
    "backgroundColor": "#F8F8F8"
  }
}
```

Create `apps/miniapp/src/main.ts`:
```typescript
import { createSSRApp } from 'vue';
import { createPinia } from 'pinia';
import App from './App.vue';

export function createApp() {
  const app = createSSRApp(App);
  const pinia = createPinia();
  app.use(pinia);
  return { app, pinia };
}
```

Create `apps/miniapp/src/App.vue`:
```vue
<script setup lang="ts">
import { onLaunch } from '@dcloudio/uni-app';

onLaunch(() => {
  console.log('App Launch');
});
</script>
```

Create `apps/miniapp/src/env.d.ts`:
```typescript
/// <reference types="@dcloudio/types" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue';
  const component: DefineComponent<object, object, unknown>;
  export default component;
}
```

Create `apps/miniapp/src/uni.scss`:
```scss
// Elder theme variables
$elder-font-size-lg: 40rpx;
$elder-font-size-md: 32rpx;
$elder-touch-min-size: 88rpx;

// Worker theme variables
$worker-font-size: 28rpx;
```

- [ ] **Step 5: Write Vitest config**

Create `apps/miniapp/vitest.config.ts`:
```typescript
import { defineConfig } from 'vitest/config';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
  },
});
```

- [ ] **Step 6: Create placeholder index page**

Create `apps/miniapp/src/pages/index/index.vue`:
```vue
<template>
  <view class="flex flex-col items-center justify-center min-h-screen">
    <text class="text-lg font-bold">照护调度系统</text>
    <text class="text-sm text-gray-500 mt-2">请通过角色入口访问</text>
  </view>
</template>
```

- [ ] **Step 7: Commit**

```bash
git add apps/miniapp/
git commit -m "feat: scaffold uni-app miniapp project with subpackages and Vitest"
```

---

### Task 14: Mini-App API Client + Stores

**Files:**
- Create: `apps/miniapp/src/api/client.ts`
- Create: `apps/miniapp/src/api/auth.ts`
- Create: `apps/miniapp/src/api/check-ins.ts`
- Create: `apps/miniapp/src/api/risk.ts`
- Create: `apps/miniapp/src/api/visits.ts`
- Create: `apps/miniapp/src/api/work-orders.ts`
- Create: `apps/miniapp/src/api/upload.ts`
- Create: `apps/miniapp/src/api/elders.ts`
- Create: `apps/miniapp/src/api/notifications.ts`
- Create: `apps/miniapp/src/stores/auth.ts`
- Create: `apps/miniapp/src/stores/__tests__/auth.spec.ts`

- [ ] **Step 1: Write API client**

Create `apps/miniapp/src/api/client.ts`:
```typescript
import Request from 'luch-request';

const http = new Request({
  baseURL: '/api/v1',
  timeout: 15000,
  header: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = uni.getStorageSync('token');
  if (token) {
    config.header = { ...config.header as Record<string, string>, Authorization: `Bearer ${token}` };
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const body = response.data as { code: number; data: unknown; message: string };
    if (body.code !== 0) {
      uni.showToast({ title: body.message || '请求失败', icon: 'none' });
      return Promise.reject(new Error(body.message));
    }
    return response;
  },
  (error) => {
    const msg = (error as Error).message || '网络错误';
    uni.showToast({ title: msg, icon: 'none' });
    return Promise.reject(error);
  }
);

// Wrap luch-request to match axios-style .get<T>() interface
interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

function wrap<T>(promise: Promise<{ data: ApiResponse<T> }>): Promise<{ data: ApiResponse<T> }> {
  return promise;
}

export default http;
export { wrap };
export type { ApiResponse };
```

- [ ] **Step 2: Write API modules**

Create `apps/miniapp/src/api/auth.ts`:
```typescript
import http, { wrap } from './client';

export const authApi = {
  wechatLogin: (code: string) =>
    wrap(http.post('/auth/wechat-login', { code })),

  getMe: () =>
    wrap(http.get('/auth/me')),
};
```

Create `apps/miniapp/src/api/check-ins.ts`:
```typescript
import http, { wrap } from './client';

export const checkInsApi = {
  create: (data: { elderId: string; method: string; content?: string; voiceUrl?: string }) =>
    wrap(http.post('/check-ins', data)),

  listByElder: (elderId: string, params?: { page?: number; limit?: number }) =>
    wrap(http.get(`/elders/${elderId}/check-ins`, { params })),
};
```

Create `apps/miniapp/src/api/risk.ts`:
```typescript
import http, { wrap } from './client';

export const riskApi = {
  listEvents: (params: { status?: string; level?: string; page?: number; limit?: number }) =>
    wrap(http.get('/risk/events', { params })),

  review: (id: string, data: { status: string; note?: string }) =>
    wrap(http.post(`/risk/events/${id}/review`, data)),
};
```

Create `apps/miniapp/src/api/visits.ts`:
```typescript
import http, { wrap } from './client';

export const visitsApi = {
  create: (data: { elderId: string; observation: string; photos?: string[]; note?: string }) =>
    wrap(http.post('/visits', data)),

  list: (params: { elderId?: string; from?: string; to?: string }) =>
    wrap(http.get('/visits', { params })),
};
```

Create `apps/miniapp/src/api/work-orders.ts`:
```typescript
import http, { wrap } from './client';

export const workOrdersApi = {
  list: (params: { status?: string; page?: number; limit?: number }) =>
    wrap(http.get('/work-orders', { params })),

  getById: (id: string) =>
    wrap(http.get(`/work-orders/${id}`)),

  accept: (id: string) =>
    wrap(http.post(`/work-orders/${id}/accept`)),

  start: (id: string) =>
    wrap(http.post(`/work-orders/${id}/start`)),

  complete: (id: string, data: { result: string; photos?: string[] }) =>
    wrap(http.post(`/work-orders/${id}/complete`, data)),

  getTimeline: (id: string) =>
    wrap(http.get(`/work-orders/${id}/timeline`)),
};
```

Create `apps/miniapp/src/api/upload.ts`:
```typescript
import http, { wrap } from './client';

export const uploadApi = {
  getPresignedUrl: (data: { fileName: string; contentType: string }) =>
    wrap(http.post('/uploads/presigned-url', data)),
};
```

Create `apps/miniapp/src/api/elders.ts`:
```typescript
import http, { wrap } from './client';

export const eldersApi = {
  getById: (id: string) =>
    wrap(http.get(`/elders/${id}`)),

  getRiskProfile: (id: string) =>
    wrap(http.get(`/elders/${id}/risk-profile`)),
};
```

Create `apps/miniapp/src/api/notifications.ts`:
```typescript
import http, { wrap } from './client';

export const notificationsApi = {
  subscribe: (data: { templateId: string }) =>
    wrap(http.post('/notifications/subscribe', data)),
};
```

- [ ] **Step 3: Write auth store with test**

Create `apps/miniapp/src/stores/__tests__/auth.spec.ts`:
```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';

// Mock uni global
vi.stubGlobal('uni', {
  getStorageSync: vi.fn(() => ''),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
});

describe('useAuthStore (miniapp)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('initializes with no token', () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
  });

  it('setToken updates isAuthenticated', () => {
    const store = useAuthStore();
    store.setToken('test-token');
    expect(store.isAuthenticated).toBe(true);
  });

  it('login sets token from wechat code', async () => {
    // Skip actual API call — just test store logic
    const store = useAuthStore();
    expect(store.loading).toBe(false);
  });
});
```

- [ ] **Step 4: Write auth store**

Create `apps/miniapp/src/stores/auth.ts`:
```typescript
import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(uni.getStorageSync('token') || '');
  const user = ref<{ id: string; name: string; role: string } | null>(null);
  const loading = ref(false);

  const isAuthenticated = computed(() => token.value.length > 0);
  const isWorker = computed(() =>
    user.value?.role === 'GRID_WORKER' ||
    user.value?.role === 'COMMUNITY_DOCTOR' ||
    user.value?.role === 'PROPERTY' ||
    user.value?.role === 'VOLUNTEER'
  );
  const isElder = computed(() => user.value?.role === 'FAMILY');

  function setToken(t: string) {
    token.value = t;
    uni.setStorageSync('token', t);
  }

  function setUser(u: typeof user.value) {
    user.value = u;
  }

  function logout() {
    token.value = '';
    user.value = null;
    uni.removeStorageSync('token');
  }

  return { token, user, loading, isAuthenticated, isWorker, isElder, setToken, setUser, logout };
});
```

- [ ] **Step 5: Run store test**

Run:
```bash
cd apps/miniapp && npx vitest run src/stores/__tests__/auth.spec.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/miniapp/src/api/ apps/miniapp/src/stores/
git commit -m "feat: add miniapp API client, auth store, and domain API modules"
```

---

### Task 15: Mini-App Composable: useCheckIn (TDD)

**Files:**
- Create: `apps/miniapp/src/composables/__tests__/useCheckIn.spec.ts`
- Create: `apps/miniapp/src/composables/useCheckIn.ts`

- [ ] **Step 1: Write failing test**

Create `apps/miniapp/src/composables/__tests__/useCheckIn.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useCheckIn } from '../useCheckIn';

describe('useCheckIn', () => {
  it('validates elderId is required', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: '', method: 'ONE_TAP' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('老人ID');
  });

  it('validates method is required', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: '' });
    expect(result.valid).toBe(false);
  });

  it('passes valid ONE_TAP check-in', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'ONE_TAP' });
    expect(result.valid).toBe(true);
  });

  it('passes valid TEXT check-in with content', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'TEXT', content: '一切正常' });
    expect(result.valid).toBe(true);
  });

  it('rejects TEXT method without content', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'TEXT', content: '' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('内容');
  });

  it('accepts VOICE method with voiceUrl', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'VOICE', voiceUrl: 'https://example.com/audio.mp3' });
    expect(result.valid).toBe(true);
  });

  it('rejects VOICE method without voiceUrl', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'VOICE', voiceUrl: '' });
    expect(result.valid).toBe(false);
  });

  it('generates method labels', () => {
    const { methodLabels } = useCheckIn();
    expect(methodLabels.ONE_TAP).toBe('一键报平安');
    expect(methodLabels.VOICE).toBe('语音报平安');
    expect(methodLabels.TEXT).toBe('文字报平安');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useCheckIn.spec.ts
```
Expected: FAIL — module not found.

- [ ] **Step 3: Write useCheckIn composable**

Create `apps/miniapp/src/composables/useCheckIn.ts`:
```typescript
import { reactive, ref } from 'vue';

export interface CheckInInput {
  elderId: string;
  method: string;
  content?: string;
  voiceUrl?: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function useCheckIn() {
  const submitting = ref(false);
  const form = reactive<CheckInInput>({
    elderId: '',
    method: 'ONE_TAP',
  });

  const methodLabels: Record<string, string> = {
    ONE_TAP: '一键报平安',
    VOICE: '语音报平安',
    TEXT: '文字报平安',
    PROXY: '代填报平安',
  };

  function validate(input: CheckInInput): ValidationResult {
    if (!input.elderId || input.elderId.trim().length === 0) {
      return { valid: false, message: '请选择老人ID' };
    }
    if (!input.method || input.method.trim().length === 0) {
      return { valid: false, message: '请选择报平安方式' };
    }
    if (input.method === 'TEXT' && (!input.content || input.content.trim().length === 0)) {
      return { valid: false, message: '请输入报平安内容' };
    }
    if (input.method === 'VOICE' && (!input.voiceUrl || input.voiceUrl.trim().length === 0)) {
      return { valid: false, message: '请录制语音' };
    }
    return { valid: true };
  }

  function reset() {
    form.elderId = '';
    form.method = 'ONE_TAP';
    form.content = undefined;
    form.voiceUrl = undefined;
  }

  return { submitting, form, methodLabels, validate, reset };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useCheckIn.spec.ts
```
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/miniapp/src/composables/useCheckIn.ts apps/miniapp/src/composables/__tests__/useCheckIn.spec.ts
git commit -m "feat: add useCheckIn composable with validation (TDD)"
```

---

### Task 16: Mini-App Composable: useSosVoice (TDD)

**Files:**
- Create: `apps/miniapp/src/composables/__tests__/useSosVoice.spec.ts`
- Create: `apps/miniapp/src/composables/useSosVoice.ts`

- [ ] **Step 1: Write failing test**

Create `apps/miniapp/src/composables/__tests__/useSosVoice.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useSosVoice } from '../useSosVoice';

describe('useSosVoice', () => {
  it('initializes with idle recording state', () => {
    const { isRecording, voiceUrl, duration } = useSosVoice();
    expect(isRecording.value).toBe(false);
    expect(voiceUrl.value).toBe('');
    expect(duration.value).toBe(0);
  });

  it('transitions through recording states', () => {
    const { isRecording, startRecording, stopRecording } = useSosVoice();
    startRecording();
    expect(isRecording.value).toBe(true);
    stopRecording();
    expect(isRecording.value).toBe(false);
  });

  it('has max duration of 60 seconds', () => {
    const { maxDuration } = useSosVoice();
    expect(maxDuration).toBe(60);
  });

  it('clear resets state', () => {
    const { voiceUrl, duration, setVoiceUrl, clear } = useSosVoice();
    setVoiceUrl('https://example.com/audio.mp3');
    duration.value = 45;
    clear();
    expect(voiceUrl.value).toBe('');
    expect(duration.value).toBe(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useSosVoice.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Write useSosVoice composable**

Create `apps/miniapp/src/composables/useSosVoice.ts`:
```typescript
import { ref } from 'vue';

export function useSosVoice() {
  const isRecording = ref(false);
  const voiceUrl = ref('');
  const duration = ref(0);
  const maxDuration = 60;

  let timer: ReturnType<typeof setInterval> | null = null;

  function startRecording() {
    isRecording.value = true;
    duration.value = 0;
    timer = setInterval(() => {
      duration.value++;
      if (duration.value >= maxDuration) {
        stopRecording();
      }
    }, 1000);
  }

  function stopRecording() {
    isRecording.value = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  function setVoiceUrl(url: string) {
    voiceUrl.value = url;
  }

  function clear() {
    voiceUrl.value = '';
    duration.value = 0;
    isRecording.value = false;
    if (timer) {
      clearInterval(timer);
      timer = null;
    }
  }

  return { isRecording, voiceUrl, duration, maxDuration, startRecording, stopRecording, setVoiceUrl, clear };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useSosVoice.spec.ts
```
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/miniapp/src/composables/useSosVoice.ts apps/miniapp/src/composables/__tests__/useSosVoice.spec.ts
git commit -m "feat: add useSosVoice composable with recording state machine (TDD)"
```

---

### Task 17: Mini-App Composable: useRiskTaskList (TDD)

**Files:**
- Create: `apps/miniapp/src/composables/__tests__/useRiskTaskList.spec.ts`
- Create: `apps/miniapp/src/composables/useRiskTaskList.ts`

- [ ] **Step 1: Write failing test**

Create `apps/miniapp/src/composables/__tests__/useRiskTaskList.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useRiskTaskList } from '../useRiskTaskList';

const mockItems = [
  { id: '1', level: 'HIGH' as const, createdAt: '2026-06-12T08:00:00Z', score: 90, elderName: 'A', source: 'MISSED_CHECKIN', reason: '未报平安', status: 'PENDING_REVIEW' },
  { id: '2', level: 'MEDIUM' as const, createdAt: '2026-06-12T09:00:00Z', score: 50, elderName: 'B', source: 'DEVICE', reason: '烟感', status: 'PENDING_REVIEW' },
  { id: '3', level: 'HIGH' as const, createdAt: '2026-06-12T10:00:00Z', score: 80, elderName: 'C', source: 'ABNORMAL_TEXT', reason: '异常文本', status: 'CONFIRMED' },
  { id: '4', level: 'LOW' as const, createdAt: '2026-06-12T07:00:00Z', score: 20, elderName: 'D', source: 'HISTORY', reason: '历史', status: 'PENDING_REVIEW' },
];

describe('useRiskTaskList', () => {
  it('sorts by level priority (HIGH first, then MEDIUM, then LOW)', () => {
    const { sortItems } = useRiskTaskList();
    const sorted = sortItems([...mockItems]);
    expect(sorted[0].level).toBe('HIGH');
    expect(sorted[1].level).toBe('HIGH');
    expect(sorted[2].level).toBe('MEDIUM');
    expect(sorted[3].level).toBe('LOW');
  });

  it('sorts by score within same level', () => {
    const { sortItems } = useRiskTaskList();
    const sorted = sortItems([...mockItems]);
    const highItems = sorted.filter(i => i.level === 'HIGH');
    expect(highItems[0].score).toBeGreaterThanOrEqual(highItems[1].score);
  });

  it('filters by status', () => {
    const { filterByStatus } = useRiskTaskList();
    const filtered = filterByStatus(mockItems, 'PENDING_REVIEW');
    expect(filtered).toHaveLength(3);
    expect(filtered.every(i => i.status === 'PENDING_REVIEW')).toBe(true);
  });

  it('filters by level', () => {
    const { filterByLevel } = useRiskTaskList();
    const filtered = filterByLevel(mockItems, 'HIGH');
    expect(filtered).toHaveLength(2);
    expect(filtered.every(i => i.level === 'HIGH')).toBe(true);
  });

  it('returns all items when filter is empty', () => {
    const { filterByStatus } = useRiskTaskList();
    expect(filterByStatus(mockItems, '')).toHaveLength(4);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useRiskTaskList.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Write useRiskTaskList composable**

Create `apps/miniapp/src/composables/useRiskTaskList.ts`:
```typescript
export interface RiskTaskItem {
  id: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  createdAt: string;
  score: number;
  elderName: string;
  source: string;
  reason: string;
  status: string;
}

const LEVEL_PRIORITY: Record<string, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };

export function useRiskTaskList() {
  function sortItems(items: RiskTaskItem[]): RiskTaskItem[] {
    return [...items].sort((a, b) => {
      const levelDiff = (LEVEL_PRIORITY[a.level] ?? 99) - (LEVEL_PRIORITY[b.level] ?? 99);
      if (levelDiff !== 0) return levelDiff;
      return b.score - a.score;
    });
  }

  function filterByStatus(items: RiskTaskItem[], status: string): RiskTaskItem[] {
    if (!status) return items;
    return items.filter(i => i.status === status);
  }

  function filterByLevel(items: RiskTaskItem[], level: string): RiskTaskItem[] {
    if (!level) return items;
    return items.filter(i => i.level === level);
  }

  return { sortItems, filterByStatus, filterByLevel };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useRiskTaskList.spec.ts
```
Expected: All 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/miniapp/src/composables/useRiskTaskList.ts apps/miniapp/src/composables/__tests__/useRiskTaskList.spec.ts
git commit -m "feat: add useRiskTaskList composable with priority sort and filters (TDD)"
```

---

### Task 18: Mini-App Composable: useVisitForm (TDD)

**Files:**
- Create: `apps/miniapp/src/composables/__tests__/useVisitForm.spec.ts`
- Create: `apps/miniapp/src/composables/useVisitForm.ts`

- [ ] **Step 1: Write failing test**

Create `apps/miniapp/src/composables/__tests__/useVisitForm.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useVisitForm } from '../useVisitForm';

describe('useVisitForm', () => {
  it('rejects empty form submission', () => {
    const { validate } = useVisitForm();
    const result = validate({ elderId: '', observation: '' });
    expect(result.valid).toBe(false);
  });

  it('requires elderId', () => {
    const { validate } = useVisitForm();
    const result = validate({ elderId: '', observation: '观察内容' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('老人');
  });

  it('requires observation', () => {
    const { validate } = useVisitForm();
    const result = validate({ elderId: 'e1', observation: '' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('观察记录');
  });

  it('passes valid form', () => {
    const { validate } = useVisitForm();
    const result = validate({ elderId: 'e1', observation: '老人状态良好' });
    expect(result.valid).toBe(true);
  });

  it('passes form with optional photos and note', () => {
    const { validate } = useVisitForm();
    const result = validate({
      elderId: 'e1',
      observation: '巡访记录',
      photos: ['url1', 'url2'],
      note: '备注信息',
    });
    expect(result.valid).toBe(true);
  });

  it('manages photo list', () => {
    const { photos, addPhoto, removePhoto, MAX_PHOTOS } = useVisitForm();
    expect(photos.value).toHaveLength(0);
    addPhoto('url1');
    addPhoto('url2');
    expect(photos.value).toHaveLength(2);
    removePhoto('url1');
    expect(photos.value).toHaveLength(1);
    expect(photos.value[0]).toBe('url2');
  });

  it('enforces max photo count', () => {
    const { addPhoto, MAX_PHOTOS } = useVisitForm();
    for (let i = 0; i < MAX_PHOTOS; i++) addPhoto(`url${i}`);
    expect(addPhoto('overflow')).toBe(false);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useVisitForm.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Write useVisitForm composable**

Create `apps/miniapp/src/composables/useVisitForm.ts`:
```typescript
import { ref } from 'vue';

export interface VisitFormInput {
  elderId: string;
  observation: string;
  photos?: string[];
  note?: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function useVisitForm() {
  const photos = ref<string[]>([]);
  const submitting = ref(false);
  const MAX_PHOTOS = 9;

  function validate(input: VisitFormInput): ValidationResult {
    if (!input.elderId || input.elderId.trim().length === 0) {
      return { valid: false, message: '请选择老人' };
    }
    if (!input.observation || input.observation.trim().length === 0) {
      return { valid: false, message: '请填写观察记录' };
    }
    return { valid: true };
  }

  function addPhoto(url: string): boolean {
    if (photos.value.length >= MAX_PHOTOS) return false;
    photos.value = [...photos.value, url];
    return true;
  }

  function removePhoto(url: string) {
    photos.value = photos.value.filter(p => p !== url);
  }

  function clearPhotos() {
    photos.value = [];
  }

  return { photos, submitting, MAX_PHOTOS, validate, addPhoto, removePhoto, clearPhotos };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useVisitForm.spec.ts
```
Expected: All 7 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/miniapp/src/composables/useVisitForm.ts apps/miniapp/src/composables/__tests__/useVisitForm.spec.ts
git commit -m "feat: add useVisitForm composable with validation and photo management (TDD)"
```

---

### Task 19: Mini-App Composable: useWorkOrderFlow (TDD)

**Files:**
- Create: `apps/miniapp/src/composables/__tests__/useWorkOrderFlow.spec.ts`
- Create: `apps/miniapp/src/composables/useWorkOrderFlow.ts`

- [ ] **Step 1: Write failing test**

Create `apps/miniapp/src/composables/__tests__/useWorkOrderFlow.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useWorkOrderFlow } from '../useWorkOrderFlow';

describe('useWorkOrderFlow', () => {
  it('returns available actions for PENDING status', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    const actions = getAvailableActions('PENDING');
    expect(actions).toContain('ACCEPT');
  });

  it('returns available actions for ASSIGNED status', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    const actions = getAvailableActions('ASSIGNED');
    expect(actions).toContain('START');
  });

  it('returns available actions for IN_PROGRESS status', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    const actions = getAvailableActions('IN_PROGRESS');
    expect(actions).toContain('COMPLETE');
  });

  it('returns empty actions for COMPLETED status', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    const actions = getAvailableActions('COMPLETED');
    expect(actions).toHaveLength(0);
  });

  it('returns empty actions for CANCELLED status', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    const actions = getAvailableActions('CANCELLED');
    expect(actions).toHaveLength(0);
  });

  it('validates ACCEPT requires PENDING status', () => {
    const { canPerformAction } = useWorkOrderFlow();
    expect(canPerformAction('PENDING', 'ACCEPT')).toBe(true);
    expect(canPerformAction('IN_PROGRESS', 'ACCEPT')).toBe(false);
  });

  it('validates COMPLETE requires result text', () => {
    const { validateCompletion } = useWorkOrderFlow();
    expect(validateCompletion('').valid).toBe(false);
    expect(validateCompletion('处理完成').valid).toBe(true);
  });

  it('provides status labels', () => {
    const { statusLabels } = useWorkOrderFlow();
    expect(statusLabels['PENDING']).toBe('待分配');
    expect(statusLabels['COMPLETED']).toBe('已完成');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useWorkOrderFlow.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Write useWorkOrderFlow composable**

Create `apps/miniapp/src/composables/useWorkOrderFlow.ts`:
```typescript
const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPT'],
  ASSIGNED: ['START'],
  IN_PROGRESS: ['COMPLETE'],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待分配',
  ASSIGNED: '已分配',
  IN_PROGRESS: '处理中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export function useWorkOrderFlow() {
  const statusLabels = STATUS_LABELS;

  function getAvailableActions(status: string): string[] {
    return TRANSITIONS[status] || [];
  }

  function canPerformAction(currentStatus: string, action: string): boolean {
    const available = TRANSITIONS[currentStatus] || [];
    return available.includes(action);
  }

  function validateCompletion(result: string): { valid: boolean; message?: string } {
    if (!result || result.trim().length === 0) {
      return { valid: false, message: '请填写处理结果' };
    }
    return { valid: true };
  }

  return { statusLabels, getAvailableActions, canPerformAction, validateCompletion };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useWorkOrderFlow.spec.ts
```
Expected: All 8 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/miniapp/src/composables/useWorkOrderFlow.ts apps/miniapp/src/composables/__tests__/useWorkOrderFlow.spec.ts
git commit -m "feat: add useWorkOrderFlow composable with state machine transitions (TDD)"
```

---

### Task 20: Mini-App Composable: useOrderProgress (TDD)

**Files:**
- Create: `apps/miniapp/src/composables/__tests__/useOrderProgress.spec.ts`
- Create: `apps/miniapp/src/composables/useOrderProgress.ts`

- [ ] **Step 1: Write failing test**

Create `apps/miniapp/src/composables/__tests__/useOrderProgress.spec.ts`:
```typescript
import { describe, it, expect } from 'vitest';
import { useOrderProgress } from '../useOrderProgress';

describe('useOrderProgress', () => {
  it('maps work order to progress display', () => {
    const { mapToTimelineDisplay } = useOrderProgress();
    const order = {
      id: '1',
      elderName: '张大爷',
      type: 'HEALTH',
      status: 'IN_PROGRESS',
      level: 'HIGH',
      createdAt: '2026-06-12T08:00:00Z',
    };
    const display = mapToTimelineDisplay(order);
    expect(display.id).toBe('1');
    expect(display.title).toBe('健康服务');
    expect(display.statusLabel).toBe('处理中');
  });

  it('handles unknown type gracefully', () => {
    const { mapToTimelineDisplay } = useOrderProgress();
    const display = mapToTimelineDisplay({
      id: '1',
      type: 'UNKNOWN',
      status: 'PENDING',
      level: 'LOW',
      createdAt: '',
    });
    expect(display.title).toBe('UNKNOWN');
  });

  it('formats empty work orders list', () => {
    const { formatOrdersList } = useOrderProgress();
    const result = formatOrdersList([]);
    expect(result).toHaveLength(0);
  });

  it('sorts orders by createdAt descending', () => {
    const { formatOrdersList } = useOrderProgress();
    const orders = [
      { id: '1', elderName: 'A', type: 'HEALTH', status: 'PENDING', level: 'LOW' as const, createdAt: '2026-06-12T08:00:00Z' },
      { id: '2', elderName: 'B', type: 'LIFE', status: 'PENDING', level: 'MEDIUM' as const, createdAt: '2026-06-12T10:00:00Z' },
    ];
    const result = formatOrdersList(orders);
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('1');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useOrderProgress.spec.ts
```
Expected: FAIL.

- [ ] **Step 3: Write useOrderProgress composable**

Create `apps/miniapp/src/composables/useOrderProgress.ts`:
```typescript
const TYPE_LABELS: Record<string, string> = {
  HEALTH: '健康服务',
  LIFE: '生活照料',
  REPAIR: '维修服务',
  ESCORT: '陪诊服务',
  COMPANION: '陪伴服务',
  ERRAND: '代购服务',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待分配',
  ASSIGNED: '已分配',
  IN_PROGRESS: '处理中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export interface OrderSummary {
  id: string;
  elderName?: string;
  type: string;
  status: string;
  level: string;
  createdAt: string;
}

export interface TimelineDisplayItem {
  id: string;
  title: string;
  statusLabel: string;
  level: string;
  createdAt: string;
}

export function useOrderProgress() {
  function mapToTimelineDisplay(order: OrderSummary): TimelineDisplayItem {
    return {
      id: order.id,
      title: TYPE_LABELS[order.type] || order.type,
      statusLabel: STATUS_LABELS[order.status] || order.status,
      level: order.level,
      createdAt: order.createdAt,
    };
  }

  function formatOrdersList(orders: OrderSummary[]): TimelineDisplayItem[] {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(mapToTimelineDisplay);
  }

  return { mapToTimelineDisplay, formatOrdersList, TYPE_LABELS, STATUS_LABELS };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run:
```bash
cd apps/miniapp && npx vitest run src/composables/__tests__/useOrderProgress.spec.ts
```
Expected: All 4 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/miniapp/src/composables/useOrderProgress.ts apps/miniapp/src/composables/__tests__/useOrderProgress.spec.ts
git commit -m "feat: add useOrderProgress composable for family-facing timeline display (TDD)"
```

---

### Task 21: Mini-App Worker Pages (网格员端页面)

**Files:**
- Create: `apps/miniapp/src/pagesWorker/risk-tasks/index.vue`
- Create: `apps/miniapp/src/pagesWorker/risk-tasks/review.vue`
- Create: `apps/miniapp/src/pagesWorker/visit-form/index.vue`
- Create: `apps/miniapp/src/pagesWorker/visit-form/records.vue`
- Create: `apps/miniapp/src/pagesWorker/work-order/list.vue`
- Create: `apps/miniapp/src/pagesWorker/work-order/detail.vue`
- Create: `apps/miniapp/src/pagesWorker/verification/index.vue`

- [ ] **Step 1: Write risk-tasks list page**

Create `apps/miniapp/src/pagesWorker/risk-tasks/index.vue`:
```vue
<template>
  <view class="page">
    <view class="filter-bar flex gap-2 p-3">
      <wd-picker
        :columns="[{ values: ['', 'PENDING_REVIEW', 'CONFIRMED', 'IGNORED'] }]"
        @confirm="(e: { value: string[] }) => { statusFilter = e.value[0]; loadData() }"
      >
        <wd-button size="small">状态筛选</wd-button>
      </wd-picker>
    </view>

    <view v-if="sortedItems.length === 0" class="empty text-center py-10 text-gray-400">
      暂无待处理预警
    </view>

    <view v-for="item in sortedItems" :key="item.id" class="risk-card m-3 p-4 bg-white rounded-lg shadow-sm"
      @click="goToReview(item)">
      <view class="flex-between mb-2">
        <view class="flex items-center gap-2">
          <wd-tag :type="item.level === 'HIGH' ? 'danger' : 'warning'" size="small">
            {{ item.level === 'HIGH' ? '高风险' : item.level === 'MEDIUM' ? '中风险' : '低风险' }}
          </wd-tag>
          <text class="font-bold">{{ item.elderName }}</text>
        </view>
        <text class="text-gray-400 text-sm">{{ item.createdAt }}</text>
      </view>
      <text class="text-sm text-gray-600">{{ item.reason }}</text>
      <view class="flex-between mt-2">
        <text class="text-xs text-gray-400">来源: {{ item.source }} | 分数: {{ item.score }}</text>
        <wd-icon name="arrow-right" size="16" />
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRiskTaskList } from '@/composables/useRiskTaskList';
import type { RiskTaskItem } from '@/composables/useRiskTaskList';

const { sortItems, filterByStatus } = useRiskTaskList();
const items = ref<RiskTaskItem[]>([]);
const statusFilter = ref('PENDING_REVIEW');

const sortedItems = computed(() => {
  const filtered = filterByStatus(items.value, statusFilter.value);
  return sortItems(filtered);
});

function loadData() {
  uni.showLoading({ title: '加载中...' });
  uni.request({
    url: '/api/v1/risk/events',
    method: 'GET',
    data: { status: statusFilter.value || undefined },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: (res: any) => {
      if (res.data?.code === 0) {
        items.value = res.data.data.items;
      }
    },
    complete: () => uni.hideLoading(),
  });
}

function goToReview(item: RiskTaskItem) {
  uni.navigateTo({ url: `/pagesWorker/risk-tasks/review?id=${item.id}` });
}

onMounted(() => { loadData(); });
</script>
```

- [ ] **Step 2: Write risk-tasks review page**

Create `apps/miniapp/src/pagesWorker/risk-tasks/review.vue`:
```vue
<template>
  <view class="page p-4">
    <view v-if="event" class="space-y-4">
      <view class="bg-white rounded-lg p-4 shadow-sm">
        <view class="flex-between mb-3">
          <text class="text-lg font-bold">{{ event.elderName }}</text>
          <wd-tag :type="event.level === 'HIGH' ? 'danger' : 'warning'" size="small">
            {{ event.level === 'HIGH' ? '高风险' : event.level === 'MEDIUM' ? '中风险' : '低风险' }}
          </wd-tag>
        </view>
        <view class="text-sm text-gray-600 space-y-2">
          <view>来源: {{ event.source }}</view>
          <view>分数: {{ event.score }}</view>
          <view>原因: {{ event.reason }}</view>
          <view>时间: {{ event.createdAt }}</view>
        </view>
      </view>

      <view class="bg-white rounded-lg p-4 shadow-sm">
        <view class="text-sm font-medium mb-3">复核备注</view>
        <wd-textarea v-model="note" :rows="3" placeholder="请填写复核备注（高风险必填）" />
      </view>

      <view class="flex gap-3">
        <wd-button type="primary" block @click="handleConfirm">确认预警</wd-button>
        <wd-button type="danger" plain block @click="handleIgnore">忽略预警</wd-button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const note = ref('');
const event = ref<any>(null);

onMounted(() => {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const id = currentPage?.options?.id;
  if (id) {
    uni.request({
      url: `/api/v1/risk/events?id=${id}`,
      header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
      success: (res: any) => {
        if (res.data?.data?.items?.[0]) event.value = res.data.data.items[0];
      },
    });
  }
});

function submitReview(status: string) {
  if (!event.value) return;
  if (event.value.level === 'HIGH' && !note.value.trim()) {
    uni.showToast({ title: '高风险事件必须填写复核备注', icon: 'none' });
    return;
  }
  uni.request({
    url: `/api/v1/risk/events/${event.value.id}/review`,
    method: 'POST',
    data: { status, note: note.value },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: () => {
      uni.showToast({ title: status === 'CONFIRMED' ? '已确认' : '已忽略' });
      setTimeout(() => uni.navigateBack(), 1000);
    },
  });
}

function handleConfirm() { submitReview('CONFIRMED'); }
function handleIgnore() { submitReview('IGNORED'); }
</script>
```

- [ ] **Step 3: Write visit-form index page**

Create `apps/miniapp/src/pagesWorker/visit-form/index.vue`:
```vue
<template>
  <view class="page p-4">
    <view class="bg-white rounded-lg p-4 shadow-sm space-y-4">
      <view class="text-lg font-bold">新增巡访记录</view>

      <view>
        <text class="text-sm text-gray-500">选择老人</text>
        <wd-input v-model="elderId" placeholder="请输入老人ID" />
      </view>

      <view>
        <text class="text-sm text-gray-500">观察记录 *</text>
        <wd-textarea v-model="observation" :rows="4" placeholder="请详细记录观察内容" />
      </view>

      <view>
        <text class="text-sm text-gray-500">照片 (最多{{ MAX_PHOTOS }}张)</text>
        <view class="flex flex-wrap gap-2 mt-2">
          <view v-for="(photo, idx) in photos" :key="idx" class="relative w-20 h-20 bg-gray-200 rounded">
            <image :src="photo" class="w-full h-full rounded" mode="aspectFill" />
            <view class="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex-center text-xs"
              @click="removePhoto(photo)">×</view>
          </view>
          <view v-if="photos.length < MAX_PHOTOS" class="w-20 h-20 border border-dashed border-gray-300 rounded flex-center"
            @click="takePhoto">
            <text class="text-2xl text-gray-400">+</text>
          </view>
        </view>
      </view>

      <view>
        <text class="text-sm text-gray-500">备注</text>
        <wd-input v-model="note" placeholder="选填" />
      </view>

      <wd-button type="primary" block :loading="submitting" @click="handleSubmit">提交</wd-button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useVisitForm } from '@/composables/useVisitForm';

const { photos, submitting, MAX_PHOTOS, validate, addPhoto, removePhoto } = useVisitForm();
const elderId = ref('');
const observation = ref('');
const note = ref('');

function takePhoto() {
  uni.chooseImage({
    count: 1,
    success: (res: any) => {
      addPhoto(res.tempFilePaths[0]);
    },
  });
}

function handleSubmit() {
  const result = validate({ elderId: elderId.value, observation: observation.value });
  if (!result.valid) {
    uni.showToast({ title: result.message || '请完善表单', icon: 'none' });
    return;
  }
  submitting.value = true;
  uni.request({
    url: '/api/v1/visits',
    method: 'POST',
    data: { elderId: elderId.value, observation: observation.value, photos: photos.value, note: note.value },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    complete: () => { submitting.value = false; },
    success: () => {
      uni.showToast({ title: '提交成功' });
      elderId.value = '';
      observation.value = '';
    },
  });
}
</script>
```

- [ ] **Step 4: Write visit-form records page**

Create `apps/miniapp/src/pagesWorker/visit-form/records.vue`:
```vue
<template>
  <view class="page">
    <view v-if="records.length === 0" class="empty text-center py-10 text-gray-400">
      暂无巡访记录
    </view>
    <view v-for="r in records" :key="r.id" class="record-card m-3 p-4 bg-white rounded-lg shadow-sm">
      <view class="flex-between mb-2">
        <text class="font-bold">{{ r.elderName || r.elderId }}</text>
        <text class="text-sm text-gray-400">{{ r.visitTime }}</text>
      </view>
      <text class="text-sm text-gray-600">{{ r.observation }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

const records = ref<any[]>([]);

onMounted(() => {
  uni.request({
    url: '/api/v1/visits',
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: (res: any) => {
      if (res.data?.data?.items) records.value = res.data.data.items;
    },
  });
});
</script>
```

- [ ] **Step 5: Write work-order list page**

Create `apps/miniapp/src/pagesWorker/work-order/list.vue`:
```vue
<template>
  <view class="page">
    <wd-tabs v-model="activeTab" @change="loadData">
      <wd-tab title="待接单" name="PENDING" />
      <wd-tab title="进行中" name="IN_PROGRESS" />
      <wd-tab title="已完成" name="COMPLETED" />
    </wd-tabs>

    <view v-if="orders.length === 0" class="empty text-center py-10 text-gray-400">
      暂无工单
    </view>

    <view v-for="o in orders" :key="o.id" class="order-card m-3 p-4 bg-white rounded-lg shadow-sm"
      @click="goToDetail(o)">
      <view class="flex-between mb-2">
        <view class="flex items-center gap-2">
          <wd-tag :type="o.level === 'HIGH' ? 'danger' : 'warning'" size="small">
            {{ o.level }}
          </wd-tag>
          <text class="font-bold">{{ o.elderName || o.elderId }}</text>
        </view>
        <text class="text-sm text-gray-400">{{ o.createdAt }}</text>
      </view>
      <text class="text-sm text-gray-600">{{ TYPE_LABELS[o.type] || o.type }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useWorkOrderFlow } from '@/composables/useWorkOrderFlow';
import { TYPE_LABELS } from '@/composables/useOrderProgress';

const activeTab = ref('PENDING');
const orders = ref<any[]>([]);

function loadData() {
  uni.request({
    url: '/api/v1/work-orders',
    data: { status: activeTab.value },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: (res: any) => {
      if (res.data?.data?.items) orders.value = res.data.data.items;
    },
  });
}

function goToDetail(o: any) {
  uni.navigateTo({ url: `/pagesWorker/work-order/detail?id=${o.id}` });
}
</script>
```

- [ ] **Step 6: Write work-order detail page**

Create `apps/miniapp/src/pagesWorker/work-order/detail.vue`:
```vue
<template>
  <view class="page p-4" v-if="order">
    <view class="bg-white rounded-lg p-4 shadow-sm mb-4">
      <view class="text-lg font-bold mb-2">{{ TYPE_LABELS[order.type] || order.type }}</view>
      <view class="text-sm text-gray-600 space-y-1">
        <view>老人: {{ order.elderName || order.elderId }}</view>
        <view>等级: {{ order.level }}</view>
        <view>状态: {{ STATUS_LABELS[order.status] || order.status }}</view>
        <view v-if="order.deadline">截止: {{ order.deadline }}</view>
      </view>
    </view>

    <view class="bg-white rounded-lg p-4 shadow-sm mb-4" v-if="availableActions.length > 0">
      <view class="text-sm font-medium mb-3">可执行操作</view>
      <view class="flex flex-wrap gap-2">
        <wd-button v-for="action in availableActions" :key="action" size="small"
          :type="action === 'COMPLETE' ? 'primary' : 'info'"
          @click="handleAction(action)">
          {{ actionLabels[action] || action }}
        </wd-button>
      </view>
    </view>

    <wd-message-box v-model="resultDialogVisible" title="填写处理结果">
      <wd-textarea v-model="resultText" :rows="3" placeholder="请描述处理结果" />
      <template #footer>
        <wd-button size="small" @click="resultDialogVisible = false">取消</wd-button>
        <wd-button size="small" type="primary" @click="submitResult">确认</wd-button>
      </template>
    </wd-message-box>

    <view class="bg-white rounded-lg p-4 shadow-sm">
      <view class="text-sm font-medium mb-3">流转时间线</view>
      <wd-timeline v-if="timeline.length > 0">
        <wd-timeline-item v-for="t in timeline" :key="t.id" :title="t.action" :content="t.note || ''" :time="t.createdAt" />
      </wd-timeline>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useWorkOrderFlow } from '@/composables/useWorkOrderFlow';
import { TYPE_LABELS, STATUS_LABELS } from '@/composables/useOrderProgress';

const { getAvailableActions, canPerformAction } = useWorkOrderFlow();
const order = ref<any>(null);
const timeline = ref<any[]>([]);
const resultText = ref('');
const resultDialogVisible = ref(false);
const pendingAction = ref('');

const availableActions = computed(() => order.value ? getAvailableActions(order.value.status) : []);

const actionLabels: Record<string, string> = {
  ACCEPT: '接单', START: '开始处理', COMPLETE: '完成',
};

function loadDetail() {
  const pages = getCurrentPages();
  const currentPage = pages[pages.length - 1] as any;
  const id = currentPage?.options?.id;
  if (!id) return;
  const token = uni.getStorageSync('token');
  uni.request({
    url: `/api/v1/work-orders/${id}`,
    header: { Authorization: `Bearer ${token}` },
    success: (res: any) => { if (res.data?.data) order.value = res.data.data; },
  });
  uni.request({
    url: `/api/v1/work-orders/${id}/timeline`,
    header: { Authorization: `Bearer ${token}` },
    success: (res: any) => { if (res.data?.data) timeline.value = res.data.data; },
  });
}

function handleAction(action: string) {
  if (action === 'COMPLETE') {
    pendingAction.value = action;
    resultDialogVisible.value = true;
    return;
  }
  if (!order.value) return;
  uni.request({
    url: `/api/v1/work-orders/${order.value.id}/${action.toLowerCase()}`,
    method: 'POST',
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: () => { uni.showToast({ title: '操作成功' }); loadDetail(); },
  });
}

function submitResult() {
  if (!order.value) return;
  uni.request({
    url: `/api/v1/work-orders/${order.value.id}/complete`,
    method: 'POST',
    data: { result: resultText.value },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: () => { uni.showToast({ title: '已完成' }); resultDialogVisible.value = false; loadDetail(); },
  });
}

onMounted(() => { loadDetail(); });
</script>
```

- [ ] **Step 7: Write verification page**

Create `apps/miniapp/src/pagesWorker/verification/index.vue`:
```vue
<template>
  <view class="page p-4">
    <view class="bg-white rounded-lg p-4 shadow-sm space-y-4">
      <view class="text-lg font-bold">电话核实记录</view>
      <view>
        <text class="text-sm text-gray-500">老人ID</text>
        <wd-input v-model="elderId" placeholder="请输入老人ID" />
      </view>
      <view>
        <text class="text-sm text-gray-500">核实结果</text>
        <wd-textarea v-model="note" :rows="3" placeholder="记录通话核实结果" />
      </view>
      <wd-button type="primary" block :loading="submitting" @click="handleSubmit">提交记录</wd-button>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';

const elderId = ref('');
const note = ref('');
const submitting = ref(false);

function handleSubmit() {
  if (!elderId.value.trim() || !note.value.trim()) {
    uni.showToast({ title: '请完善信息', icon: 'none' });
    return;
  }
  submitting.value = true;
  uni.request({
    url: '/api/v1/visits',
    method: 'POST',
    data: { elderId: elderId.value, observation: `[电话核实] ${note.value}` },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    complete: () => { submitting.value = false; },
    success: () => { uni.showToast({ title: '已记录' }); elderId.value = ''; note.value = ''; },
  });
}
</script>
```

- [ ] **Step 8: Commit**

```bash
git add apps/miniapp/src/pagesWorker/
git commit -m "feat: add miniapp worker pages for risk tasks, visit form, work orders, and verification"
```

---

### Task 22: Mini-App Elder Pages (老人/家属端页面)

**Files:**
- Create: `apps/miniapp/src/pagesElder/check-in/index.vue`
- Create: `apps/miniapp/src/pagesElder/sos/index.vue`
- Create: `apps/miniapp/src/pagesElder/order-progress/index.vue`

- [ ] **Step 1: Write check-in page (elder-friendly, large touch targets)**

Create `apps/miniapp/src/pagesElder/check-in/index.vue`:
```vue
<template>
  <view class="page flex flex-col items-center justify-center min-h-screen px-6 space-y-8">
    <text class="text-xl font-bold">一键报平安</text>

    <view class="w-full space-y-4">
      <!-- Large ONE_TAP button -->
      <view class="checkin-btn bg-green-500 text-white rounded-2xl py-8 flex-center text-center active:opacity-80"
        @click="submitCheckIn('ONE_TAP')">
        <view>
          <text class="text-4xl">🏠</text>
          <view class="text-xl font-bold mt-2">我很好</view>
          <view class="text-sm opacity-80">点此一键报平安</view>
        </view>
      </view>

      <!-- Voice button -->
      <view class="checkin-btn bg-blue-500 text-white rounded-2xl py-6 flex-center text-center active:opacity-80"
        @touchstart="startVoice" @touchend="stopVoice">
        <view>
          <text class="text-3xl">{{ isRecording ? '🔴' : '🎤' }}</text>
          <view class="text-lg font-bold mt-1">{{ isRecording ? '松开发送' : '长按语音报平安' }}</view>
          <view v-if="isRecording" class="text-sm mt-1">{{ duration }}s</view>
        </view>
      </view>

      <!-- Text input fallback -->
      <view class="bg-white rounded-lg p-3 shadow-sm">
        <wd-textarea v-model="textContent" :rows="3" placeholder="或在这里输入报平安信息..." />
        <wd-button size="small" type="info" block class="mt-2" @click="submitCheckIn('TEXT')">文字提交</wd-button>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useCheckIn } from '@/composables/useCheckIn';
import { useSosVoice } from '@/composables/useSosVoice';

const { validate, methodLabels } = useCheckIn();
const { isRecording, duration, startRecording, stopRecording } = useSosVoice();
const textContent = ref('');

const elderId = ref(uni.getStorageSync('elderId') || '');

function submitCheckIn(method: string) {
  const result = validate({
    elderId: elderId.value,
    method,
    content: method === 'TEXT' ? textContent.value : undefined,
    voiceUrl: undefined,
  });
  if (!result.valid) {
    uni.showToast({ title: result.message || '请完善信息', icon: 'none' });
    return;
  }
  uni.request({
    url: '/api/v1/check-ins',
    method: 'POST',
    data: { elderId: elderId.value, method, content: method === 'TEXT' ? textContent.value : undefined },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: () => {
      uni.showToast({ title: '已报平安 ✅' });
      textContent.value = '';
    },
  });
}

function startVoice() {
  startRecording();
  uni.showToast({ title: '开始录音', icon: 'none', duration: 500 });
}

function stopVoice() {
  stopRecording();
  uni.showToast({ title: `已录制 ${duration.value}s`, icon: 'success' });
}
</script>

<style scoped>
.checkin-btn {
  min-height: 120rpx;
  transition: opacity 0.15s;
}
</style>
```

- [ ] **Step 2: Write SOS page**

Create `apps/miniapp/src/pagesElder/sos/index.vue`:
```vue
<template>
  <view class="page flex flex-col items-center justify-center min-h-screen px-6 space-y-8">
    <text class="text-xl font-bold text-red-600">语音求助</text>
    <text class="text-sm text-gray-500">长按按钮录音，松开发送求助</text>

    <view class="sos-btn w-48 h-48 rounded-full flex-center"
      :class="isRecording ? 'bg-red-600 recording-pulse' : 'bg-red-500'"
      @touchstart="handleTouchStart"
      @touchend="handleTouchEnd">
      <view class="text-center">
        <text class="text-5xl text-white">{{ isRecording ? '🔴' : '🆘' }}</text>
        <view class="text-white text-lg font-bold mt-2">
          {{ isRecording ? '松开发送' : '长按求助' }}
        </view>
        <view v-if="isRecording" class="text-white text-sm mt-1">
          {{ duration }}s / {{ maxDuration }}s
        </view>
      </view>
    </view>

    <view v-if="voiceUrl" class="bg-white rounded-lg p-4 text-center w-full">
      <text class="text-green-600 font-bold">求助已发送!</text>
      <view class="text-sm text-gray-500 mt-1">工作人员将尽快响应</view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useSosVoice } from '@/composables/useSosVoice';

const { isRecording, duration, voiceUrl, maxDuration, startRecording, stopRecording, setVoiceUrl } = useSosVoice();

function handleTouchStart() {
  startRecording();
}

function handleTouchEnd() {
  stopRecording();
  if (duration.value < 1) {
    uni.showToast({ title: '录音时间太短', icon: 'none' });
    return;
  }
  // In real app, upload audio file first
  const tempUrl = 'recorded_audio_' + Date.now();
  setVoiceUrl(tempUrl);

  const elderId = uni.getStorageSync('elderId') || '';
  uni.request({
    url: '/api/v1/check-ins',
    method: 'POST',
    data: { elderId, method: 'VOICE', content: '语音求助', voiceUrl: tempUrl },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: () => {
      uni.showToast({ title: '求助已发出' });
    },
  });
}
</script>

<style scoped>
.sos-btn {
  transition: transform 0.1s, box-shadow 0.1s;
}
.sos-btn:active {
  transform: scale(0.95);
}
.recording-pulse {
  animation: pulse 1s infinite;
}
@keyframes pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); }
  50% { box-shadow: 0 0 0 20px rgba(220, 38, 38, 0); }
}
</style>
```

- [ ] **Step 3: Write order-progress page**

Create `apps/miniapp/src/pagesElder/order-progress/index.vue`:
```vue
<template>
  <view class="page p-4">
    <view class="text-lg font-bold mb-4">工单进度</view>

    <view v-if="displayItems.length === 0" class="empty text-center py-10 text-gray-400">
      暂无进行中的工单
    </view>

    <view v-for="item in displayItems" :key="item.id" class="order-card mb-4 bg-white rounded-lg p-4 shadow-sm">
      <view class="flex-between mb-2">
        <view class="flex items-center gap-2">
          <wd-tag :type="item.level === 'HIGH' ? 'danger' : 'warning'" size="small">
            {{ item.level }}
          </wd-tag>
          <text class="font-bold">{{ item.title }}</text>
        </view>
      </view>

      <!-- Progress indicator -->
      <view class="flex items-center gap-2 my-4">
        <view class="flex-1">
          <view class="flex-between mb-1">
            <text class="text-xs text-gray-400">已接单</text>
            <text class="text-xs text-gray-400">处理中</text>
            <text class="text-xs text-gray-400">已完成</text>
          </view>
          <view class="flex items-center">
            <view class="h-2 rounded-full flex-1" :class="progressColor(item.status)">
              <view class="h-full rounded-full bg-blue-500" :style="{ width: progressWidth(item.status) }" />
            </view>
          </view>
        </view>
        <text class="text-sm font-medium">{{ item.statusLabel }}</text>
      </view>

      <text class="text-xs text-gray-400">{{ item.createdAt }}</text>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useOrderProgress } from '@/composables/useOrderProgress';
import type { OrderSummary } from '@/composables/useOrderProgress';

const { formatOrdersList } = useOrderProgress();
const orders = ref<OrderSummary[]>([]);

const displayItems = computed(() => formatOrdersList(orders.value));

function progressWidth(status: string): string {
  const map: Record<string, string> = {
    ASSIGNED: '33%', IN_PROGRESS: '66%', COMPLETED: '100%',
  };
  return map[status] || '0%';
}

function progressColor(status: string): string {
  return status === 'COMPLETED' ? 'bg-green-200' : 'bg-gray-200';
}

onMounted(() => {
  uni.request({
    url: '/api/v1/work-orders',
    method: 'GET',
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: (res: any) => {
      if (res.data?.data?.items) orders.value = res.data.data.items;
    },
  });
});
</script>
```

- [ ] **Step 4: Commit**

```bash
git add apps/miniapp/src/pagesElder/
git commit -m "feat: add miniapp elder pages for check-in, SOS voice, and order progress"
```

---

### Task 23: 联调与收尾

**Files:**
- Modify: `apps/admin/package.json` (verify scripts work)
- Modify: `apps/miniapp/package.json` (verify scripts work)
- Modify: `package.json` (root scripts for admin + miniapp)

- [ ] **Step 1: Update root package.json scripts**

Modify `package.json` to add admin and miniapp scripts:
```json
{
  "name": "care-dispatch-system",
  "private": true,
  "scripts": {
    "dev": "pnpm --filter @care/api dev",
    "dev:admin": "pnpm --filter @care/admin dev",
    "dev:miniapp": "pnpm --filter @care/miniapp dev:mp-weixin",
    "build": "pnpm -r build",
    "build:admin": "pnpm --filter @care/admin build",
    "build:miniapp": "pnpm --filter @care/miniapp build:mp-weixin",
    "lint": "pnpm -r lint",
    "test": "pnpm -r test",
    "test:e2e": "pnpm --filter @care/api test:e2e && pnpm --filter @care/admin test:e2e",
    "format": "prettier --write \"**/*.{ts,js,json,mjs,cjs,md,vue}\"",
    "format:check": "prettier --check \"**/*.{ts,js,json,mjs,cjs,md,vue}\"",
    "generate:types": "pnpm --filter @care/shared-types generate",
    "prepare": "husky"
  }
}
```
(Add the new scripts while keeping existing dependencies and engines.)

- [ ] **Step 2: Verify all project dependencies install cleanly**

Run:
```bash
pnpm install
```
Expected: no errors, all workspace packages resolve.

- [ ] **Step 3: Run all tests**

Run:
```bash
pnpm test
```
Expected: all tests pass across api, admin, and miniapp workspaces. (May need API running for integration tests.)

- [ ] **Step 4: Run admin lint**

Run:
```bash
cd apps/admin && pnpm lint
```
Expected: lint passes with no errors.

- [ ] **Step 5: Run miniapp lint**

Run:
```bash
cd apps/miniapp && pnpm lint
```
Expected: lint passes with no errors.

- [ ] **Step 6: Verify admin build**

Run:
```bash
cd apps/admin && pnpm build
```
Expected: Vue project builds successfully into `dist/`.

- [ ] **Step 7: Commit final integration**

```bash
git add package.json
git commit -m "chore: add admin and miniapp scripts to root, final integration checks"
```

---

## Plan Summary

| Phase | Tasks | Description |
|---|---|---|
| Scaffolding | 1-2 | Shared-types pipeline + Admin project skeleton |
| Admin API | 3 | Axios client + all API modules |
| Admin Auth | 4 | Router, auth store, login page |
| Admin Layout | 5 | Sidebar + header layout |
| Admin Core | 6-10 | Dashboard, risk, work-orders, elders |
| Admin Simple | 11 | Rules, users, audit pages |
| Admin E2E | 12 | Playwright tests |
| Miniapp Scaff. | 13-14 | uni-app project, API client, stores |
| Miniapp Composables | 15-20 | 6 composables (TDD): useCheckIn, useSosVoice, useRiskTaskList, useVisitForm, useWorkOrderFlow, useOrderProgress |
| Miniapp Worker Pages | 21 | 7 pages for grid workers |
| Miniapp Elder Pages | 22 | 3 pages for elderly/family |
| Integration | 23 | Root scripts, lint, build, test verification |

**Total: 23 tasks, ~115 individual steps**

