<template>
  <view class="page p-4">
    <view class="text-lg font-bold mb-4">工单进度</view>
    <view v-if="displayItems.length === 0" class="empty text-center py-10 text-gray-400">暂无进行中的工单</view>
    <view v-for="item in displayItems" :key="item.id" class="order-card mb-4 bg-white rounded-lg p-4 shadow-sm">
      <view class="flex-between mb-2"><view class="flex items-center gap-2"><wd-tag :type="item.level === 'HIGH' ? 'danger' : 'warning'" size="small">{{ item.level }}</wd-tag><text class="font-bold">{{ item.title }}</text></view></view>
      <view class="flex items-center gap-2 my-4">
        <view class="flex-1">
          <view class="flex-between mb-1"><text class="text-xs text-gray-400">已接单</text><text class="text-xs text-gray-400">处理中</text><text class="text-xs text-gray-400">已完成</text></view>
          <view class="flex items-center"><view class="h-2 rounded-full flex-1" :class="progressColor(item.status)"><view class="h-full rounded-full bg-blue-500" :style="{ width: progressWidth(item.status) }" /></view></view>
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
function progressWidth(status: string): string { const map: Record<string, string> = { ASSIGNED: '33%', IN_PROGRESS: '66%', COMPLETED: '100%' }; return map[status] || '0%'; }
function progressColor(status: string): string { return status === 'COMPLETED' ? 'bg-green-200' : 'bg-gray-200'; }
onMounted(() => { uni.request({ url: '/api/v1/work-orders', method: 'GET', header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, success: (res: any) => { if (res.data?.data?.items) orders.value = res.data.data.items; } }); });
</script>
