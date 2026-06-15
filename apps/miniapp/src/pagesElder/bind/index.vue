<template>
  <view class="page">
    <AppNavbar title="账号绑定" />
    <view class="bind">
      <text class="bind__icon">🔗</text>
      <text class="bind__title">您的账号尚未关联老人</text>
      <text class="bind__hint">请联系社区工作人员完成绑定后即可使用报平安、求助等服务。</text>
      <view class="bind__contact">
        <text class="bind__contact-label">社区服务电话</text>
        <text class="bind__contact-phone">400-000-0000</text>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import AppNavbar from '@/components/AppNavbar.vue';
</script>

<style scoped>
.page {
  min-height: 100vh;
  background-color: #F7F3ED;
}
.bind {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 96rpx 48rpx;
  gap: 24rpx;
}
.bind__icon { font-size: 96rpx; }
.bind__title { font-size: 32rpx; font-weight: 600; color: #2C2B29; }
.bind__hint { font-size: 28rpx; color: #6B6760; text-align: center; line-height: 1.6; }
.bind__contact {
  margin-top: 48rpx;
  background-color: #FEFDFB;
  border-radius: 12rpx;
  padding: 32rpx 48rpx;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8rpx;
  box-shadow: 0 1rpx 0 #E8E3DA;
}
.bind__contact-label { font-size: 24rpx; color: #9E9990; }
.bind__contact-phone { font-size: 36rpx; font-weight: 600; color: #7A8B6E; }
</style>
