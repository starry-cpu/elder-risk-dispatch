<template>
  <view class="page flex flex-col items-center justify-center min-h-screen px-6 space-y-8">
    <text class="text-xl font-bold text-red-600">语音求助</text>
    <text class="text-sm text-gray-500">长按按钮录音，松开发送求助</text>
    <view class="sos-btn w-48 h-48 rounded-full flex-center" :class="isRecording ? 'bg-red-600 recording-pulse' : 'bg-red-500'" @touchstart="handleTouchStart" @touchend="handleTouchEnd">
      <view class="text-center"><text class="text-5xl text-white">{{ isRecording ? '🔴' : '🆘' }}</text><view class="text-white text-lg font-bold mt-2">{{ isRecording ? '松开发送' : '长按求助' }}</view><view v-if="isRecording" class="text-white text-sm mt-1">{{ duration }}s / {{ maxDuration }}s</view></view>
    </view>
    <view v-if="voiceUrl" class="bg-white rounded-lg p-4 text-center w-full"><text class="text-green-600 font-bold">求助已发送!</text><view class="text-sm text-gray-500 mt-1">工作人员将尽快响应</view></view>
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue';
import { useSosVoice } from '@/composables/useSosVoice';
const { isRecording, duration, voiceUrl, maxDuration, startRecording, stopRecording, setVoiceUrl } = useSosVoice();
function handleTouchStart() { startRecording(); }
function handleTouchEnd() { stopRecording(); if (duration.value < 1) { uni.showToast({ title: '录音时间太短', icon: 'none' }); return; } const tempUrl = 'recorded_audio_' + Date.now(); setVoiceUrl(tempUrl); const elderId = uni.getStorageSync('elderId') || ''; uni.request({ url: '/api/v1/check-ins', method: 'POST', data: { elderId, method: 'VOICE', content: '语音求助', voiceUrl: tempUrl }, header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, success: () => { uni.showToast({ title: '求助已发出' }); } }); }
</script>
<style scoped>.sos-btn { transition: transform 0.1s, box-shadow 0.1s; } .sos-btn:active { transform: scale(0.95); } .recording-pulse { animation: pulse 1s infinite; } @keyframes pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4); } 50% { box-shadow: 0 0 0 20px rgba(220, 38, 38, 0); } }</style>
