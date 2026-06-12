<template>
  <view class="page">
    <view class="filter-bar flex gap-2 p-3">
      <wd-picker :columns="[{ values: ['', 'PENDING_REVIEW', 'CONFIRMED', 'IGNORED'] }]" @confirm="(e: { value: string[] }) => { statusFilter = e.value[0]; loadData() }">
        <wd-button size="small">状态筛选</wd-button>
      </wd-picker>
    </view>
    <view v-if="sortedItems.length === 0" class="empty text-center py-10 text-gray-400">暂无待处理预警</view>
    <view v-for="item in sortedItems" :key="item.id" class="risk-card m-3 p-4 bg-white rounded-lg shadow-sm" @click="goToReview(item)">
      <view class="flex-between mb-2">
        <view class="flex items-center gap-2">
          <wd-tag :type="item.level === 'HIGH' ? 'danger' : 'warning'" size="small">{{ item.level === 'HIGH' ? '高风险' : item.level === 'MEDIUM' ? '中风险' : '低风险' }}</wd-tag>
          <text class="font-bold">{{ item.elderName }}</text>
        </view>
        <text class="text-gray-400 text-sm">{{ item.createdAt }}</text>
      </view>
      <text class="text-sm text-gray-600">{{ item.reason }}</text>
      <view class="flex-between mt-2"><text class="text-xs text-gray-400">来源: {{ item.source }} | 分数: {{ item.score }}</text><wd-icon name="arrow-right" size="16" /></view>
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
const sortedItems = computed(() => { const filtered = filterByStatus(items.value, statusFilter.value); return sortItems(filtered); });
function loadData() { uni.showLoading({ title: '加载中...' }); uni.request({ url: '/api/v1/risk/events', method: 'GET', data: { status: statusFilter.value || undefined }, header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, success: (res: any) => { if (res.data?.code === 0) items.value = res.data.data.items; }, complete: () => uni.hideLoading() }); }
function goToReview(item: RiskTaskItem) { uni.navigateTo({ url: `/pagesWorker/risk-tasks/review?id=${item.id}` }); }
onMounted(() => { loadData(); });
</script>
