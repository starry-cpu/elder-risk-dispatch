# 小程序工作人员端视觉重设计 实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `apps/miniapp/src/pagesWorker/` 下 7 个页面从 wot-design-uni 默认风格全面改造为「克制的人文工具」视觉体系，同步修复 API 调用一致性和缺失的状态处理。

**Architecture:** 三层递进——底座层（设计令牌 + 全局样式）→ 骨架层（6 个自建组件）→ 血肉层（7 页面逐页改造 + 首页路由修复）。组件纯渲染，业务逻辑留在 composable 内不动。保留 wot-design-uni 复杂交互组件（tabs/picker/timeline/message-box），通过样式覆盖对齐视觉体系。

**Tech Stack:** uni-app (Vue 3 + `<script setup lang="ts">`), wot-design-uni ^1.14.0, Pinia ^2.3.0, SCSS, luch-request

---

## File Structure

```
apps/miniapp/src/
├── styles/                          # 🆕 全局样式系统
│   ├── tokens.scss                  # 设计令牌 (SCSS 变量)
│   └── reset.scss                   # wot-design-uni 组件样式覆盖
├── components/                      # 🆕 自建组件
│   ├── AppStatusDot.vue             # 状态指示圆点
│   ├── AppTag.vue                   # 等级标签
│   ├── AppButton.vue                # 按钮 (primary/secondary/text/danger)
│   ├── AppCard.vue                  # 卡片容器 + 左侧色条
│   ├── AppEmpty.vue                 # 空状态
│   └── AppNavbar.vue                # 自定义导航栏
├── uni.scss                         # 🔧 重写，导入 tokens
├── pages.json                       # 🔧 更新 globalStyle
├── pages/
│   └── index/
│       └── index.vue                # 🔧 添加角色路由分发
├── pagesWorker/
│   ├── risk-tasks/
│   │   ├── index.vue                # 🔧 重写
│   │   └── review.vue               # 🔧 重写
│   ├── visit-form/
│   │   ├── index.vue                # 🔧 重写
│   │   └── records.vue              # 🔧 重写
│   ├── work-order/
│   │   ├── list.vue                 # 🔧 重写
│   │   └── detail.vue               # 🔧 重写
│   └── verification/
│       └── index.vue                # 🔧 重写
├── composables/                     # ⛔ 不动 (纯逻辑，无需改)
├── stores/                          # ⛔ 不动
└── api/                             # ⛔ 不动
```

---

### Task 1: 设计令牌 `styles/tokens.scss`

**Files:**
- Create: `apps/miniapp/src/styles/tokens.scss`

- [ ] **Step 1: 创建设计令牌文件**

```scss
// 色彩体系
$color-canvas: #F7F3ED;
$color-surface: #FEFDFB;
$color-surface-warm: #FDFAF5;

$color-text: #2C2B29;
$color-text-secondary: #6B6760;
$color-text-tertiary: #9E9990;
$color-text-inverse: #FEFDFB;

$color-brand: #7A8B6E;
$color-brand-light: #E9EDE4;
$color-brand-strong: #5A6B52;

$color-accent: #C4856B;
$color-accent-light: #F5EBE4;
$color-accent-strong: #A86B53;

$color-success: #7A9A6E;
$color-warning: #C49B5E;
$color-error: #C4706B;
$color-info: #6E8A9A;

$color-border: #E8E3DA;
$color-border-light: #F0ECE5;

// 排版层级 (4 级)
$text-detail: 22rpx;
$text-body: 28rpx;
$text-title: 32rpx;
$text-hero: 40rpx;

$font-weight-normal: 400;
$font-weight-medium: 500;
$font-weight-bold: 600;

$line-height-tight: 1.3;
$line-height-normal: 1.6;
$line-height-relaxed: 1.8;

// 间距 (4 级)
$space-tight: 12rpx;
$space-base: 20rpx;
$space-wide: 32rpx;
$space-section: 48rpx;

// 圆角 (3 级)
$radius-tag: 6rpx;
$radius-card: 12rpx;
$radius-pill: 9999rpx;

// 阴影
$shadow-card: 0 1rpx 0 $color-border;
$shadow-raised: 0 2rpx 12rpx rgba(44, 43, 41, 0.04);
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/styles/tokens.scss
git commit -m "feat: add design tokens for worker-side redesign"
```

---

### Task 2: 重写 `uni.scss` 并创建 `reset.scss`

**Files:**
- Modify: `apps/miniapp/src/uni.scss`
- Create: `apps/miniapp/src/styles/reset.scss`

- [ ] **Step 1: 重写 `uni.scss`**

```scss
@import './styles/tokens.scss';

// 页面全局背景
page {
  background-color: $color-canvas;
  color: $color-text;
  font-family: system-ui, "PingFang SC", "Microsoft YaHei", sans-serif;
  font-size: $text-body;
  line-height: $line-height-normal;
}
```

- [ ] **Step 2: 创建 `reset.scss` — wot-design-uni 组件样式覆盖**

```scss
@import './tokens.scss';

// ========== wd-tabs 覆盖 ==========
.wd-tabs {
  background: $color-surface !important;
}
.wd-tabs__line {
  background-color: $color-brand !important;
  height: 4rpx !important;
}
.wd-tab {
  font-size: $text-body !important;
  color: $color-text-secondary !important;
}
.wd-tab--active {
  color: $color-text !important;
  font-weight: $font-weight-medium !important;
}

// ========== wd-timeline 覆盖 ==========
.wd-timeline-item__content {
  font-size: $text-body !important;
}
.wd-timeline-item__time {
  font-size: $text-detail !important;
  color: $color-text-tertiary !important;
}

// ========== wd-textarea 覆盖 ==========
.wd-textarea {
  background: transparent !important;
  font-size: $text-body !important;
}
.wd-textarea__textarea {
  color: $color-text !important;
  caret-color: $color-brand !important;
}
.wd-textarea__placeholder {
  color: $color-text-tertiary !important;
}

// ========== wd-input 覆盖 ==========
.wd-input {
  background: transparent !important;
}
.wd-input__inner {
  font-size: $text-body !important;
  color: $color-text !important;
  caret-color: $color-brand !important;
}
.wd-input__placeholder {
  color: $color-text-tertiary !important;
}

// ========== wd-picker 容器覆盖 ==========
.wd-picker__toolbar {
  background: $color-surface !important;
}

// ========== wd-message-box 覆盖 ==========
.wd-message-box__body {
  font-size: $text-body !important;
  color: $color-text !important;
}

// ========== 全局按钮基础重置 ==========
.wd-button--primary {
  background-color: $color-brand !important;
  border-color: $color-brand !important;
}

// ========== 移除默认圆角阴影 ==========
.wd-cell,
.wd-cell-group {
  background: transparent !important;
}
```

- [ ] **Step 3: 提交**

```bash
git add apps/miniapp/src/uni.scss apps/miniapp/src/styles/reset.scss
git commit -m "feat: add global styles and wot-design-uni overrides"
```

---

### Task 3: `pages.json` globalStyle 更新

