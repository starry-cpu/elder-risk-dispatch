<template>
  <view class="page">
    <AppNavbar title="语音求助" />

    <!-- 老人切换条（多老人可切换，单老人仅显示名字以便确认） -->
    <view
      v-if="auth.elders.length > 1"
      class="elder-switch"
      @click="showElderPicker = true"
    >
      <text class="elder-switch__name">{{ auth.currentElder?.name || '未选择' }}</text>
      <text class="elder-switch__arrow">切换 ▾</text>
    </view>
    <view v-else-if="auth.currentElder" class="elder-switch elder-switch--single">
      <text class="elder-switch__name">为 {{ auth.currentElder.name }} 求助</text>
    </view>

    <wd-action-sheet
      :model-value="showElderPicker"
      :actions="elderActions"
      title="选择老人"
      @select="onElderSelect"
      @close="showElderPicker = false"
    />

    <view class="sos">
      <text class="sos__hint">长按按钮录音，松开发送求助</text>

      <view
        class="sos-btn"
        :class="{ 'sos-btn--recording': isRecording }"
        @touchstart="handleTouchStart"
        @touchend="handleTouchEnd"
      >
        <text class="sos-btn__icon">{{ isRecording ? '🔴' : '🆘' }}</text>
        <text class="sos-btn__title">{{ isRecording ? '松开发送' : '长按求助' }}</text>
        <text v-if="isRecording" class="sos-btn__time">{{ duration }}s / {{ maxDuration }}s</text>
      </view>

      <view v-if="uploading" class="sos-sent sos-sent--info">
        <text class="sos-sent__title sos-sent__title--info">发送中...</text>
        <text class="sos-sent__hint">正在上传语音求助</text>
      </view>
      <view v-else-if="sent" class="sos-sent">
        <text class="sos-sent__title">求助已发送!</text>
        <text class="sos-sent__hint">工作人员将尽快响应</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';
import { onHide, onUnload } from '@dcloudio/uni-app';
import AppNavbar from '@/components/AppNavbar.vue';
import { useSosVoice } from '@/composables/useSosVoice';
import { checkInsApi } from '@/api/check-ins';
import { uploadApi } from '@/api/upload';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const { isRecording, duration, maxDuration, recordedFilePath, startRecording, stopRecording, dispose: disposeRecorder } = useSosVoice();
const uploading = ref(false);
const sent = ref(false);
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

function handleTouchStart() {
  // 重新录音时清除上一次的"已发送"状态
  sent.value = false;
  startRecording();
}

function handleTouchEnd() {
  stopRecording();
  if (duration.value < 1) {
    uni.showToast({ title: '录音时间太短', icon: 'none' });
    return;
  }
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
        content: '语音求助',
        voiceUrl: url,
      });
      sent.value = true;
      uni.showToast({ title: '求助已发出' });
    } catch {
      uni.showToast({ title: '求助发送失败，请重试', icon: 'none' });
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
.sos {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 64rpx 48rpx;
  gap: 48rpx;
}
.sos__hint {
  font-size: 28rpx;
  color: #6B6760;
}
.sos-btn {
  width: 320rpx;
  height: 320rpx;
  border-radius: 9999rpx;
  background-color: #C4706B;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12rpx;
  transition: transform 0.1s, box-shadow 0.1s;
}
.sos-btn:active {
  transform: scale(0.95);
}
.sos-btn--recording {
  animation: sos-pulse 1s infinite;
}
.sos-btn__icon {
  font-size: 80rpx;
}
.sos-btn__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #FEFDFB;
}
.sos-btn__time {
  font-size: 24rpx;
  color: #FEFDFB;
}
.sos-sent {
  background-color: #FEFDFB;
  border-radius: 12rpx;
  padding: 32rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  width: 100%;
  box-shadow: 0 1rpx 0 #E8E3DA;
}
.sos-sent__title {
  font-size: 32rpx;
  font-weight: 600;
  color: #7A9A6E;
}
.sos-sent__title--info {
  color: #6B6760;
}
.sos-sent__hint {
  font-size: 24rpx;
  color: #6B6760;
}
@keyframes sos-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(196, 112, 107, 0.4); }
  50% { box-shadow: 0 0 0 20px rgba(196, 112, 107, 0); }
}
</style>
