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

      <view v-if="voiceUrl" class="sos-sent">
        <text class="sos-sent__title">求助已发送!</text>
        <text class="sos-sent__hint">工作人员将尽快响应</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppNavbar from '@/components/AppNavbar.vue';
import { useSosVoice } from '@/composables/useSosVoice';
import { checkInsApi } from '@/api/check-ins';

const { isRecording, duration, voiceUrl, maxDuration, startRecording, stopRecording, setVoiceUrl } = useSosVoice();

function handleTouchStart() {
  startRecording();
}

function handleTouchEnd() {
  stopRecording();
  if (duration.value < 1) {
    uni.showToast({ title: '录音时间太短', icon: 'none' });
    return;
  }
  // TODO: Replace with real voice recording via uni.getRecorderManager() to capture audio,
  // then wx.uploadFile() to upload to the server and get back a real voiceUrl.
  // Currently uses a placeholder URL — backend will receive unusable data.
  const tempUrl = 'recorded_audio_' + Date.now();
  setVoiceUrl(tempUrl);
  const elderId = uni.getStorageSync('elderId') || '';
  checkInsApi.create({
    elderId,
    method: 'VOICE',
    content: '语音求助',
    voiceUrl: tempUrl,
  }).then(() => {
    uni.showToast({ title: '求助已发出' });
  }).catch(() => {
    // client interceptor already shows toast
  });
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
.sos-sent__hint {
  font-size: 24rpx;
  color: #6B6760;
}
@keyframes sos-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(196, 112, 107, 0.4); }
  50% { box-shadow: 0 0 0 20px rgba(196, 112, 107, 0); }
}
</style>
