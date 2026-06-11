<template>
  <view class="page">
    <view v-if="records.length === 0" class="empty text-center py-10 text-gray-400">暂无巡访记录</view>
    <view v-for="r in records" :key="r.id" class="record-card m-3 p-4 bg-white rounded-lg shadow-sm">
      <view class="flex-between mb-2"><text class="font-bold">{{ r.elderName || r.elderId }}</text><text class="text-sm text-gray-400">{{ r.visitTime }}</text></view>
      <text class="text-sm text-gray-600">{{ r.observation }}</text>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
const records = ref<any[]>([]);
onMounted(() => { uni.request({ url: '/api/v1/visits', header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, success: (res: any) => { if (res.data?.data?.items) records.value = res.data.data.items; } }); });
</script>