**Files:**
- Modify: `apps/miniapp/src/pages.json:25-31`

- [ ] **Step 1: 更新 globalStyle**

将 `apps/miniapp/src/pages.json` 的 `globalStyle` 块替换为：

```json
"globalStyle": {
  "navigationBarTextStyle": "black",
  "navigationBarTitleText": "照护调度",
  "navigationBarBackgroundColor": "#F7F3ED",
  "backgroundColor": "#F7F3ED",
  "navigationStyle": "custom"
}
```

`navigationStyle: "custom"` 启用自定义导航栏（配合 AppNavbar 组件使用）。

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/pages.json
git commit -m "feat: update globalStyle to warm linen background with custom navbar"
```

---

### Task 4: AppStatusDot 组件

**Files:**
- Create: `apps/miniapp/src/components/AppStatusDot.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <view
    class="app-status-dot"
    :class="[statusClass, { 'app-status-dot--hollow': !filled }]"
    :style="{ width: size + 'rpx', height: size + 'rpx' }"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  status: string;
  filled?: boolean;
  size?: number;
}>(), {
  filled: true,
  size: 12,
});

const STATUS_COLORS: Record<string, string> = {
  high: 'app-status-dot--high',
  medium: 'app-status-dot--medium',
  low: 'app-status-dot--low',
  success: 'app-status-dot--success',
  info: 'app-status-dot--info',
  warning: 'app-status-dot--warning',
};

const statusClass = computed(() => STATUS_COLORS[props.status] || STATUS_COLORS.info);
</script>

