<template>
  <view class="home">
    <view class="home__content">
      <text class="home__title">照护调度</text>
      <text class="home__subtitle">为老人提供更安全的照护服务</text>
      <view class="home__actions">
        <AppButton type="primary" size="full" :loading="loading" @click="enterApp">
          {{ loading ? '加载中...' : '进入工作台' }}
        </AppButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import AppButton from '@/components/AppButton.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const loading = ref(false);

async function enterApp() {
  loading.value = true;
  try {
    // 确保已获取用户信息
    if (!auth.user) {
      await auth.fetchUser();
    }

    if (auth.isWorker) {
      uni.redirectTo({ url: '/pagesWorker/risk-tasks/index' });
    } else if (auth.isElder) {
      uni.redirectTo({ url: '/pagesElder/check-in/index' });
    } else {
      // 调试：显示实际角色信息
      const role = auth.user?.role || '无';
      uni.showToast({
        title: `未知角色(${role})，请联系管理员`,
        icon: 'none',
        duration: 3000,
      });
    }
  } catch {
    // fetchUser 失败（如 token 过期），fall through 到微信登录
    if (auth.isAuthenticated) {
      // token 有效但 fetchUser 网络错误，提示用户重试
      uni.showToast({ title: '网络异常，请重试', icon: 'none' });
      return;
    }
    // token 无效或不存在，触发微信登录
    try {
      const { code } = await uniLogin();
      await auth.login(code);
      if (auth.isWorker) {
        uni.redirectTo({ url: '/pagesWorker/risk-tasks/index' });
      } else if (auth.isElder) {
        uni.redirectTo({ url: '/pagesElder/check-in/index' });
      } else {
        const role = auth.user?.role || '无';
        uni.showToast({
          title: `未知角色(${role})，请联系管理员`,
          icon: 'none',
          duration: 3000,
        });
      }
    } catch (e: any) {
      uni.showToast({ title: e?.message || '登录失败', icon: 'none' });
    }
  } finally {
    loading.value = false;
  }
}

function uniLogin(): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    uni.login({
      success: (res) => resolve({ code: res.code }),
      fail: reject,
    });
  });
}

onMounted(async () => {
  // 有 token 但无 user → 先拉取用户信息
  if (auth.isAuthenticated && !auth.user) {
    try {
      await auth.fetchUser();
    } catch {
      // token 过期，清除后等待用户手动点击
      auth.logout();
      return;
    }
  }
  // 已登录用户直接跳转
  if (auth.isAuthenticated && auth.user) {
    if (auth.isWorker) {
      uni.redirectTo({ url: '/pagesWorker/risk-tasks/index' });
    } else if (auth.isElder) {
      uni.redirectTo({ url: '/pagesElder/check-in/index' });
    }
  }
});
</script>

<style scoped>
.home {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 100vh;
  background-color: #F7F3ED;
  padding: 48rpx;
}
.home__content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16rpx;
  width: 100%;
  max-width: 500rpx;
}
.home__title {
  font-size: 44rpx;
  font-weight: 600;
  color: #2C2B29;
  letter-spacing: 4rpx;
}
.home__subtitle {
  font-size: 28rpx;
  color: #6B6760;
  margin-bottom: 48rpx;
}
.home__actions {
  width: 100%;
}
</style>
