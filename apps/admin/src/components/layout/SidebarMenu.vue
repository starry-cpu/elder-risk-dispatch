<template>
  <nav class="sidebar-nav">
    <el-menu
      :default-active="activeMenu"
      router
      background-color="transparent"
      text-color="#a8b0c0"
      active-text-color="#e8d5a3"
    >
      <el-menu-item index="/dashboard">
        <span class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="1" y="1" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
            <rect x="10" y="1" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
            <rect x="1" y="10" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
            <rect x="10" y="10" width="7" height="7" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
          </svg>
        </span>
        <span>驾驶舱</span>
      </el-menu-item>

      <el-menu-item index="/elders">
        <span class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="6" r="3" stroke="currentColor" stroke-width="1.4"/>
            <path d="M3 16c0-3.3 2.7-6 6-6s6 2.7 6 6" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </span>
        <span>老人档案</span>
      </el-menu-item>

      <el-menu-item index="/risk">
        <span class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M9 2L16 14H2L9 2z" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round"/>
            <line x1="9" y1="7.5" x2="9" y2="10.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="9" cy="13" r="0.7" fill="currentColor"/>
          </svg>
        </span>
        <span>预警中心</span>
      </el-menu-item>

      <el-menu-item index="/work-orders">
        <span class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="2.5" y="1.5" width="13" height="15" rx="1.5" stroke="currentColor" stroke-width="1.4"/>
            <line x1="6" y1="5.5" x2="12" y2="5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="6" y1="8.5" x2="12" y2="8.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
            <line x1="6" y1="11.5" x2="10" y2="11.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round"/>
          </svg>
        </span>
        <span>工单管理</span>
      </el-menu-item>

      <el-menu-item index="/rules">
        <span class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7" stroke="currentColor" stroke-width="1.4"/>
            <circle cx="9" cy="9" r="3" stroke="currentColor" stroke-width="1.4"/>
            <line x1="9" y1="2" x2="9" y2="4.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <line x1="9" y1="13.5" x2="9" y2="16" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
          </svg>
        </span>
        <span>规则配置</span>
      </el-menu-item>

      <el-menu-item index="/users">
        <span class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="7" cy="5.5" r="2.5" stroke="currentColor" stroke-width="1.4"/>
            <path d="M1.5 14.5c0-3 2.5-5.5 5.5-5.5s5.5 2.5 5.5 5.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/>
            <circle cx="13" cy="5.5" r="1.8" stroke="currentColor" stroke-width="1.2" stroke-dasharray="3 1.5"/>
          </svg>
        </span>
        <span>人员排班</span>
      </el-menu-item>

      <el-menu-item index="/audit">
        <span class="nav-icon">
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="9" cy="9" r="7.5" stroke="currentColor" stroke-width="1.4"/>
            <polyline points="9,4.5 9,9 13,11" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </span>
        <span>审计日志</span>
      </el-menu-item>
    </el-menu>
  </nav>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';

const route = useRoute();
const activeMenu = computed(() => route.path);
</script>

<style scoped>
.sidebar-nav {
  padding: 12px 0;
  flex: 1;
  overflow-y: auto;
}

.sidebar-nav :deep(.el-menu) {
  border-right: none;
}

.sidebar-nav :deep(.el-menu-item) {
  height: 40px;
  line-height: 40px;
  margin: 1px 10px;
  border-radius: 6px;
  font-size: 13.5px;
  padding-left: 16px !important;
  display: flex;
  align-items: center;
  gap: 10px;
  transition: all 0.2s ease;
  color: #a8b0c0;
}

.sidebar-nav :deep(.el-menu-item:hover) {
  background: rgba(255, 255, 255, 0.04);
  color: #c8d0dc;
}

.sidebar-nav :deep(.el-menu-item.is-active) {
  background: rgba(184, 134, 11, 0.12);
  color: #e8d5a3;
  font-weight: 500;
}

.nav-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 18px;
  height: 18px;
  flex-shrink: 0;
  margin-right: 2px;
}

.sidebar-nav :deep(.el-menu-item.is-active) .nav-icon {
  color: #d4a535;
}
</style>
