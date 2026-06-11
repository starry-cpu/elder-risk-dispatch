<template>
  <view class="page p-4">
    <view v-if="event" class="space-y-4">
      <view class="bg-white rounded-lg p-4 shadow-sm">
        <view class="flex-between mb-3">
          <text class="text-lg font-bold">{{ event.elderName }}</text>
          <wd-tag :type="event.level === 'HIGH' ? 'danger' : 'warning'" size="small">{{ event.level === 'HIGH' ? '高风险' : event.level === 'MEDIUM' ? '中风险' : '低风险' }}</wd-tag>
        </view>
        <view class="text-sm text-gray-600 space-y-2"><view>来源: {{ event.source }}</view><view>分数: {{ event.score }}</view><view>原因: {{ event.reason }}</view><view>时间: {{ event.createdAt }}</view></view>
      </view>
      <view class="bg-white rounded-lg p-4 shadow-sm"><view class="text-sm font-medium mb-3">复核备注</view><wd-textarea v-model="note" :rows="3" placeholder="请填写复核备注（高风险必填）" /></view>
      <view class="flex gap-3"><wd-button type="primary" block @click="handleConfirm">确认预警</wd-button><wd-button type="danger" plain block @click="handleIgnore">忽略预警</wd-button></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref, onMounted } from 'vue';
const note = ref(''); const event = ref<any>(null);
onMounted(() => { const pages = getCurrentPages(); const id = (pages[pages.length - 1] as any)?.options?.id; if (id) { uni.request({ url: `/api/v1/risk/events?id=${id}`, header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, success: (res: any) => { if (res.data?.data?.items?.[0]) event.value = res.data.data.items[0]; } }); } });
function submitReview(status: string) { if (!event.value) return; if (event.value.level === 'HIGH' && !note.value.trim()) { uni.showToast({ title: '高风险事件必须填写复核备注', icon: 'none' }); return; } uni.request({ url: `/api/v1/risk/events/${event.value.id}/review`, method: 'POST', data: { status, note: note.value }, header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, success: () => { uni.showToast({ title: status === 'CONFIRMED' ? '已确认' : '已忽略' }); setTimeout(() => uni.navigateBack(), 1000); } }); }
function handleConfirm() { submitReview('CONFIRMED'); }
function handleIgnore() { submitReview('IGNORED'); }
</script>
