<template>
  <view class="page">
    <AppNavbar title="一键报平安" />

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

    <view class="checkin">
      <!-- 一键报平安 -->
      <view class="checkin-card checkin-card--primary" @click="submitCheckIn('ONE_TAP')">
        <text class="checkin-card__icon">🏠</text>
        <text class="checkin-card__title">我很好</text>
        <text class="checkin-card__hint">点此一键报平安</text>
      </view>

      <!-- 长按语音报平安 -->
      <view
        class="checkin-card checkin-card--info"
        :class="{ 'checkin-card--recording': isRecording }"
        @touchstart="startVoice"
        @touchend="stopVoice"
      >
        <text class="checkin-card__icon">{{ isRecording ? '🔴' : '🎤' }}</text>
        <text class="checkin-card__title">{{ uploading ? '发送中...' : (isRecording ? '松开发送' : '长按语音报平安') }}</text>
        <text v-if="uploading" class="checkin-card__hint">正在上传语音</text>
        <text v-else-if="isRecording" class="checkin-card__hint">{{ duration }}s</text>
        <text v-else class="checkin-card__hint">按住说话</text>
      </view>

      <!-- 文字报平安 -->
      <view class="checkin-text">
        <view class="checkin-text__field">
          <textarea
            v-model="textContent"
            class="checkin-text__textarea"
            placeholder="或在这里输入报平安信息..."
            :maxlength="500"
            auto-height
          />
        </view>
        <AppButton type="primary" size="full" :loading="submitting" @click="submitCheckIn('TEXT')">
          文字提交
        </AppButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onHide, onUnload } from '@dcloudio/uni-app';
import AppNavbar from '@/components/AppNavbar.vue';
import AppButton from '@/components/AppButton.vue';
import { useCheckIn } from '@/composables/useCheckIn';
import { useSosVoice } from '@/composables/useSosVoice';
import { checkInsApi } from '@/api/check-ins';
import { uploadApi } from '@/api/upload';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const { validate } = useCheckIn();
const { isRecording, duration, recordedFilePath, startRecording, stopRecording, dispose: disposeRecorder } = useSosVoice();
const textContent = ref('');
const submitting = ref(false);
const uploading = ref(false);
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
  // 优先按 id 精确匹配；兜底回退到 name（兼容老组件只回传 name 的情况）
  const found = item.elderId
    ? auth.elders.find((e) => e.id === item.elderId)
    : auth.elders.find((e) => e.name === item.name);
  if (found) auth.setCurrentElder(found.id);
  showElderPicker.value = false;
}

async function submitCheckIn(method: string) {
  const result = validate({
    elderId: auth.currentElderId,
    method,
    content: method === 'TEXT' ? textContent.value : undefined,
    voiceUrl: undefined,
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
      content: method === 'TEXT' ? textContent.value : undefined,
    });
    uni.showToast({ title: '已报平安 ✅' });
    textContent.value = '';
  } catch {
    uni.showToast({ title: '提交失败，请重试', icon: 'none' });
  } finally {
    submitting.value = false;
  }
}

function startVoice() {
  startRecording();
}

function stopVoice() {
  stopRecording();
  if (duration.value < 1) {
    uni.showToast({ title: '录音时间太短', icon: 'none' });
    return;
  }
  // 等 onStop 回调写入 recordedFilePath（下一 tick）
  uploading.value = true;
  setTimeout(async () => {
    const filePath = recordedFilePath.value;
    if (!filePath) {
      uni.showToast({ title: '录音失败，请重试', icon: 'none' });
      uploading.value = false;
      return;
    }
    try {
      const { url } = await uploadApi.uploadAudio(filePath);
      await checkInsApi.create({
        elderId: auth.currentElderId,
        method: 'VOICE',
        content: '语音报平安',
        voiceUrl: url,
      });
      uni.showToast({ title: '已报平安 ✅' });
    } catch {
      uni.showToast({ title: '语音提交失败，请重试', icon: 'none' });
    } finally {
      uploading.value = false;
    }
  }, 200);
}

// 离开页面（切后台/返回/跳转）时停掉录音与计时器，
// 否则全局 RecorderManager 会话与 setInterval 会跨页面泄漏。
onHide(disposeRecorder);
onUnload(disposeRecorder);
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
.checkin {
  padding: 32rpx 20rpx;
  display: flex;
  flex-direction: column;
  gap: 24rpx;
}
.checkin-card {
  background-color: #FEFDFB;
  border-radius: 12rpx;
  padding: 48rpx 20rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 1rpx 0 #E8E3DA;
  transition: filter 0.15s;
}
.checkin-card:active {
  filter: brightness(0.96);
}
.checkin-card--primary {
  background-color: #7A9A6E;
}
.checkin-card--info {
  background-color: #6E8A9A;
}
.checkin-card--recording {
  filter: brightness(0.92);
}
.checkin-card__icon {
  font-size: 64rpx;
}
.checkin-card__title {
  font-size: 36rpx;
  font-weight: 600;
  color: #FEFDFB;
}
.checkin-card__hint {
  font-size: 24rpx;
  color: #FEFDFB;
  opacity: 0.85;
}
.checkin-text {
  background-color: #FEFDFB;
  border-radius: 12rpx;
  padding: 20rpx;
  display: flex;
  flex-direction: column;
  gap: 16rpx;
  box-shadow: 0 1rpx 0 #E8E3DA;
}
.checkin-text__field {
  border-bottom: 1rpx solid #E8E3DA;
  padding-bottom: 12rpx;
}
.checkin-text__textarea {
  width: 100%;
  min-height: 120rpx;
  font-size: 28rpx;
  color: #2C2B29;
  line-height: 1.6;
}
</style>
