<template>
  <view class="page p-4">
    <view class="bg-white rounded-lg p-4 shadow-sm space-y-4">
      <view class="text-lg font-bold">电话核实记录</view>
      <view><text class="text-sm text-gray-500">老人ID</text><wd-input v-model="elderId" placeholder="请输入老人ID" /></view>
      <view><text class="text-sm text-gray-500">核实结果</text><wd-textarea v-model="note" :rows="3" placeholder="记录通话核实结果" /></view>
      <wd-button type="primary" block :loading="submitting" @click="handleSubmit">提交记录</wd-button>
    </view>
  </view>
</template>
<script setup lang="ts">
import { ref } from 'vue';
const elderId = ref(''); const note = ref(''); const submitting = ref(false);
function handleSubmit() { if (!elderId.value.trim() || !note.value.trim()) { uni.showToast({ title: '请完善信息', icon: 'none' }); return; } submitting.value = true; uni.request({ url: '/api/v1/visits', method: 'POST', data: { elderId: elderId.value, observation: `[电话核实] ${note.value}` }, header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, complete: () => { submitting.value = false; }, success: () => { uni.showToast({ title: '已记录' }); elderId.value = ''; note.value = ''; } }); }
</script>
