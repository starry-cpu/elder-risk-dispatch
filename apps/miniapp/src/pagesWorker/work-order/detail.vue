<template>
  <view class="page">
    <AppNavbar title="工单详情" />

    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <template v-else-if="order">
      <!-- 状态指示 -->
      <view class="detail-header">
        <view class="detail-header__status">
          <AppStatusDot :status="statusDotType(order.status)" :size="14" />
          <text class="detail-header__status-text">
            {{ STATUS_LABELS[order.status] || order.status }}
          </text>
        </view>
        <text class="detail-header__title">
          {{ TYPE_LABELS[order.type] || order.type }}
        </text>
      </view>

      <!-- 信息区 -->
      <view class="detail-section">
        <view class="detail-field">
          <text class="detail-field__label">关联老人</text>
          <text class="detail-field__value">{{ order.elderName || order.elderId }}</text>
        </view>
        <view class="detail-field">
          <text class="detail-field__label">优先级</text>
          <text class="detail-field__value">{{ order.level }}</text>
        </view>
        <view v-if="order.assigneeName" class="detail-field">
          <text class="detail-field__label">负责人</text>
          <text class="detail-field__value">{{ order.assigneeName }}</text>
        </view>
        <view class="detail-field">
          <text class="detail-field__label">创建时间</text>
          <text class="detail-field__value">{{ formatTime(order.createdAt) }}</text>
        </view>
        <view v-if="order.startedAt" class="detail-field">
          <text class="detail-field__label">开始时间</text>
          <text class="detail-field__value">{{ formatTime(order.startedAt) }}</text>
        </view>
      </view>

      <view class="detail-divider">
        <text class="detail-divider__text">处理记录</text>
      </view>

      <!-- 时间线 -->
      <view v-if="timeline.length > 0" class="detail-timeline">
        <wd-timeline>
          <wd-timeline-item
            v-for="t in timeline"
            :key="t.id"
            :title="t.action"
            :content="t.note || ''"
            :time="formatTime(t.createdAt)"
          />
        </wd-timeline>
      </view>

      <!-- 操作按钮区（固定底部） -->
      <view v-if="availableActions.length > 0" class="detail-footer">
        <AppButton
          v-for="action in availableActions"
          :key="action"
          :type="action === 'START' ? 'primary' : 'primary'"
          size="full"
          @click="handleAction(action)"
        >
          {{ action === 'START' ? '开始处理' : action === 'COMPLETE' ? '完成处理' : action }}
        </AppButton>
        <AppButton
          v-if="showCancel"
          type="text"
          size="full"
          @click="handleCancel"
        >
          取消工单
        </AppButton>
      </view>
    </template>

    <!-- 完成弹窗 -->
    <wd-message-box v-model="resultDialogVisible" title="填写处理结果">
      <textarea
        v-model="resultText"
        style="width: 100%; min-height: 160rpx; font-size: 28rpx; padding: 12rpx 0;"
        placeholder="请描述处理结果..."
      />
      <template #footer>
        <AppButton size="compact" type="text" @click="resultDialogVisible = false">
          取消
        </AppButton>
        <AppButton size="compact" type="primary" @click="submitResult">
          确认
        </AppButton>
      </template>
    </wd-message-box>
  </view>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppStatusDot from '@/components/AppStatusDot.vue';
import AppButton from '@/components/AppButton.vue';
import { workOrdersApi } from '@/api/work-orders';
import { useWorkOrderFlow } from '@/composables/useWorkOrderFlow';
import { TYPE_LABELS, STATUS_LABELS } from '@/composables/useOrderProgress';

const { getAvailableActions, validateCompletion } = useWorkOrderFlow();

const order = ref<any>(null);
const timeline = ref<any[]>([]);
const resultText = ref('');
const resultDialogVisible = ref(false);
const loading = ref(false);

const availableActions = computed(() =>
  order.value ? getAvailableActions(order.value.status) : []
);

const showCancel = computed(() =>
  order.value?.status === 'ASSIGNED' || order.value?.status === 'IN_PROGRESS'
);

function statusDotType(status: string): string {
  if (status === 'ASSIGNED') return 'warning';
  if (status === 'IN_PROGRESS') return 'info';
  if (status === 'COMPLETED') return 'success';
  return 'info';
}

function formatTime(dateStr: string): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hour = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${month}-${day} ${hour}:${min}`;
}

async function loadDetail() {
  const pages = getCurrentPages();
  const current = pages[pages.length - 1] as any;
  const id = current?.options?.id;
  if (!id) {
    uni.showToast({ title: '参数错误', icon: 'none' });
    return;
  }
  loading.value = true;
  try {
    const [detailRes, timelineRes] = await Promise.all([
      workOrdersApi.getById(id),
      workOrdersApi.getTimeline(id),
    ]);
    const detailData = (detailRes as any)?.data?.data;
    if (detailData) order.value = detailData;
    const timelineData = (timelineRes as any)?.data?.data;
    if (timelineData) timeline.value = Array.isArray(timelineData) ? timelineData : [];
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function handleAction(action: string) {
  if (action === 'COMPLETE') {
    resultDialogVisible.value = true;
    return;
  }
  if (!order.value) return;
  try {
    if (action === 'START') {
      await workOrdersApi.start(order.value.id);
    } else {
      uni.showToast({ title: `不支持的操作: ${action}`, icon: 'none' });
      return;
    }
    uni.showToast({ title: '操作成功' });
    loadDetail();
  } catch {
    // client interceptor already shows toast
  }
}

async function submitResult() {
  if (!order.value) return;
  const validation = validateCompletion(resultText.value);
  if (!validation.valid) {
    uni.showToast({ title: validation.message || '请填写处理结果', icon: 'none' });
    return;
  }
  try {
    await workOrdersApi.complete(order.value.id, { result: resultText.value });
    uni.showToast({ title: '已完成' });
    resultDialogVisible.value = false;
    loadDetail();
  } catch {
    // client interceptor already shows toast
  }
}

async function handleCancel() {
  if (!order.value) return;
  try {
    await workOrdersApi.cancel(order.value.id);
    uni.showToast({ title: '已取消' });
    loadDetail();
  } catch {
    // client interceptor already shows toast
  }
}

onMounted(() => { loadDetail(); });
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 160rpx;
}
.detail-header {
  padding: 32rpx 20rpx 0;
}
.detail-header__status {
  display: flex;
  align-items: center;
  gap: 8rpx;
  margin-bottom: 12rpx;
}
.detail-header__status-text {
  font-size: 28rpx;
  color: #6B6760;
}
.detail-header__title {
  font-size: 36rpx;
  font-weight: 600;
  color: #2C2B29;
}
.detail-section {
  margin: 24rpx 20rpx;
  padding: 0;
}
.detail-field {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 14rpx 0;
}
.detail-field + .detail-field {
  border-top: 1rpx solid #F0ECE5;
}
.detail-field__label {
  width: 160rpx;
  flex-shrink: 0;
  font-size: 28rpx;
  color: #9E9990;
}
.detail-field__value {
  flex: 1;
  font-size: 28rpx;
  color: #2C2B29;
}
.detail-divider {
  padding: 0 20rpx;
  margin: 16rpx 0;
}
.detail-divider__text {
  font-size: 22rpx;
  color: #9E9990;
}
.detail-timeline {
  margin: 0 20rpx;
}
.detail-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #F7F3ED;
  display: flex;
  flex-direction: column;
  gap: 12rpx;
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
