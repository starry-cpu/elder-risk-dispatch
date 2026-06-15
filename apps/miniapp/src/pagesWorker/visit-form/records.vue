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
import { formatTime } from '@/utils/format';

const records = ref<any[]>([]);
const loading = ref(false);

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
