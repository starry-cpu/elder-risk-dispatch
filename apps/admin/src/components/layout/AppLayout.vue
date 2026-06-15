<template>
  <div class="app-shell">
    <!-- Sidebar -->
    <aside class="sidebar">
      <div class="sidebar-brand">
        <div class="brand-icon">
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="6" fill="rgba(184,134,11,0.2)"/>
            <path d="M14 6C10.7 6 8 8.7 8 12c0 2.5 1.5 4.7 3.8 5.7L13 22h2l1.2-4.3c2.3-1 3.8-3.2 3.8-5.7 0-3.3-2.7-6-6-6z" fill="#d4a535" opacity="0.9"/>
            <circle cx="11" cy="11.5" r="1.2" fill="#1a1f2e"/>
            <circle cx="16" cy="11.5" r="1.2" fill="#1a1f2e"/>
            <path d="M11 15c.8.8 2.2 1.2 3 0" stroke="#1a1f2e" stroke-width="0.8" stroke-linecap="round"/>
          </svg>
        </div>
        <div class="brand-text">
          <span class="brand-title">照护调度</span>
          <span class="brand-subtitle">ElderCare</span>
        </div>
      </div>
      <SidebarMenu />
      <div class="sidebar-footer">
        <div class="status-dot" />
        <span class="text-xs" style="color: #6b7394">系统运行中</span>
      </div>
    </aside>

    <!-- Main Area -->
    <div class="main-area">
      <!-- Header -->
      <header class="topbar">
        <div class="topbar-left">
          <span class="page-title">{{ route.meta?.title || '' }}</span>
        </div>
        <div class="topbar-right">
          <div class="notification-bell" @click="newRiskCount = 0">
            <el-badge :value="newRiskCount" :hidden="newRiskCount === 0" :max="99">
              <el-icon :size="20"><Bell /></el-icon>
            </el-badge>
          </div>
          <div class="user-info">
            <span class="user-name">{{ authStore.user?.name || '管理员' }}</span>
          </div>
          <button class="logout-btn" @click="handleLogout">
            <span>退出</span>
          </button>
        </div>
      </header>

      <!-- Content -->
      <main class="content">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { Bell } from '@element-plus/icons-vue';
import { useAuthStore } from '@/stores/auth';
import { useWebSocket } from '@/composables/useWebSocket';
import SidebarMenu from './SidebarMenu.vue';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();
const newRiskCount = ref(0);

const { on, off } = useWebSocket('/dashboard');
onMounted(() => {
  on('risk:new', (data: any) => {
    newRiskCount.value = data?.count ?? data ?? 0;
  });
});
onUnmounted(() => {
  off('risk:new');
});

function handleLogout() {
  authStore.logout();
  router.push('/login');
}
</script>

<style scoped>
.app-shell {
  display: flex;
  height: 100vh;
  overflow: hidden;
}

/* ── Sidebar ── */
.sidebar {
  width: 230px;
  flex-shrink: 0;
  background: var(--surface-sidebar);
  display: flex;
  flex-direction: column;
  z-index: 10;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 20px 20px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
}

.brand-icon {
  flex-shrink: 0;
  display: flex;
  align-items: center;
}

.brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.3;
}

.brand-title {
  font-family: var(--font-display);
  font-size: 16px;
  font-weight: 600;
  color: #e8d5a3;
  letter-spacing: 0.04em;
}

.brand-subtitle {
  font-size: 10px;
  color: #6b7394;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.sidebar-footer {
  margin-top: auto;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  gap: 8px;
  border-top: 1px solid rgba(255, 255, 255, 0.06);
}

.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #6b8f71;
  box-shadow: 0 0 6px rgba(107, 143, 113, 0.4);
}

/* ── Main Area ── */
.main-area {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

/* ── Topbar ── */
.topbar {
  height: 56px;
  flex-shrink: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 32px;
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid var(--border-color);
  position: relative;
  z-index: 5;
}

.topbar-left {
  display: flex;
  align-items: center;
}

.page-title {
  font-family: var(--font-display);
  font-size: 17px;
  font-weight: 500;
  color: var(--text-primary);
  letter-spacing: 0.03em;
}

.topbar-right {
  display: flex;
  align-items: center;
  gap: 16px;
}

.notification-bell {
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--radius-md);
  color: var(--text-secondary);
  cursor: pointer;
  transition: all 0.2s ease;
}
.notification-bell:hover {
  background: var(--fill-color);
  color: var(--text-primary);
}

.user-info {
  display: flex;
  align-items: center;
  gap: 8px;
}

.user-name {
  font-size: 13px;
  color: var(--text-secondary);
  font-weight: 450;
}

.logout-btn {
  background: none;
  border: 1px solid var(--border-color);
  color: var(--text-secondary);
  font-size: 12px;
  padding: 5px 14px;
  border-radius: var(--radius-sm);
  cursor: pointer;
  font-family: var(--font-body);
  transition: all 0.2s ease;
}
.logout-btn:hover {
  border-color: var(--color-danger);
  color: var(--color-danger);
  background: rgba(196, 85, 77, 0.04);
}

/* ── Content ── */
.content {
  flex: 1;
  overflow-y: auto;
  padding: 28px 32px;
  position: relative;
  z-index: 1;
}
</style>
