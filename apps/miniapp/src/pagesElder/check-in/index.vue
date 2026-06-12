<template>
  <view class="page flex flex-col items-center justify-center min-h-screen px-6 space-y-8">
    <text class="text-xl font-bold">一键报平安</text>
    <view class="w-full space-y-4">
      <view class="checkin-btn bg-green-500 text-white rounded-2xl py-8 flex-center text-center active:opacity-80" @click="submitCheckIn('ONE_TAP')">
        <view><text class="text-4xl">🏠</text><view class="text-xl font-bold mt-2">我很好</view><view class="text-sm opacity-80">点此一键报平安</view></view>
      </view>
      <view class="checkin-btn bg-blue-500 text-white rounded-2xl py-6 flex-center text-center active:opacity-80" @touchstart="startVoice" @touchend="stopVoice">
        <view><text class="text-3xl">{{ isRecording ? '🔴' : '🎤' }}</text><view class="text-lg font-bold mt-1">{{ isRecording ? '松开发送' : '长按语音报平安' }}</view><view v-if="isRecording" class="text-sm mt-1">{{ duration }}s</view></view>
      </view>
      <view class="bg-white rounded-lg p-3 shadow-sm"><wd-textarea v-model="textContent" :rows="3" placeholder="或在这里输入报平安信息..." /><wd-button size="small" type="info" block class="mt-2" @click="submitCheckIn('TEXT')">文字提交</wd-button></view>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useCheckIn } from '@/composables/useCheckIn';
import { useSosVoice } from '@/composables/useSosVoice';

const { validate } = useCheckIn();
const { isRecording, duration, startRecording, stopRecording } = useSosVoice();
const textContent = ref('');
const elderId = ref(uni.getStorageSync('elderId') || '');

function submitCheckIn(method: string) {
  const result = validate({
    elderId: elderId.value,
    method,
    content: method === 'TEXT' ? textContent.value : undefined,
    voiceUrl: undefined,
  });
  if (!result.valid) {
    uni.showToast({ title: result.message || '请完善信息', icon: 'none' });
    return;
  }
  uni.request({
    url: '/api/v1/check-ins',
    method: 'POST',
    data: { elderId: elderId.value, method, content: method === 'TEXT' ? textContent.value : undefined },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: () => {
      uni.showToast({ title: '已报平安 ✅' });
      textContent.value = '';
    },
  });
}

function startVoice() {
  startRecording();
  uni.showToast({ title: '开始录音', icon: 'none', duration: 500 });
}

function stopVoice() {
  stopRecording();
  if (duration.value < 1) {
    uni.showToast({ title: '录音时间太短', icon: 'none' });
    return;
  }
  // Submit VOICE check-in with placeholder voiceUrl (see TODO in sos/index.vue)
  const tempUrl = 'recorded_audio_' + Date.now();
  uni.request({
    url: '/api/v1/check-ins',
    method: 'POST',
    data: { elderId: elderId.value, method: 'VOICE', content: '语音报平安', voiceUrl: tempUrl },
    header: { Authorization: `Bearer ${uni.getStorageSync('token')}` },
    success: () => {
      uni.showToast({ title: '已报平安 ✅' });
    },
  });
}
</script>
<style scoped>.checkin-btn { min-height: 120rpx; transition: opacity 0.15s; }</style>
