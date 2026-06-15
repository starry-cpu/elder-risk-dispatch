<template>
  <view class="page">
    <AppNavbar title="电话核实" />

    <!-- 老人信息区 -->
    <view class="form-section">
      <text class="form-section__label">老人信息</text>
      <view class="form-input-wrap">
        <input
          v-model="elderId"
          class="form-input"
          placeholder="输入老人编号或姓名"
          placeholder-style="color: #9E9990"
        />
      </view>
    </view>

    <!-- 核实结果区 -->
    <view class="form-section">
      <text class="form-section__label">核实结果</text>
      <view class="form-textarea-wrap">
        <textarea
          v-model="note"
          class="form-textarea"
          placeholder="记录电话核实的内容和结果..."
          placeholder-style="color: #9E9990"
          :maxlength="2000"
          auto-height
        />
      </view>
    </view>

    <!-- 提交按钮（固定底部） -->
    <view class="form-footer">
      <AppButton type="primary" size="full" :loading="submitting" @click="handleSubmit">
        提交核实记录
      </AppButton>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppNavbar from '@/components/AppNavbar.vue';
import AppButton from '@/components/AppButton.vue';
import { visitsApi } from '@/api/visits';

const elderId = ref('');
const note = ref('');
const submitting = ref(false);

async function handleSubmit() {
  if (!elderId.value.trim() || !note.value.trim()) {
    uni.showToast({ title: '请完善信息', icon: 'none' });
    return;
  }
  submitting.value = true;
  try {
    await visitsApi.create({
      elderId: elderId.value,
      observation: `[电话核实] ${note.value}`,
    });
    uni.showToast({ title: '已记录' });
    elderId.value = '';
    note.value = '';
  } catch {
    // client interceptor already shows toast
  } finally {
    submitting.value = false;
  }
}
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
  padding-bottom: 140rpx;
}
.form-section {
  padding: 0 20rpx;
  margin-top: 32rpx;
}
.form-section__label {
  font-size: 22rpx;
  color: #9E9990;
  margin-bottom: 12rpx;
  display: block;
}
.form-input-wrap {
  border-bottom: 1rpx solid #E8E3DA;
  padding: 12rpx 0;
}
.form-input {
  width: 100%;
  font-size: 28rpx;
  color: #2C2B29;
  height: 56rpx;
  line-height: 56rpx;
}
.form-textarea-wrap {
  border-bottom: 1rpx solid #E8E3DA;
  padding: 12rpx 0;
}
.form-textarea {
  width: 100%;
  min-height: 240rpx;
  font-size: 28rpx;
  color: #2C2B29;
  line-height: 1.6;
}
.form-footer {
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 20rpx 20rpx;
  padding-bottom: calc(20rpx + env(safe-area-inset-bottom));
  background-color: #F7F3ED;
}
</style>
