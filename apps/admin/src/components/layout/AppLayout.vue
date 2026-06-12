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

// TODO: Wire real WebSocket gateway events once the backend Socket.IO gateway
// is fully integrated (currently connects to VITE_WS_URL or localhost:3000).
// Expected flow: socket emits 'risk:new' with count → update newRiskCount.
const { connected, on, off } = useWebSocket('/dashboard');
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
