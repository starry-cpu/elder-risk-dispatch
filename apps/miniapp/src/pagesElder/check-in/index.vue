<template>
  <view class="page">
    <AppNavbar title="请求帮助" />

    <!-- 老人切换条（仅多老人时可点击） -->
    <view
      v-if="auth.elders.length > 1"
      class="elder-switch"
      @click="showElderPicker = true"
    >
      <text class="elder-switch__name">{{ auth.currentElder?.name || '未选择' }}</text>
      <text class="elder-switch__arrow">切换 ▾</text>
    </view>
    <view v-else-if="auth.currentElder" class="elder-switch elder-switch--single">
      <text class="elder-switch__name">{{ auth.currentElder.name }}</text>
    </view>

    <wd-action-sheet
      :model-value="showElderPicker"
      :actions="elderActions"
      title="选择老人"
      @select="onElderSelect"
      @close="showElderPicker = false"
    />

    <!-- 功能入口（SOS / 工单进度） -->
    <view class="entries">
      <view class="entry entry--danger" @click="goSos">
        <text class="entry__icon">🆘</text>
        <text class="entry__title">紧急求助</text>
      </view>
      <view class="entry entry--info" @click="goOrders">
        <text class="entry__icon">📋</text>
        <text class="entry__title">工单进度</text>
      </view>
    </view>

    <!-- 一键报平安：我很好 -->
    <view class="checkin-card checkin-card--ok" @click="submitCheckIn('ONE_TAP')">
      <text class="checkin-card__icon">🏠</text>
      <text class="checkin-card__title">我很好</text>
      <text class="checkin-card__hint">点此一键报平安</text>
    </view>

    <!-- 请求帮助：文字描述需求 → AI 分类派单 -->
    <view class="request">
      <text class="request__title">需要帮助？</text>
      <text class="request__subtitle">描述你的需求，系统会自动派单给有空的工作人员</text>
      <view class="request__field">
        <textarea
          v-model="requestText"
          class="request__textarea"
          placeholder="例如：水管坏了需要人修、需要陪同就医、需要代买药品..."
          :maxlength="500"
          auto-height
        />
      </view>
      <AppButton type="primary" size="full" :loading="submitting" @click="submitRequest">
        {{ submitting ? '正在分配工作人员...' : '提交需求' }}
      </AppButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onHide, onUnload } from '@dcloudio/uni-app';
import AppNavbar from '@/components/AppNavbar.vue';
import AppButton from '@/components/AppButton.vue';
import { useCheckIn } from '@/composables/useCheckIn';
import { checkInsApi } from '@/api/check-ins';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const { validate } = useCheckIn();
const requestText = ref('');
const submitting = ref(false);
const showElderPicker = ref(false);
// action 携带 id 以便重名老人也能精确选中（避免 first-match 选错）
const elderActions = computed(() =>
  auth.elders.map((e) => ({
    name: e.name,
    color: e.id === auth.currentElderId ? '#7A8B6E' : '#2C2B29',
    elderId: e.id,
  })),
);
function onElderSelect({ item }: { item: { name: string; elderId?: string } }) {
  const found = item.elderId
    ? auth.elders.find((e) => e.id === item.elderId)
    : auth.elders.find((e) => e.name === item.name);
  if (found) auth.setCurrentElder(found.id);
  showElderPicker.value = false;
}

// 一键报平安（保持原逻辑：method=ONE_TAP）
async function submitCheckIn(method: string) {
  const result = validate({
    elderId: auth.currentElderId,
    method,
  });
  if (!result.valid) {
    uni.showToast({ title: result.message || '请完善信息', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await checkInsApi.create({
      elderId: auth.currentElderId,
      method,
    });
    uni.showToast({ title: '已报平安 ✅' });
  } catch {
    uni.showToast({ title: '提交失败，请重试', icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

// 请求帮助：AI 分类 + 自动派单
async function submitRequest() {
  const text = requestText.value.trim();
  if (!auth.currentElderId) {
    uni.showToast({ title: '请先选择老人', icon: 'none' });
    return;
  }
  if (text.length < 2) {
    uni.showToast({ title: '请输入至少 2 个字符的需求描述', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    const res = await checkInsApi.createFamilyRequest({
      elderId: auth.currentElderId,
      text,
    });
    const data = (res as any)?.data?.data;
    const reason = data?.reason || '已提交';
    if (data?.dispatched) {
      uni.showToast({ title: `已派单：${reason}`, icon: 'none', duration: 3000 });
    } else {
      uni.showToast({ title: reason, icon: 'none', duration: 3000 });
    }
    requestText.value = '';
    // 跳到工单进度页让家属看进度
    setTimeout(() => {
      uni.navigateTo({ url: '/pagesElder/order-progress/index' });
    }, 1500);
  } catch {
    uni.showToast({ title: '提交失败，请重试', icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

function goSos() {
  uni.navigateTo({ url: '/pagesElder/sos/index' });
}
function goOrders() {
  uni.navigateTo({ url: '/pagesElder/order-progress/index' });
}

// 保留 onUnload/onHide 以备老人切换条等清理（本页已无录音资源）
onHide(() => {});
onUnload(() => {});
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 48rpx;
}
.elder-switch {
  margin: 16rpx 20rpx 0;
  background-color: #FEFDFB;
  border-radius: 12rpx;
  padding: 20rpx 24rpx;
  display: flex;
  justify-content: space-between;
  align-items: center;
  box-shadow: 0 1rpx 0 #E8E3DA;
}
.elder-switch--single { justify-content: center; }
.elder-switch__name { font-size: 28rpx; font-weight: 500; color: #2C2B29; }
.elder-switch__arrow { font-size: 24rpx; color: #6B6760; }

/* 功能入口（SOS / 工单进度） */
.entries {
  display: flex;
  gap: 16rpx;
  padding: 24rpx 20rpx 0;
}
.entry {
  flex: 1;
  background-color: #FEFDFB;
  border-radius: 12rpx;
  padding: 28rpx 16rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 1rpx 0 #E8E3DA;
}
.entry:active { filter: brightness(0.96); }
.entry--danger { background-color: #C4856B; }
.entry--info { background-color: #6E8A9A; }
.entry__icon { font-size: 44rpx; }
.entry__title { font-size: 26rpx; color: #FEFDFB; font-weight: 500; }

/* 一键报平安 */
.checkin-card {
  margin: 20rpx;
  background-color: #7A9A6E;
  border-radius: 12rpx;
  padding: 40rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 1rpx 0 #E8E3DA;
}
.checkin-card:active { filter: brightness(0.96); }
.checkin-card__icon { font-size: 64rpx; }
.checkin-card__title { font-size: 36rpx; font-weight: 600; color: #FEFDFB; }
.checkin-card__hint { font-size: 24rpx; color: #FEFDFB; opacity: 0.85; }

/* 请求帮助 */
.request {
  margin: 20rpx;
  background-color: #FEFDFB;
  border-radius: 12rpx;
  padding: 28rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-shadow: 0 1rpx 0 #E8E3DA;
}
.request__title { font-size: 32rpx; font-weight: 600; color: #2C2B29; }
.request__subtitle { font-size: 24rpx; color: #6B6760; }
.request__field {
  border-bottom: 1rpx solid #E8E3DA;
  padding-bottom: 12rpx;
}
.request__textarea {
  width: 100%;
  min-height: 160rpx;
  font-size: 28rpx;
  color: #2C2B29;
  line-height: 1.6;
}
</style>
