<template>
  <view class="app-navbar" :style="{ paddingTop: statusBarHeight + 'px' }">
    <view class="app-navbar__inner">
      <view class="app-navbar__left" @click="handleBack">
        <text v-if="showBack" class="app-navbar__back">←</text>
      </view>
      <text class="app-navbar__title">{{ title }}</text>
      <view class="app-navbar__right">
        <slot name="right" />
      </view>
    </view>
    <view class="app-navbar__divider" />
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';

withDefaults(defineProps<{
  title: string;
  showBack?: boolean;
}>(), {
  showBack: true,
});

const statusBarHeight = ref(20);

onMounted(() => {
  const sysInfo = uni.getSystemInfoSync();
  statusBarHeight.value = sysInfo.statusBarHeight || 20;
});

const emit = defineEmits<{
  back: [];
}>();

function handleBack() {
  emit('back');
  uni.navigateBack({ delta: 1 });
}
</script>

<style scoped>
.app-navbar {
  background-color: #F7F3ED;
}
.app-navbar__inner {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 88rpx;
  padding: 0 20rpx;
  position: relative;
}
.app-navbar__left {
  position: absolute;
  left: 20rpx;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  padding-right: 16rpx;
}
.app-navbar__back {
  font-size: 36rpx;
  color: #2C2B29;
}
.app-navbar__title {
  font-size: 32rpx;
  font-weight: 500;
  color: #2C2B29;
}
.app-navbar__right {
  position: absolute;
  right: 20rpx;
  top: 0;
  bottom: 0;
  display: flex;
  align-items: center;
}
.app-navbar__divider {
  height: 1rpx;
  background-color: #E8E3DA;
}
</style>
