<template>
  <view class="page">
    <AppNavbar title="风险复核" />

    <view v-if="loading" class="page-state">
      <text class="page-state__text">加载中...</text>
    </view>

    <template v-else-if="event">
      <!-- 风险标题 -->
      <view class="review-header">
        <view class="review-header__top">
          <AppTag :level="event.level.toLowerCase()" />
          <text class="review-header__title">{{ event.reason || '风险事件' }}</text>
        </view>
      </view>

      <!-- 详情区 -->
      <view class="review-section">
        <view class="review-field">
          <text class="review-field__label">触发老人</text>
          <text class="review-field__value">{{ event.elderName }}</text>
        </view>
        <view class="review-field">
          <text class="review-field__label">风险评分</text>
          <text class="review-field__value">{{ event.score }} 分</text>
        </view>
        <view class="review-field">
          <text class="review-field__label">触发来源</text>
          <text class="review-field__value">{{ event.source }}</text>
        </view>
        <view class="review-field">
          <text class="review-field__label">触发时间</text>
          <text class="review-field__value">{{ formatTime(event.createdAt) }}</text>
        </view>
        <view v-if="event.reason" class="review-field">
          <text class="review-field__label">风险描述</text>
          <text class="review-field__value review-field__value--desc">{{ event.reason }}</text>
        </view>
      </view>

      <view class="review-divider">
        <text class="review-divider__text">复核备注</text>
      </view>

      <!-- 备注输入 -->
      <view class="review-textarea-wrap">
        <textarea
          v-model="note"
          class="review-textarea"
          :placeholder="event.level === 'HIGH' ? '高风险事件必须填写复核备注...' : '请记录您的复核意见...'"
          :maxlength="500"
          auto-height
        />
      </view>

      <!-- 操作按钮 -->
      <view class="review-actions">
        <AppButton type="primary" size="full" :loading="submitting" @click="handleConfirm">
          确认预警
        </AppButton>
        <AppButton type="text" size="full" @click="handleIgnore">
          忽略预警
        </AppButton>
      </view>
    </template>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppTag from '@/components/AppTag.vue';
import AppButton from '@/components/AppButton.vue';
import { riskApi } from '@/api/risk';
import { formatTime } from '@/utils/format';

const event = ref<any>(null);
const note = ref('');
const loading = ref(false);
const submitting = ref(false);

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
    const res = await riskApi.listEvents({});
    const data = (res as any)?.data?.data;
    const items = data?.items || [];
    event.value = items.find((e: any) => e.id === id) || null;
  } catch {
    uni.showToast({ title: '加载失败', icon: 'none' });
  } finally {
    loading.value = false;
  }
}

async function submitReview(status: string) {
  if (!event.value) return;
  if (event.value.level === 'HIGH' && !note.value.trim()) {
    uni.showToast({ title: '高风险事件必须填写复核备注', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await riskApi.review(event.value.id, { status, note: note.value });
    uni.showToast({ title: status === 'CONFIRMED' ? '已确认' : '已忽略' });
    setTimeout(() => uni.navigateBack(), 1000);
  } catch {
    // client interceptor already shows toast
  } finally {
    submitting.value = false;
  }
}

function handleConfirm() { submitReview('CONFIRMED'); }
function handleIgnore() { submitReview('IGNORED'); }

onMounted(() => { loadDetail(); });
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 48rpx;
}
.review-header {
  padding: 32rpx 20rpx 0;
}
.review-header__top {
  display: flex;
  align-items: center;
  gap: 12rpx;
}
.review-header__title {
  font-size: 36rpx;
  font-weight: 600;
  color: #2C2B29;
}
.review-section {
  margin: 24rpx 20rpx;
  padding: 0;
}
.review-field {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  padding: 14rpx 0;
}
.review-field + .review-field {
  border-top: 1rpx solid #F0ECE5;
}
.review-field__label {
  width: 160rpx;
  flex-shrink: 0;
  font-size: 28rpx;
  color: #9E9990;
}
.review-field__value {
  flex: 1;
  font-size: 28rpx;
  color: #2C2B29;
}
.review-field__value--desc {
  line-height: 1.8;
}
.review-divider {
  padding: 0 20rpx;
  margin: 16rpx 0;
}
.review-divider__text {
  font-size: 22rpx;
  color: #9E9990;
}
.review-textarea-wrap {
  margin: 0 20rpx;
  padding: 20rpx 0;
  border-bottom: 1rpx solid #E8E3DA;
}
.review-textarea {
  width: 100%;
  min-height: 200rpx;
  font-size: 28rpx;
  color: #2C2B29;
  line-height: 1.6;
  background: transparent;
}
.review-actions {
  padding: 48rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
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
