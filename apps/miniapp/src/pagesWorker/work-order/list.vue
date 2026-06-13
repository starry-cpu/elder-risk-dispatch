<template>
  <view class="page">
    <AppNavbar title="工单列表" />

    <!-- Tab 切换 -->
    <wd-tabs v-model="activeTab" @change="loadData">
      <wd-tab title="待处理" name="ASSIGNED" />
      <wd-tab title="进行中" name="IN_PROGRESS" />
      <wd-tab title="已完成" name="COMPLETED" />
    </wd-tabs>

    <!-- 加载态 -->
    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <!-- 空状态 -->
    <AppEmpty
      v-else-if="orders.length === 0"
      :message="emptyMessage"
      hint="下拉刷新试试"
    />

    <!-- 列表 -->
    <template v-else>
      <AppCard
        v-for="o in orders"
        :key="o.id"
        :accent-color="statusColor(o.status)"
        clickable
        @click="goToDetail(o)"
      >
        <view class="order-row">
          <view class="order-row__main">
            <view class="order-row__top">
              <AppStatusDot :status="statusDotType(o.status)" :size="12" />
              <text class="order-row__title">
                {{ TYPE_LABELS[o.type] || o.type }}
                <text class="order-row__elder"> · {{ o.elderName || o.elderId }}</text>
              </text>
            </view>
            <text class="order-row__meta">
              优先级：{{ o.level }}
            </text>
          </view>
          <view class="order-row__side">
            <text class="order-row__time">
              {{ formatTime(activeTab === 'COMPLETED' ? (o.completedAt || o.createdAt) : o.createdAt) }}
            </text>
            <AppButton
              :type="activeTab === 'COMPLETED' ? 'secondary' : 'primary'"
              size="compact"
              @click.stop="goToDetail(o)"
            >
              {{ actionLabel }}
            </AppButton>
          </view>
        </view>
      </AppCard>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppCard from '@/components/AppCard.vue';
import AppStatusDot from '@/components/AppStatusDot.vue';
import AppButton from '@/components/AppButton.vue';
import AppEmpty from '@/components/AppEmpty.vue';
import { workOrdersApi } from '@/api/work-orders';
import { TYPE_LABELS } from '@/composables/useOrderProgress';
import { formatTime } from '@/utils/format';

const activeTab = ref('ASSIGNED');
const orders = ref<any[]>([]);
const loading = ref(false);

const actionLabel = computed(() => {
  if (activeTab.value === 'ASSIGNED') return '开始处理';
  if (activeTab.value === 'IN_PROGRESS') return '继续处理';
  return '查看详情';
});

const emptyMessage = computed(() => {
  if (activeTab.value === 'ASSIGNED') return '暂无待处理工单';
  if (activeTab.value === 'IN_PROGRESS') return '暂无进行中工单';
  return '暂无已完成工单';
});

function statusColor(status: string): string {
  if (status === 'ASSIGNED') return '#C49B5E';
  if (status === 'IN_PROGRESS') return '#6E8A9A';
  return '#7A9A6E';
}

function statusDotType(status: string): string {
  if (status === 'ASSIGNED') return 'warning';
  if (status === 'IN_PROGRESS') return 'info';
  return 'success';
}

async function loadData() {
  loading.value = true;
  try {
    const res = await workOrdersApi.list({ status: activeTab.value });
    const data = (res as any)?.data?.data;
    if (data?.items) orders.value = data.items;
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

function goToDetail(o: any) {
  uni.navigateTo({ url: `/pagesWorker/work-order/detail?id=${o.id}` });
}

onMounted(() => { loadData(); });
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 48rpx;
}
.order-row {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
}
.order-row__main {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8rpx;
  min-width: 0;
}
.order-row__top {
  display: flex;
  align-items: center;
  gap: 8rpx;
}
.order-row__title {
  font-size: 28rpx;
  font-weight: 500;
  color: #2C2B29;
}
.order-row__elder {
  font-weight: 400;
  color: #6B6760;
}
.order-row__meta {
  font-size: 24rpx;
  color: #6B6760;
}
.order-row__side {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 8rpx;
  flex-shrink: 0;
}
.order-row__time {
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
</style>
