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

// 统一角色路由：消除原 enterApp 内两处重复的 if-else
async function routeByRole() {
  // FAMILY 需先确保老人身份就绪
  if (auth.isElder) {
    await auth.ensureElders();
  }
  if (auth.isWorker || auth.isAdmin) {
    uni.redirectTo({ url: '/pagesWorker/risk-tasks/index' });
  } else if (auth.isElder) {
    if (auth.currentElderId) {
      uni.redirectTo({ url: '/pagesElder/check-in/index' });
    } else {
      uni.redirectTo({ url: '/pagesElder/bind/index' }); // 未绑定引导
    }
  } else {
    const role = auth.user?.role || '无';
    uni.showToast({ title: `未知角色(${role})，请联系管理员`, icon: 'none', duration: 3000 });
  }
}

function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function enterApp() {
  loading.value = true;
  try {
    if (!auth.user) {
      await withTimeout(auth.fetchUser(), 8000);
    }
    await routeByRole();
  } catch {
    // fetchUser 失败（token 过期 / 网络超时 / 服务器不可达）
    if (auth.isAuthenticated) {
      uni.showToast({ title: '网络异常，请检查后端服务（localhost:3000）', icon: 'none' });
      return;
    }
    // token 无效或不存在，触发微信登录
    try {
      const { code } = await uniLogin();
      await withTimeout(auth.login(code), 8000);
      await routeByRole();
    } catch (e: any) {
      const msg = e?.message === 'timeout' ? '网络超时，请确认后端已启动' : (e?.message || '登录失败');
      uni.showToast({ title: msg, icon: 'none' });
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

onMounted(() => {
  // 只在已有完整会话（token + user 均已缓存）时自动跳转，不联网
  if (auth.isAuthenticated && auth.user) {
    routeByRole();
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
