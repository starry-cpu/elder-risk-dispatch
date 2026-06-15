<template>
  <view class="page">
    <AppNavbar title="风险待办" />

    <!-- 筛选栏：wd-picker 没有外部 show/visible prop，需通过暴露的 open() 打开 -->
    <view class="filter-bar" @click="openPicker">
      <text class="filter-bar__label">{{ statusLabel }}</text>
      <text class="filter-bar__arrow">▾</text>
    </view>

    <!-- 加载态 -->
    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <AppEmpty
      v-else-if="sortedItems.length === 0"
      message="暂无待处理风险"
      hint="所有风险事件已处理完毕"
    />

    <!-- 列表 -->
    <view v-else>
      <AppCard
        v-for="item in sortedItems"
        :key="item.id"
        :accent-color="accentColor(item.level)"
        clickable
        @click="goToReview(item)"
      >
        <view class="risk-row">
          <view class="risk-row__main">
            <view class="risk-row__top">
              <AppStatusDot :status="item.level.toLowerCase()" :size="12" />
              <AppTag :level="item.level.toLowerCase() as any" />
              <text class="risk-row__reason">{{ item.reason }}</text>
            </view>
            <text class="risk-row__elder">{{ item.elderName }}</text>
          </view>
          <view class="risk-row__side">
            <text class="risk-row__time">{{ formatTime(item.createdAt) }}</text>
            <AppButton type="secondary" size="compact" @click.stop="goToReview(item)">
              去处理
            </AppButton>
          </view>
        </view>
      </AppCard>

      <view class="page-end">
        <text class="page-end__text">已加载全部</text>
      </view>
    </view>

    <!-- 筛选 Picker：通过 ref 暴露的 open() 控制 -->
    <wd-picker
      ref="pickerRef"
      :columns="[statusColumns]"
      :model-value="[statusFilter]"
      @confirm="onPickerConfirm"
    />
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppCard from '@/components/AppCard.vue';
import AppStatusDot from '@/components/AppStatusDot.vue';
import AppTag from '@/components/AppTag.vue';
import AppButton from '@/components/AppButton.vue';
import AppEmpty from '@/components/AppEmpty.vue';
import { riskApi } from '@/api/risk';
import { useRiskTaskList } from '@/composables/useRiskTaskList';
import type { RiskTaskItem } from '@/composables/useRiskTaskList';
import { formatTime } from '@/utils/format';

const { sortItems, filterByStatus } = useRiskTaskList();

const items = ref<RiskTaskItem[]>([]);
const statusFilter = ref('');
const loading = ref(false);
// wd-picker 通过 defineExpose 暴露 open()/close()；无外部 show/visible prop
const pickerRef = ref<{ open: () => void; close: () => void } | null>(null);

const statusColumns = [
  { value: '', label: '全部' },
  { value: 'PENDING_REVIEW', label: '待复核' },
  { value: 'CONFIRMED', label: '已确认' },
  { value: 'IGNORED', label: '已忽略' },
];

const statusLabel = computed(() => {
  const found = statusColumns.find(c => c.value === statusFilter.value);
  return found ? found.label : '全部';
});

const sortedItems = computed(() => {
  const filtered = filterByStatus(items.value, statusFilter.value);
  return sortItems(filtered);
});

function accentColor(level: string): string {
  if (level === 'HIGH') return '#C4856B';
  if (level === 'MEDIUM') return '#C49B5E';
  return '#6E8A9A';
}

function openPicker() {
  pickerRef.value?.open();
}

function onPickerConfirm(e: { value: string[] }) {
  statusFilter.value = e.value[0];
  loadData();
}

async function loadData() {
  loading.value = true;
  try {
    const res = await riskApi.listEvents({ status: statusFilter.value || undefined });
    const data = (res as any)?.data?.data;
    if (data?.items) items.value = data.items;
  } catch {
    uni.showToast({ title: '加载失败，下拉重试', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goToReview(item: RiskTaskItem) {
  uni.navigateTo({ url: `/pagesWorker/risk-tasks/review?id=${item.id}` });
}

onMounted(() => {
  loadData();
});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 48rpx;
}
.filter-bar {
  display: flex;
  align-items: center;
  gap: 8rpx;
  padding: 16rpx 20rpx;
}
.filter-bar__label {
  font-size: 28rpx;
  color: #2C2B29;
  font-weight: 500;
}
.filter-bar__arrow {
  font-size: 22rpx;
  color: #6B6760;
}
.risk-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.risk-row__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}
.risk-row__top {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.risk-row__reason {
  font-size: 28rpx;
  font-weight: 500;
  color: #2C2B29;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.risk-row__elder {
  font-size: 24rpx;
  color: #6B6760;
}
.risk-row__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}
.risk-row__time {
  font-size: 22rpx;
  color: #9E9990;
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
