<template>
  <view class="page">
    <wd-tabs v-model="activeTab" @change="loadData"><wd-tab title="待处理" name="ASSIGNED" /><wd-tab title="进行中" name="IN_PROGRESS" /><wd-tab title="已完成" name="COMPLETED" /></wd-tabs>
    <view v-if="orders.length === 0" class="empty text-center py-10 text-gray-400">暂无工单</view>
    <view v-for="o in orders" :key="o.id" class="order-card m-3 p-4 bg-white rounded-lg shadow-sm" @click="goToDetail(o)">
      <view class="flex-between mb-2"><view class="flex items-center gap-2"><wd-tag :type="o.level === 'HIGH' ? 'danger' : 'warning'" size="small">{{ o.level }}</wd-tag><text class="font-bold">{{ o.elderName || o.elderId }}</text></view><text class="text-sm text-gray-400">{{ o.createdAt }}</text></view>
      <text class="text-sm text-gray-600">{{ TYPE_LABELS[o.type] || o.type }}</text>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { TYPE_LABELS } from '@/composables/useOrderProgress';
const activeTab = ref('ASSIGNED'); const orders = ref<any[]>([]);
function loadData() { uni.request({ url: '/api/v1/work-orders', data: { status: activeTab.value }, header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, success: (res: any) => { if (res.data?.data?.items) orders.value = res.data.data.items; } }); }
function goToDetail(o: any) { uni.navigateTo({ url: `/pagesWorker/work-order/detail?id=${o.id}` }); }
onMounted(() => { loadData(); });
</script>
