<template>
  <view class="page">
    <AppNavbar title="工单进度" />

    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <AppEmpty
      v-else-if="displayItems.length === 0"
      message="暂无进行中的工单"
      hint="工作人员将尽快处理您的需求"
    />

    <view v-else class="orders">
      <AppCard
        v-for="item in displayItems"
        :key="item.id"
        :accent-color="accentColor(item.level)"
      >
        <view class="order">
          <view class="order__head">
            <AppTag :level="levelToTag(item.level)" />
            <text class="order__title">{{ item.title }}</text>
          </view>

          <!-- 进度条 -->
          <view class="order__progress">
            <view class="order__labels">
              <text class="order__label">已接单</text>
              <text class="order__label">处理中</text>
              <text class="order__label">已完成</text>
            </view>
            <view class="order__track">
              <view class="order__fill" :style="{ width: progressWidth(item.status) }" />
            </view>
            <text class="order__status">{{ item.statusLabel }}</text>
          </view>

          <text class="order__time">{{ formatTime(item.createdAt) }}</text>
        </view>
      </AppCard>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppCard from '@/components/AppCard.vue';
import AppTag from '@/components/AppTag.vue';
import AppEmpty from '@/components/AppEmpty.vue';
import { workOrdersApi } from '@/api/work-orders';
import { useOrderProgress } from '@/composables/useOrderProgress';
import type { OrderSummary } from '@/composables/useOrderProgress';
import { formatTime } from '@/utils/format';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const { formatOrdersList } = useOrderProgress();
const orders = ref<OrderSummary[]>([]);
const loading = ref(false);

const displayItems = computed(() => formatOrdersList(orders.value));

function progressWidth(status: string): string {
  const map: Record<string, string> = {
    ASSIGNED: '33%',
    IN_PROGRESS: '66%',
    COMPLETED: '100%',
  };
  return map[status] || '0%';
}

function accentColor(level: string): string {
  if (level === 'HIGH') return '#C4856B';
  if (level === 'MEDIUM') return '#C49B5E';
  return '#6E8A9A';
}

// AppTag 的 level 接受 'high'|'medium'|'low'，做一次映射
function levelToTag(level: string): 'high' | 'medium' | 'low' {
  if (level === 'HIGH') return 'high';
  if (level === 'MEDIUM') return 'medium';
  return 'low';
}

async function loadData() {
  loading.value = true;
  try {
    const res = await workOrdersApi.list({ elderId: auth.currentElderId });
    const data = (res as any)?.data?.data;
    if (data?.items) orders.value = data.items;
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
.page-state {
  display: flex;
  justify-content: center;
  padding: 80rpx 0;
}
.page-state__text {
  font-size: 28rpx;
  color: #9E9990;
}
.orders {
  padding-top: 8rpx;
}
.order {
  display: flex;
  flex-direction: column;
  gap: 20rpx;
}
.order__head {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.order__title {
  font-size: 30rpx;
  font-weight: 600;
  color: #2C2B29;
}
.order__progress {
  display: flex;
  flex-direction: column;
  gap: 8rpx;
}
.order__labels {
  display: flex;
  justify-content: space-between;
}
.order__label {
  font-size: 22rpx;
  color: #9E9990;
}
.order__track {
  height: 8rpx;
  border-radius: 9999rpx;
  background-color: #E8E3DA;
  overflow: hidden;
}
.order__fill {
  height: 100%;
  border-radius: 9999rpx;
  background-color: #6E8A9A;
  transition: width 0.3s;
}
.order__status {
  font-size: 24rpx;
  color: #6B6760;
  font-weight: 500;
}
.order__time {
  font-size: 22rpx;
  color: #9E9990;
}
</style>
