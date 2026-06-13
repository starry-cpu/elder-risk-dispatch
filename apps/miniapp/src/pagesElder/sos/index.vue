<template>
  <view class="page">
    <AppNavbar title="语音求助" />

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
import { ref } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import { useSosVoice } from '@/composables/useSosVoice';
import { checkInsApi } from '@/api/check-ins';
import { uploadApi } from '@/api/upload';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const { isRecording, duration, maxDuration, recordedFilePath, startRecording, stopRecording } = useSosVoice();
const uploading = ref(false);
const sent = ref(false);

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
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 48rpx;
}
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