<style scoped>
.app-status-dot {
  border-radius: 9999rpx;
  flex-shrink: 0;
  display: inline-block;
}
.app-status-dot--high { background-color: #C4856B; }
.app-status-dot--medium { background-color: #C49B5E; }
.app-status-dot--low { background-color: #6E8A9A; }
.app-status-dot--success { background-color: #7A9A6E; }
.app-status-dot--info { background-color: #6E8A9A; }
.app-status-dot--warning { background-color: #C49B5E; }

.app-status-dot--hollow {
  background-color: transparent;
  border: 2rpx solid currentColor;
}
.app-status-dot--hollow.app-status-dot--high { border-color: #C4856B; color: #C4856B; }
.app-status-dot--hollow.app-status-dot--medium { border-color: #C49B5E; color: #C49B5E; }
.app-status-dot--hollow.app-status-dot--low { border-color: #6E8A9A; color: #6E8A9A; }
.app-status-dot--hollow.app-status-dot--success { border-color: #7A9A6E; color: #7A9A6E; }
.app-status-dot--hollow.app-status-dot--info { border-color: #6E8A9A; color: #6E8A9A; }
.app-status-dot--hollow.app-status-dot--warning { border-color: #C49B5E; color: #C49B5E; }
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/components/AppStatusDot.vue
git commit -m "feat: add AppStatusDot component"
```

---

### Task 5: AppTag 组件

**Files:**
- Create: `apps/miniapp/src/components/AppTag.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <text class="app-tag" :class="tagClass">{{ label }}</text>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  level: 'high' | 'medium' | 'low';
  label?: string;
}>();

const LEVEL_MAP: Record<string, { cls: string; defaultLabel: string }> = {
  high: { cls: 'app-tag--high', defaultLabel: 'HIGH' },
  medium: { cls: 'app-tag--medium', defaultLabel: 'MEDIUM' },
  low: { cls: 'app-tag--low', defaultLabel: 'LOW' },
};

const tagClass = computed(() => LEVEL_MAP[props.level]?.cls || 'app-tag--low');
const label = computed(() => props.label || LEVEL_MAP[props.level]?.defaultLabel || '');
</script>

<style scoped>
.app-tag {
  display: inline-block;
  font-size: 20rpx;
  font-weight: 500;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  letter-spacing: 1rpx;
  line-height: 1.4;
}
.app-tag--high {
  background-color: #F5EBE4;
  color: #A86B53;
}
.app-tag--medium {
  background-color: #F7F0E5;
  color: #A87B4E;
}
.app-tag--low {
  background-color: #ECF0F3;
  color: #5A707A;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/components/AppTag.vue
git commit -m "feat: add AppTag component"
```

---

### Task 6: AppButton 组件

**Files:**
- Create: `apps/miniapp/src/components/AppButton.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <view
    class="app-button"
    :class="[typeClass, sizeClass, { 'app-button--disabled': disabled, 'app-button--loading': loading }]"
    @click="handleClick"
  >
    <text v-if="loading" class="app-button__loading-icon">⟳</text>
    <slot />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  type?: 'primary' | 'secondary' | 'text' | 'danger';
  size?: 'full' | 'auto' | 'compact';
  disabled?: boolean;
  loading?: boolean;
}>(), {
  type: 'primary',
  size: 'auto',
  disabled: false,
  loading: false,
});

const emit = defineEmits<{
  click: [];
}>();

const typeClass = computed(() => `app-button--${props.type}`);
const sizeClass = computed(() => `app-button--${props.size}`);

function handleClick() {
  if (props.disabled || props.loading) return;
  emit('click');
}
</script>

<style scoped>
.app-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border-radius: 12rpx;
  font-weight: 500;
  font-size: 28rpx;
  transition: filter 0.15s;
  cursor: pointer;
}

/* Sizes */
.app-button--full {
  width: 100%;
  height: 88rpx;
  font-size: 32rpx;
}
.app-button--auto {
  padding: 20rpx 28rpx;
  height: 64rpx;
}
.app-button--compact {
  padding: 14rpx 20rpx;
  height: 48rpx;
  font-size: 24rpx;
}

/* Types */
.app-button--primary {
  background-color: #7A8B6E;
  color: #FEFDFB;
}
.app-button--secondary {
  background-color: transparent;
  color: #2C2B29;
  border: 1.5rpx solid #E8E3DA;
}
.app-button--text {
  background-color: transparent;
  color: #6B6760;
}
.app-button--danger {
  background-color: #C4856B;
  color: #FEFDFB;
}

/* States */
.app-button:active:not(.app-button--disabled):not(.app-button--loading) {
  filter: brightness(0.92);
}
.app-button--disabled {
  opacity: 0.45;
}
.app-button--loading {
  opacity: 0.7;
}

.app-button__loading-icon {
  font-size: 28rpx;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/components/AppButton.vue
git commit -m "feat: add AppButton component"
```

---

### Task 7: AppCard 组件

**Files:**
- Create: `apps/miniapp/src/components/AppCard.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <view
    class="app-card"
    :class="{ 'app-card--clickable': clickable }"
    @click="handleClick"
  >
    <view
      v-if="accentColor"
      class="app-card__accent"
      :style="{ backgroundColor: accentColor }"
    />
    <view class="app-card__body">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
withDefaults(defineProps<{
  accentColor?: string;
  clickable?: boolean;
}>(), {
  clickable: false,
});

const emit = defineEmits<{
  click: [];
}>();

function handleClick() {
  emit('click');
}
</script>

<style scoped>
.app-card {
  display: flex;
  flex-direction: row;
  background-color: #FEFDFB;
  border-radius: 12rpx;
  margin: 0 20rpx 20rpx 20rpx;
  box-shadow: 0 1rpx 0 #E8E3DA;
  overflow: hidden;
  position: relative;
}
.app-card--clickable:active {
  filter: brightness(0.97);
}
.app-card__accent {
  width: 4rpx;
  flex-shrink: 0;
  align-self: stretch;
}
.app-card__body {
  flex: 1;
  padding: 20rpx;
  min-width: 0;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/components/AppCard.vue
git commit -m "feat: add AppCard component"
```

---

### Task 8: AppEmpty 组件

**Files:**
- Create: `apps/miniapp/src/components/AppEmpty.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <view class="app-empty">
    <text class="app-empty__message">{{ message }}</text>
    <text v-if="hint" class="app-empty__hint">{{ hint }}</text>
    <AppButton
      v-if="actionLabel"
      type="text"
      size="compact"
      @click="handleAction"
    >
      {{ actionLabel }}
    </AppButton>
  </view>
</template>

<script setup lang="ts">
import AppButton from './AppButton.vue';

withDefaults(defineProps<{
  message: string;
  hint?: string;
  actionLabel?: string;
}>(), {
  hint: '',
  actionLabel: '',
});

const emit = defineEmits<{
  action: [];
}>();

function handleAction() {
  emit('action');
}
</script>

<style scoped>
.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 48rpx;
  gap: 12rpx;
}
.app-empty__message {
  font-size: 32rpx;
  font-weight: 500;
  color: #2C2B29;
}
.app-empty__hint {
  font-size: 28rpx;
  color: #6B6760;
  text-align: center;
  line-height: 1.6;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/components/AppEmpty.vue
git commit -m "feat: add AppEmpty component"
```

---

### Task 9: AppNavbar 组件

**Files:**
- Create: `apps/miniapp/src/components/AppNavbar.vue`

- [ ] **Step 1: 创建组件**

```vue
<template>
  <view class="app-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="app-navbar__inner">
      <view class="app-navbar__left" @click="handleBack">
        <text v-if="showBack" class="app-navbar__back">←</text>
      </view>
      <text class="app-navbar__title">{{ title }}</text>
      <view class="app-navbar__right">
        <slot name="right" />
      </view>
    </view>
    <view class="app-navbar__divider" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

withDefaults(defineProps<{
  title: string;
  showBack?: boolean;
}>(), {
  showBack: true,
});

const statusBarHeight = ref(20);

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 20;
});

function handleBack() {
  uni.navigateBack({ delta: 1 });
}
</script>

<style scoped>
.app-navbar {
  background-color: #F7F3ED;
}
.app-navbar__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  padding: 0 20rpx;
  position: relative;
}
.app-navbar__left {
  position: absolute;
  left: 20rpx;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-right: 16rpx;
}
.app-navbar__back {
  font-size: 36rpx;
  color: #2C2B29;
}
.app-navbar__title {
  font-size: 32rpx;
  font-weight: 500;
  color: #2C2B29;
}
.app-navbar__right {
  position: absolute;
  right: 20rpx;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
}
.app-navbar__divider {
  height: 1rpx;
  background-color: #E8E3DA;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/components/AppNavbar.vue
git commit -m "feat: add AppNavbar component"
```

---

### Task 10: 首页路由分发 `pages/index/index.vue`

**Files:**
- Modify: `apps/miniapp/src/pages/index/index.vue`

- [ ] **Step 1: 重写首页，添加角色路由分发**

```vue
<template>
  <view class="home">
    <view class="home__content">
      <text class="home__title">照护调度</text>
      <text class="home__subtitle">为老人提供更安全的照护服务</text>
      <view class="home__actions">
        <AppButton type="primary" size="full" :loading="loading" @click="enterApp">
          {{ loading ? '加载中...' : '进入工作台' }}
        </AppButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppButton from '@/components/AppButton.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const loading = ref(false);

async function enterApp() {
  loading.value = true;
  try {
    // 确保已获取用户信息
    if (!auth.user) {
      await auth.fetchUser();
    }
    if (auth.isWorker) {
      uni.redirectTo({ url: '/pagesWorker/risk-tasks/index' });
    } else if (auth.isElder) {
      uni.redirectTo({ url: '/pagesElder/check-in/index' });
    } else {
      uni.showToast({ title: '未知角色，请联系管理员', icon: 'none' });
    }
  } catch {
    // 未登录则触发微信登录
    try {
      const { code } = await uniLogin();
      await auth.login(code);
      if (auth.isWorker) {
        uni.redirectTo({ url: '/pagesWorker/risk-tasks/index' });
      } else if (auth.isElder) {
        uni.redirectTo({ url: '/pagesElder/check-in/index' });
      }
    } catch (e: any) {
      uni.showToast({ title: e?.message || '登录失败', icon: 'none' });
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
  // 已登录用户直接跳转
  if (auth.isAuthenticated && auth.user) {
    if (auth.isWorker) {
      uni.redirectTo({ url: '/pagesWorker/risk-tasks/index' });
    } else if (auth.isElder) {
      uni.redirectTo({ url: '/pagesElder/check-in/index' });
    }
  }
});
</script>

<style scoped>
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #F7F3ED;
  padding: 48rpx;
}
.home__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  width: 100%;
  max-width: 500rpx;
}
.home__title {
  font-size: 44rpx;
  font-weight: 600;
  color: #2C2B29;
  letter-spacing: 4rpx;
}
.home__subtitle {
  font-size: 28rpx;
  color: #6B6760;
  margin-bottom: 48rpx;
}
.home__actions {
  width: 100%;
}
</style>
```

> **注意：** 此实现假设 `auth` store 存在 `fetchUser()` 和 `login(code)` 方法。如果当前 store 没有这些方法，需要在 Task 14 中补充（见下方）。

- [ ] **Step 2: 检查 auth store 是否需要补充方法**

检查 `apps/miniapp/src/stores/auth.ts`。如果缺少 `fetchUser` 和 `login` 方法，则添加：

```typescript
// 在 useAuthStore 函数内添加：

async function login(code: string) {
  loading.value = true;
  try {
    const { authApi } = await import('@/api/auth');
    const res = await authApi.wechatLogin(code);
    const data = (res as any)?.data?.data;
    if (data?.token) setToken(data.token);
    if (data?.user) setUser(data.user);
  } finally {
    loading.value = false;
  }
}

async function fetchUser() {
  try {
    const { authApi } = await import('@/api/auth');
    const res = await authApi.getMe();
    const data = (res as any)?.data?.data;
    if (data) setUser(data);
  } catch {
    // silently fail if not authenticated
  }
}

// 在 return 中添加:
return { token, user, loading, isAuthenticated, isWorker, isElder, setToken, setUser, logout, login, fetchUser };
```

- [ ] **Step 3: 提交**

```bash
git add apps/miniapp/src/pages/index/index.vue apps/miniapp/src/stores/auth.ts
git commit -m "feat: add role-based routing on homepage, supplement auth store methods"
```

---

### Task 11: 风险待办列表 `risk-tasks/index.vue`

**Files:**
- Modify: `apps/miniapp/src/pagesWorker/risk-tasks/index.vue`

- [ ] **Step 1: 重写页面（API 一致性 + 状态处理 + 新视觉）**

```vue
<template>
  <view class="page">
    <AppNavbar title="风险待办" />

    <!-- 筛选栏 -->
    <view class="filter-bar" @click="showPicker = true">
      <text class="filter-bar__label">{{ statusLabel }}</text>
      <text class="filter-bar__arrow">▾</text>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <AppEmpty
      v-else-if="sortedItems.length === 0"
      message="暂无待处理风险"
      hint="所有风险事件已处理完毕"
    />

    <!-- 列表 -->
    <view v-else>
      <AppCard
        v-for="item in sortedItems"
        :key="item.id"
        :accent-color="accentColor(item.level)"
        clickable
        @click="goToReview(item)"
      >
        <view class="risk-row">
          <view class="risk-row__main">
            <view class="risk-row__top">
              <AppStatusDot :status="item.level.toLowerCase()" :size="12" />
              <AppTag :level="item.level.toLowerCase() as any" />
              <text class="risk-row__reason">{{ item.reason }}</text>
            </view>
            <text class="risk-row__elder">{{ item.elderName }}</text>
          </view>
          <view class="risk-row__side">
            <text class="risk-row__time">{{ formatTime(item.createdAt) }}</text>
            <AppButton type="secondary" size="compact" @click.stop="goToReview(item)">
              去处理
            </AppButton>
          </view>
        </view>
      </AppCard>

      <view class="page-end">
        <text class="page-end__text">已加载全部</text>
      </view>
    </view>

    <!-- 筛选 Picker -->
    <wd-picker
      :columns="[statusColumns]"
      :model-value="[statusFilter]"
      @confirm="onPickerConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppCard from '@/components/AppCard.vue';
import AppStatusDot from '@/components/AppStatusDot.vue';
import AppTag from '@/components/AppTag.vue';
import AppButton from '@/components/AppButton.vue';
import AppEmpty from '@/components/AppEmpty.vue';
import { riskApi } from '@/api/risk';
import { useRiskTaskList } from '@/composables/useRiskTaskList';
import type { RiskTaskItem } from '@/composables/useRiskTaskList';

const { sortItems, filterByStatus } = useRiskTaskList();

const items = ref<RiskTaskItem[]>([]);
const statusFilter = ref('');
const loading = ref(false);
const showPicker = ref(false);

const statusColumns = [
  { value: '', label: '全部' },
  { value: 'PENDING_REVIEW', label: '待复核' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'IGNORED', label: '已忽略' },
];

const statusLabel = computed(() => {
  const found = statusColumns.find(c => c.value === statusFilter.value);
  return found ? found.label : '全部';
});

const sortedItems = computed(() => {
  const filtered = filterByStatus(items.value, statusFilter.value);
  return sortItems(filtered);
});

function accentColor(level: string): string {
  if (level === 'HIGH') return '#C4856B';
  if (level === 'MEDIUM') return '#C49B5E';
  return '#6E8A9A';
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
}

function onPickerConfirm(e: { value: string[] }) {
  statusFilter.value = e.value[0];
  showPicker.value = false;
  loadData();
}

async function loadData() {
  loading.value = true;
  try {
    const res = await riskApi.listEvents({ status: statusFilter.value || undefined });
    const data = (res as any)?.data?.data;
    if (data?.items) items.value = data.items;
  } catch {
    uni.showToast({ title: '加载失败，下拉重试', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goToReview(item: RiskTaskItem) {
  uni.navigateTo({ url: `/pagesWorker/risk-tasks/review?id=${item.id}` });
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 48rpx;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx 20rpx;
}
.filter-bar__label {
  font-size: 28rpx;
  color: #2C2B29;
  font-weight: 500;
}
.filter-bar__arrow {
  font-size: 22rpx;
  color: #6B6760;
}
.risk-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.risk-row__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}
.risk-row__top {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.risk-row__reason {
  font-size: 28rpx;
  font-weight: 500;
  color: #2C2B29;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.risk-row__elder {
  font-size: 24rpx;
  color: #6B6760;
}
.risk-row__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}
.risk-row__time {
  font-size: 22rpx;
  color: #9E9990;
}
.page-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}
.page-state__text {
  font-size: 28rpx;
  color: #9E9990;
}
.page-end {
  display: flex;
  justify-content: center;
  padding: 24rpx 0;
}
.page-end__text {
  font-size: 22rpx;
  color: #9E9990;
}
</style>
```

> **注意：** `wd-picker` 在 uni-app 中的 `v-model` 和 `@confirm` 传参格式以实际组件文档为准。如果参数不匹配，用 `:model-value` + `@confirm` 模式替代。

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/pagesWorker/risk-tasks/index.vue
git commit -m "feat: redesign risk-tasks list with new components and API client"
```

---

### Task 12: 风险复核 `risk-tasks/review.vue`

**Files:**
- Modify: `apps/miniapp/src/pagesWorker/risk-tasks/review.vue`

- [ ] **Step 1: 重写页面**

```vue
<template>
  <view class="page">
    <AppNavbar title="风险复核" />

    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <template v-else-if="event">
      <!-- 风险标题 -->
      <view class="review-header">
        <view class="review-header__top">
          <AppTag :level="event.level.toLowerCase()" />
          <text class="review-header__title">{{ event.reason || '风险事件' }}</text>
        </view>
      </view>

      <!-- 详情区 -->
      <view class="review-section">
        <view class="review-field">
          <text class="review-field__label">触发老人</text>
          <text class="review-field__value">{{ event.elderName }}</text>
        </view>
        <view class="review-field">
          <text class="review-field__label">风险评分</text>
          <text class="review-field__value">{{ event.score }} 分</text>
        </view>
        <view class="review-field">
          <text class="review-field__label">触发来源</text>
          <text class="review-field__value">{{ event.source }}</text>
        </view>
        <view class="review-field">
          <text class="review-field__label">触发时间</text>
          <text class="review-field__value">{{ formatTime(event.createdAt) }}</text>
        </view>
        <view v-if="event.reason" class="review-field">
          <text class="review-field__label">风险描述</text>
          <text class="review-field__value review-field__value--desc">{{ event.reason }}</text>
        </view>
      </view>

      <view class="review-divider">
        <text class="review-divider__text">复核备注</text>
      </view>

      <!-- 备注输入 -->
      <view class="review-textarea-wrap">
        <textarea
          v-model="note"
          class="review-textarea"
          :placeholder="event.level === 'HIGH' ? '高风险事件必须填写复核备注...' : '请记录您的复核意见...'"
          :maxlength="500"
          auto-height
        />
      </view>

      <!-- 操作按钮 -->
      <view class="review-actions">
        <AppButton type="primary" size="full" :loading="submitting" @click="handleConfirm">
          确认预警
        </AppButton>
        <AppButton type="text" size="full" @click="handleIgnore">
          忽略预警
        </AppButton>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppTag from '@/components/AppTag.vue';
import AppButton from '@/components/AppButton.vue';
import { riskApi } from '@/api/risk';

const event = ref<any>(null);
const note = ref('');
const loading = ref(false);
const submitting = ref(false);

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
}

async function loadDetail() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1] as any;
  const id = current?.options?.id;
  if (!id) {
    uni.showToast({ title: '参数错误', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const res = await riskApi.listEvents({});
    const data = (res as any)?.data?.data;
    const items = data?.items || [];
    event.value = items.find((e: any) => e.id === id) || null;
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function submitReview(status: string) {
  if (!event.value) return;
  if (event.value.level === 'HIGH' && !note.value.trim()) {
    uni.showToast({ title: '高风险事件必须填写复核备注', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await riskApi.review(event.value.id, { status, note: note.value });
    uni.showToast({ title: status === 'CONFIRMED' ? '已确认' : '已忽略' });
    setTimeout(() => uni.navigateBack(), 1000);
  } catch {
    // client interceptor already shows toast
  } finally {
    submitting.value = false;
  }
}

function handleConfirm() { submitReview('CONFIRMED'); }
function handleIgnore() { submitReview('IGNORED'); }

onMounted(() => { loadDetail(); });
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 48rpx;
}
.review-header {
  padding: 32rpx 20rpx 0;
}
.review-header__top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.review-header__title {
  font-size: 36rpx;
  font-weight: 600;
  color: #2C2B29;
}
.review-section {
  margin: 24rpx 20rpx;
  padding: 0;
}
.review-field {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 14rpx 0;
}
.review-field + .review-field {
  border-top: 1rpx solid #F0ECE5;
}
.review-field__label {
  width: 160rpx;
  flex-shrink: 0;
  font-size: 28rpx;
  color: #9E9990;
}
.review-field__value {
  flex: 1;
  font-size: 28rpx;
  color: #2C2B29;
}
.review-field__value--desc {
  line-height: 1.8;
}
.review-divider {
  padding: 0 20rpx;
  margin: 16rpx 0;
}
.review-divider__text {
  font-size: 22rpx;
  color: #9E9990;
}
.review-textarea-wrap {
  margin: 0 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #E8E3DA;
}
.review-textarea {
  width: 100%;
  min-height: 200rpx;
  font-size: 28rpx;
  color: #2C2B29;
  line-height: 1.6;
  background: transparent;
}
.review-actions {
  padding: 48rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
}
.page-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}
.page-state__text {
  font-size: 28rpx;
  color: #9E9990;
}
</style>
```

> **注意：** 当前 `riskApi` 没有 `getById` 方法——现有详情是直接从列表中获取的。这里复用 `listEvents` 后客户端侧过滤。如果后续需要单独获取某个事件详情，添加 `getById` 到 `riskApi`。

- [ ] **Step 2: 上传照片支持（可选，如需要）**

如果复核需要支持上传照片，可在备注区下方添加照片上传区域（复用 visit-form 的 takePhoto 模式）。

- [ ] **Step 3: 提交**

```bash
git add apps/miniapp/src/pagesWorker/risk-tasks/review.vue
git commit -m "feat: redesign risk-tasks review with new components and typed API"
```

---

### Task 13: 巡访记录表单 `visit-form/index.vue`

**Files:**
- Modify: `apps/miniapp/src/pagesWorker/visit-form/index.vue`

- [ ] **Step 1: 重写页面**

```vue
<template>
  <view class="page">
    <AppNavbar title="巡访记录" />

    <!-- 老人信息区 -->
    <view class="form-section">
      <text class="form-section__label">老人信息</text>
      <view class="form-input-wrap">
        <input
          v-model="elderId"
          class="form-input"
          placeholder="输入老人编号或姓名"
          placeholder-style="color: #9E9990"
        />
      </view>
    </view>

    <!-- 巡访观察区 -->
    <view class="form-section">
      <text class="form-section__label">巡访观察</text>
      <view class="form-textarea-wrap">
        <textarea
          v-model="observation"
          class="form-textarea"
          placeholder="记录巡访中观察到的情况..."
          placeholder-style="color: #9E9990"
          :maxlength="2000"
          auto-height
        />
      </view>
    </view>

    <!-- 现场照片区 -->
    <view class="form-section">
      <text class="form-section__label">现场照片</text>
      <view class="photo-grid">
        <view
          v-for="(photo, idx) in photos"
          :key="idx"
          class="photo-grid__item"
        >
          <image :src="photo" class="photo-grid__img" mode="aspectFill" />
          <view class="photo-grid__remove" @click="removePhoto(photo)">
            <text>×</text>
          </view>
        </view>
        <view
          v-if="photos.length < MAX_PHOTOS"
          class="photo-grid__add"
          @click="takePhoto"
        >
          <text class="photo-grid__add-icon">+</text>
        </view>
      </view>
    </view>

    <!-- 补充说明区 -->
    <view class="form-section">
      <text class="form-section__label">补充说明</text>
      <view class="form-textarea-wrap">
        <textarea
          v-model="note"
          class="form-textarea form-textarea--short"
          placeholder="其他需要记录的内容..."
          placeholder-style="color: #9E9990"
          :maxlength="500"
        />
      </view>
    </view>

    <!-- 底部提交按钮（固定） -->
    <view class="form-footer">
      <AppButton type="primary" size="full" :loading="submitting" @click="handleSubmit">
        提交巡访记录
      </AppButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppButton from '@/components/AppButton.vue';
import { visitsApi } from '@/api/visits';
import { useVisitForm } from '@/composables/useVisitForm';

const { photos, submitting, MAX_PHOTOS, validate, addPhoto, removePhoto, clearPhotos } = useVisitForm();

const elderId = ref('');
const observation = ref('');
const note = ref('');

function resetForm() {
  elderId.value = '';
  observation.value = '';
  note.value = '';
  clearPhotos();
}

function takePhoto() {
  uni.chooseImage({
    count: 1,
    success: (res: any) => {
      if (res.tempFilePaths?.[0]) {
        addPhoto(res.tempFilePaths[0]);
      }
    },
  });
}

async function handleSubmit() {
  const result = validate({ elderId: elderId.value, observation: observation.value });
  if (!result.valid) {
    uni.showToast({ title: result.message || '请完善表单', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await visitsApi.create({
      elderId: elderId.value,
      observation: observation.value,
      photos: photos.value.length > 0 ? photos.value : undefined,
      note: note.value || undefined,
    });
    uni.showToast({ title: '提交成功' });
    resetForm();
  } catch {
    // client interceptor already shows toast
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 140rpx;
}
.form-section {
  padding: 0 20rpx;
  margin-top: 32rpx;
}
.form-section__label {
  font-size: 22rpx;
  color: #9E9990;
  margin-bottom: 12rpx;
  display: block;
}
.form-input-wrap {
  border-bottom: 1rpx solid #E8E3DA;
  padding: 12rpx 0;
}
.form-input {
  width: 100%;
  font-size: 28rpx;
  color: #2C2B29;
  height: 56rpx;
  line-height: 56rpx;
}
.form-textarea-wrap {
  border-bottom: 1rpx solid #E8E3DA;
  padding: 12rpx 0;
}
.form-textarea {
  width: 100%;
  min-height: 240rpx;
  font-size: 28rpx;
  color: #2C2B29;
  line-height: 1.6;
}
.form-textarea--short {
  min-height: 120rpx;
}

.photo-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 12rpx;
}
.photo-grid__item {
  width: 160rpx;
  height: 160rpx;
  border-radius: 8rpx;
  overflow: hidden;
  position: relative;
}
.photo-grid__img {
  width: 100%;
  height: 100%;
}
.photo-grid__remove {
  position: absolute;
  top: -4rpx;
  right: -4rpx;
  width: 40rpx;
  height: 40rpx;
  background-color: #C4706B;
  color: #FEFDFB;
  border-radius: 9999rpx;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24rpx;
}
.photo-grid__add {
  width: 160rpx;
  height: 160rpx;
  border: 2rpx dashed #D0CBC2;
  border-radius: 8rpx;
  display: flex;
  align-items: center;
  justify-content: center;
}
.photo-grid__add-icon {
  font-size: 48rpx;
  color: #9E9990;
}

.form-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #F7F3ED;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/pagesWorker/visit-form/index.vue
git commit -m "feat: redesign visit form with new components and typed API"
```

---

### Task 14: 巡访历史 `visit-form/records.vue`

**Files:**
- Modify: `apps/miniapp/src/pagesWorker/visit-form/records.vue`

- [ ] **Step 1: 重写页面**

```vue
<template>
  <view class="page">
    <AppNavbar title="巡访历史" />

    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <AppEmpty
      v-else-if="records.length === 0"
      message="暂无巡访记录"
      hint="完成巡访后记录将显示在这里"
    />

    <template v-else>
      <AppCard v-for="r in records" :key="r.id">
        <view class="record-row">
          <view class="record-row__main">
            <text class="record-row__name">{{ r.elderName || r.elderId }}</text>
            <text class="record-row__obs">{{ r.observation }}</text>
            <text v-if="r.photos?.length" class="record-row__photos">
              📷 {{ r.photos.length }} 张照片
            </text>
          </view>
          <text class="record-row__time">{{ formatTime(r.visitTime || r.createdAt) }}</text>
        </view>
      </AppCard>

      <view class="page-end">
        <text class="page-end__text">没有更多记录了</text>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppCard from '@/components/AppCard.vue';
import AppEmpty from '@/components/AppEmpty.vue';
import { visitsApi } from '@/api/visits';

const records = ref<any[]>([]);
const loading = ref(false);

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
}

async function loadData() {
  loading.value = true;
  try {
    const res = await visitsApi.list({});
    const data = (res as any)?.data?.data;
    if (data?.items) records.value = data.items;
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 48rpx;
}
.record-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  gap: 16rpx;
}
.record-row__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}
.record-row__name {
  font-size: 32rpx;
  font-weight: 500;
  color: #2C2B29;
}
.record-row__obs {
  font-size: 28rpx;
  color: #6B6760;
  line-height: 1.5;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}
.record-row__photos {
  font-size: 22rpx;
  color: #6E8A9A;
}
.record-row__time {
  font-size: 22rpx;
  color: #9E9990;
  flex-shrink: 0;
}
.page-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}
.page-state__text {
  font-size: 28rpx;
  color: #9E9990;
}
.page-end {
  display: flex;
  justify-content: center;
  padding: 24rpx 0;
}
.page-end__text {
  font-size: 22rpx;
  color: #9E9990;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/pagesWorker/visit-form/records.vue
git commit -m "feat: redesign visit records list with new components and typed API"
```

---

### Task 15: 工单列表 `work-order/list.vue`

**Files:**
- Modify: `apps/miniapp/src/pagesWorker/work-order/list.vue`

- [ ] **Step 1: 重写页面**

```vue
<template>
  <view class="page">
    <AppNavbar title="工单列表" />

    <!-- Tab 切换 -->
    <wd-tabs v-model="activeTab" @change="loadData">
      <wd-tab title="待处理" name="ASSIGNED" />
      <wd-tab title="进行中" name="IN_PROGRESS" />
      <wd-tab title="已完成" name="COMPLETED" />
    </wd-tabs>

    <!-- 加载态 -->
    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <AppEmpty
      v-else-if="orders.length === 0"
      :message="emptyMessage"
      hint="下拉刷新试试"
    />

    <!-- 列表 -->
    <template v-else>
      <AppCard
        v-for="o in orders"
        :key="o.id"
        :accent-color="statusColor(o.status)"
        clickable
        @click="goToDetail(o)"
      >
        <view class="order-row">
          <view class="order-row__main">
            <view class="order-row__top">
              <AppStatusDot :status="statusDotType(o.status)" :size="12" />
              <text class="order-row__title">
                {{ TYPE_LABELS[o.type] || o.type }}
                <text class="order-row__elder"> · {{ o.elderName || o.elderId }}</text>
              </text>
            </view>
            <text class="order-row__meta">
              优先级：{{ o.level }}
            </text>
          </view>
          <view class="order-row__side">
            <text class="order-row__time">
              {{ formatTime(activeTab === 'COMPLETED' ? (o.completedAt || o.createdAt) : o.createdAt) }}
            </text>
            <AppButton
              :type="activeTab === 'COMPLETED' ? 'secondary' : 'primary'"
              size="compact"
              @click.stop="goToDetail(o)"
            >
              {{ actionLabel }}
            </AppButton>
          </view>
        </view>
      </AppCard>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppCard from '@/components/AppCard.vue';
import AppStatusDot from '@/components/AppStatusDot.vue';
import AppButton from '@/components/AppButton.vue';
import AppEmpty from '@/components/AppEmpty.vue';
import { workOrdersApi } from '@/api/work-orders';
import { TYPE_LABELS } from '@/composables/useOrderProgress';

const activeTab = ref('ASSIGNED');
const orders = ref<any[]>([]);
const loading = ref(false);

const actionLabel = computed(() => {
  if (activeTab.value === 'ASSIGNED') return '开始处理';
  if (activeTab.value === 'IN_PROGRESS') return '继续处理';
  return '查看详情';
});

const emptyMessage = computed(() => {
  if (activeTab.value === 'ASSIGNED') return '暂无待处理工单';
  if (activeTab.value === 'IN_PROGRESS') return '暂无进行中工单';
  return '暂无已完成工单';
});

function statusColor(status: string): string {
  if (status === 'ASSIGNED') return '#C49B5E';
  if (status === 'IN_PROGRESS') return '#6E8A9A';
  return '#7A9A6E';
}

function statusDotType(status: string): string {
  if (status === 'ASSIGNED') return 'warning';
  if (status === 'IN_PROGRESS') return 'info';
  return 'success';
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
}

async function loadData() {
  loading.value = true;
  try {
    const res = await workOrdersApi.list({ status: activeTab.value });
    const data = (res as any)?.data?.data;
    if (data?.items) orders.value = data.items;
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goToDetail(o: any) {
  uni.navigateTo({ url: `/pagesWorker/work-order/detail?id=${o.id}` });
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 48rpx;
}
.order-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.order-row__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}
.order-row__top {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.order-row__title {
  font-size: 28rpx;
  font-weight: 500;
  color: #2C2B29;
}
.order-row__elder {
  font-weight: 400;
  color: #6B6760;
}
.order-row__meta {
  font-size: 24rpx;
  color: #6B6760;
}
.order-row__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}
.order-row__time {
  font-size: 22rpx;
  color: #9E9990;
}
.page-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}
.page-state__text {
  font-size: 28rpx;
  color: #9E9990;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/pagesWorker/work-order/list.vue
git commit -m "feat: redesign work order list with new components and state handling"
```

---

### Task 16: 工单详情 `work-order/detail.vue`

**Files:**
- Modify: `apps/miniapp/src/pagesWorker/work-order/detail.vue`

- [ ] **Step 1: 重写页面**

```vue
<template>
  <view class="page">
    <AppNavbar title="工单详情" />

    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <template v-else-if="order">
      <!-- 状态指示 -->
      <view class="detail-header">
        <view class="detail-header__status">
          <AppStatusDot :status="statusDotType(order.status)" :size="14" />
          <text class="detail-header__status-text">
            {{ STATUS_LABELS[order.status] || order.status }}
          </text>
        </view>
        <text class="detail-header__title">
          {{ TYPE_LABELS[order.type] || order.type }}
        </text>
      </view>

      <!-- 信息区 -->
      <view class="detail-section">
        <view class="detail-field">
          <text class="detail-field__label">关联老人</text>
          <text class="detail-field__value">{{ order.elderName || order.elderId }}</text>
        </view>
        <view class="detail-field">
          <text class="detail-field__label">优先级</text>
          <text class="detail-field__value">{{ order.level }}</text>
        </view>
        <view v-if="order.assigneeName" class="detail-field">
          <text class="detail-field__label">负责人</text>
          <text class="detail-field__value">{{ order.assigneeName }}</text>
        </view>
        <view class="detail-field">
          <text class="detail-field__label">创建时间</text>
          <text class="detail-field__value">{{ formatTime(order.createdAt) }}</text>
        </view>
        <view v-if="order.startedAt" class="detail-field">
          <text class="detail-field__label">开始时间</text>
          <text class="detail-field__value">{{ formatTime(order.startedAt) }}</text>
        </view>
      </view>

      <view class="detail-divider">
        <text class="detail-divider__text">处理记录</text>
      </view>

      <!-- 时间线 -->
      <view v-if="timeline.length > 0" class="detail-timeline">
        <wd-timeline>
          <wd-timeline-item
            v-for="t in timeline"
            :key="t.id"
            :title="t.action"
            :content="t.note || ''"
            :time="formatTime(t.createdAt)"
          />
        </wd-timeline>
      </view>

      <!-- 操作按钮区（固定底部） -->
      <view v-if="availableActions.length > 0" class="detail-footer">
        <AppButton
          v-for="action in availableActions"
          :key="action"
          :type="action === 'START' ? 'primary' : 'primary'"
          size="full"
          @click="handleAction(action)"
        >
          {{ action === 'START' ? '开始处理' : action === 'COMPLETE' ? '完成处理' : action }}
        </AppButton>
        <AppButton
          v-if="showCancel"
          type="text"
          size="full"
          @click="handleCancel"
        >
          取消工单
        </AppButton>
      </view>
    </template>

    <!-- 完成弹窗 -->
    <wd-message-box v-model="resultDialogVisible" title="填写处理结果">
      <textarea
        v-model="resultText"
        style="width: 100%; min-height: 160rpx; font-size: 28rpx; padding: 12rpx 0;"
        placeholder="请描述处理结果..."
      />
      <template #footer>
        <AppButton size="compact" type="text" @click="resultDialogVisible = false">
          取消
        </AppButton>
        <AppButton size="compact" type="primary" @click="submitResult">
          确认
        </AppButton>
      </template>
    </wd-message-box>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppStatusDot from '@/components/AppStatusDot.vue';
import AppButton from '@/components/AppButton.vue';
import { workOrdersApi } from '@/api/work-orders';
import { useWorkOrderFlow } from '@/composables/useWorkOrderFlow';
import { TYPE_LABELS, STATUS_LABELS } from '@/composables/useOrderProgress';

const { getAvailableActions, validateCompletion } = useWorkOrderFlow();

const order = ref<any>(null);
const timeline = ref<any[]>([]);
const resultText = ref('');
const resultDialogVisible = ref(false);
const loading = ref(false);

const availableActions = computed(() =>
  order.value ? getAvailableActions(order.value.status) : []
);

const showCancel = computed(() =>
  order.value?.status === 'ASSIGNED' || order.value?.status === 'IN_PROGRESS'
);

function statusDotType(status: string): string {
  if (status === 'ASSIGNED') return 'warning';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'COMPLETED') return 'success';
  return 'info';
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
}

async function loadDetail() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1] as any;
  const id = current?.options?.id;
  if (!id) {
    uni.showToast({ title: '参数错误', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const [detailRes, timelineRes] = await Promise.all([
      workOrdersApi.getById(id),
      workOrdersApi.getTimeline(id),
    ]);
    const detailData = (detailRes as any)?.data?.data;
    if (detailData) order.value = detailData;
    const timelineData = (timelineRes as any)?.data?.data;
    if (timelineData) timeline.value = Array.isArray(timelineData) ? timelineData : [];
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function handleAction(action: string) {
  if (action === 'COMPLETE') {
    resultDialogVisible.value = true;
    return;
  }
  if (!order.value) return;
  try {
    if (action === 'START') {
      await workOrdersApi.start(order.value.id);
    } else {
      uni.showToast({ title: `不支持的操作: ${action}`, icon: 'none' });
      return;
    }
    uni.showToast({ title: '操作成功' });
    loadDetail();
  } catch {
    // client interceptor already shows toast
  }
}

async function submitResult() {
  if (!order.value) return;
  const validation = validateCompletion(resultText.value);
  if (!validation.valid) {
    uni.showToast({ title: validation.message || '请填写处理结果', icon: 'none' });
    return;
  }
  try {
    await workOrdersApi.complete(order.value.id, { result: resultText.value });
    uni.showToast({ title: '已完成' });
    resultDialogVisible.value = false;
    loadDetail();
  } catch {
    // client interceptor already shows toast
  }
}

async function handleCancel() {
  if (!order.value) return;
  try {
    await workOrdersApi.cancel(order.value.id);
    uni.showToast({ title: '已取消' });
    loadDetail();
  } catch {
    // client interceptor already shows toast
  }
}

onMounted(() => { loadDetail(); });
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 160rpx;
}
.detail-header {
  padding: 32rpx 20rpx 0;
}
.detail-header__status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 12rpx;
}
.detail-header__status-text {
  font-size: 28rpx;
  color: #6B6760;
}
.detail-header__title {
  font-size: 36rpx;
  font-weight: 600;
  color: #2C2B29;
}
.detail-section {
  margin: 24rpx 20rpx;
  padding: 0;
}
.detail-field {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 14rpx 0;
}
.detail-field + .detail-field {
  border-top: 1rpx solid #F0ECE5;
}
.detail-field__label {
  width: 160rpx;
  flex-shrink: 0;
  font-size: 28rpx;
  color: #9E9990;
}
.detail-field__value {
  flex: 1;
  font-size: 28rpx;
  color: #2C2B29;
}
.detail-divider {
  padding: 0 20rpx;
  margin: 16rpx 0;
}
.detail-divider__text {
  font-size: 22rpx;
  color: #9E9990;
}
.detail-timeline {
  margin: 0 20rpx;
}
.detail-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #F7F3ED;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
}
.page-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}
.page-state__text {
  font-size: 28rpx;
  color: #9E9990;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/pagesWorker/work-order/detail.vue
git commit -m "feat: redesign work order detail with typed API and state handling"
```

---

### Task 17: 电话核实 `verification/index.vue`

**Files:**
- Modify: `apps/miniapp/src/pagesWorker/verification/index.vue`

- [ ] **Step 1: 重写页面**

```vue
<template>
  <view class="page">
    <AppNavbar title="电话核实" />

    <!-- 老人信息区 -->
    <view class="form-section">
      <text class="form-section__label">老人信息</text>
      <view class="form-input-wrap">
        <input
          v-model="elderId"
          class="form-input"
          placeholder="输入老人编号或姓名"
          placeholder-style="color: #9E9990"
        />
      </view>
    </view>

    <!-- 核实结果区 -->
    <view class="form-section">
      <text class="form-section__label">核实结果</text>
      <view class="form-textarea-wrap">
        <textarea
          v-model="note"
          class="form-textarea"
          placeholder="记录电话核实的内容和结果..."
          placeholder-style="color: #9E9990"
          :maxlength="2000"
          auto-height
        />
      </view>
    </view>

    <!-- 提交按钮（固定底部） -->
    <view class="form-footer">
      <AppButton type="primary" size="full" :loading="submitting" @click="handleSubmit">
        提交核实记录
      </AppButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppButton from '@/components/AppButton.vue';
import { visitsApi } from '@/api/visits';

const elderId = ref('');
const note = ref('');
const submitting = ref(false);

async function handleSubmit() {
  if (!elderId.value.trim() || !note.value.trim()) {
    uni.showToast({ title: '请完善信息', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await visitsApi.create({
      elderId: elderId.value,
      observation: `[电话核实] ${note.value}`,
    });
    uni.showToast({ title: '已记录' });
    elderId.value = '';
    note.value = '';
  } catch {
    // client interceptor already shows toast
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 140rpx;
}
.form-section {
  padding: 0 20rpx;
  margin-top: 32rpx;
}
.form-section__label {
  font-size: 22rpx;
  color: #9E9990;
  margin-bottom: 12rpx;
  display: block;
}
.form-input-wrap {
  border-bottom: 1rpx solid #E8E3DA;
  padding: 12rpx 0;
}
.form-input {
  width: 100%;
  font-size: 28rpx;
  color: #2C2B29;
  height: 56rpx;
  line-height: 56rpx;
}
.form-textarea-wrap {
  border-bottom: 1rpx solid #E8E3DA;
  padding: 12rpx 0;
}
.form-textarea {
  width: 100%;
  min-height: 240rpx;
  font-size: 28rpx;
  color: #2C2B29;
  line-height: 1.6;
}
.form-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #F7F3ED;
}
</style>
```

- [ ] **Step 2: 提交**

```bash
git add apps/miniapp/src/pagesWorker/verification/index.vue
git commit -m "feat: redesign verification form with typed API"
```

---

### Task 18: 构建验证

**Files:**
- (验证，不创建文件)

- [ ] **Step 1: 检查 TypeScript 编译**

```bash
cd apps/miniapp && npx vue-tsc --noEmit 2>&1 | head -50
```

修复所有类型错误。

- [ ] **Step 2: 运行现有测试**

```bash
cd apps/miniapp && npx vitest run
```

确保所有 composable 和 store 测试仍然通过。

- [ ] **Step 3: 尝试构建**

```bash
cd apps/miniapp && npx uni-app-cli build --platform mp-weixin
```

修复所有构建错误。

- [ ] **Step 4: 提交最终修复**

```bash
git add -A
git commit -m "chore: fix build errors and type issues from worker redesign"
```

---

### Task 19: 功能验证清单（手动）

> 以下步骤需在微信开发者工具中手动验证，或通过 uni-app 真机调试完成。

- [ ] **Step 1: 首页路由**
  - 已登录工作人员 → 自动跳转风险待办
  - 已登录老人/家属 → 自动跳转一键报平安
  - 未登录 → 触发微信登录后跳转

- [ ] **Step 2: 风险待办列表**
  - 列表正确加载
  - 筛选器切换正常（全部/HIGH/MEDIUM/LOW）
  - 空数据时展示 AppEmpty
  - 点击卡片跳转复核页

- [ ] **Step 3: 风险复核**
  - 详情正确展示
  - 备注输入正常
  - HIGH 级别强制校验备注
  - 确认/忽略操作成功跳回

- [ ] **Step 4: 巡访记录表单**
  - 表单输入正常
  - 照片选择/删除正常
  - 必填校验生效
  - 提交成功清空表单

- [ ] **Step 5: 巡访历史**
  - 列表正确加载
  - 空列表展示 AppEmpty

- [ ] **Step 6: 工单列表**
  - 三 Tab 切换正常
  - 每个 Tab 的数据正确加载
  - 空 Tab 展示对应文案
  - 操作按钮文案随 Tab 变化

- [ ] **Step 7: 工单详情**
  - 详情信息正确展示
  - 时间线正确渲染
  - 开始处理/完成处理操作正常
  - 取消工单正常
  - 底部操作区固定在可视区域

- [ ] **Step 8: 电话核实**
  - 表单输入正常
  - 必填校验
  - 提交成功清空表单

- [ ] **Step 9: 全局样式一致性**
  - 所有页面背景色为 `#F7F3ED`
  - 卡片为白底 + 底部细线
  - 按钮颜色正确（鼠尾草绿/陶土）
  - 导航栏样式统一

---

## 实施顺序（推荐）

按 Task 1 → 18 顺序执行。Tasks 1-9（基础设施 + 组件）必须在任何页面重写之前完成。Tasks 11-17（页面）可以并行执行，但建议按列表顺序逐步验证。

| 阶段 | Tasks | 预计耗时 | 产出 |
|------|-------|---------|------|
| 底座层 | 1-3 | 15min | 设计令牌、全局样式、pages.json |
| 骨架层 | 4-9 | 30min | 6 个自建组件 |
| 路由 | 10 | 10min | 首页角色分发 |
| 血肉层 | 11-17 | 60min | 7 个页面重写 |
| 验证 | 18-19 | 20min | 构建通过 + 功能验证 |
