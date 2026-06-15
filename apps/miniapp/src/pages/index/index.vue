<template>
  <view class="home">
    <view class="home__content">
      <text class="home__title">照护调度</text>
      <text class="home__subtitle">为老人提供更安全的照护服务</text>

      <!-- 已有会话：显示当前账号 + 切换账号（演示者可切到工作人员登录） -->
      <view v-if="auth.isAuthenticated && auth.user" class="home__session">
        <text class="home__session-text">当前账号：{{ auth.user.name }}</text>
        <AppButton type="text" size="compact" @click="switchAccount">切换账号</AppButton>
      </view>

      <view class="home__actions">
        <AppButton type="primary" size="full" :loading="loading" @click="enterApp">
          {{ loading ? '加载中...' : '进入工作台' }}
        </AppButton>
      </view>

      <!-- 工作人员手机号+密码登录（演示用，免换微信号即可登任意 worker） -->
      <AppButton
        v-if="!showWorkerForm"
        type="text"
        size="compact"
        class="home__worker-toggle"
        @click="showWorkerForm = true"
      >
        工作人员登录
      </AppButton>
      <view v-else class="worker-form">
        <input
          v-model="workerPhone"
          class="worker-form__input"
          type="number"
          placeholder="手机号"
          maxlength="11"
        />
        <input
          v-model="workerPwd"
          class="worker-form__input"
          password
          placeholder="密码"
        />
        <AppButton
          type="primary"
          size="full"
          :loading="workerLoading"
          :disabled="!workerPhone || !workerPwd"
          @click="submitWorkerLogin"
        >
          {{ workerLoading ? '登录中...' : '登录' }}
        </AppButton>
        <AppButton type="text" size="compact" @click="cancelWorkerForm">取消</AppButton>
      </view>
    </view>
  </view>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import AppButton from '@/components/AppButton.vue';
import { useAuthStore } from '@/stores/auth';

const auth = useAuthStore();
const loading = ref(false);

// 工作人员表单状态
const showWorkerForm = ref(false);
const workerPhone = ref('');
const workerPwd = ref('');
const workerLoading = ref(false);

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

// 工作人员密码登录：失败时抛错已被 store 透传，这里 toast 提示
async function submitWorkerLogin() {
  workerLoading.value = true;
  try {
    await auth.loginWithPassword(workerPhone.value.trim(), workerPwd.value);
    await routeByRole();
  } catch (e: any) {
    const msg = e?.message || '登录失败，请检查手机号或密码';
    uni.showToast({ title: msg, icon: 'none' });
  } finally {
    workerLoading.value = false;
  }
}

function cancelWorkerForm() {
  showWorkerForm.value = false;
  workerPhone.value = '';
  workerPwd.value = '';
}

// 切换账号：登出当前会话并停在登录页，让用户选「进入工作台」或「工作人员登录」。
// 解决演示痛点：之前 onMounted 自动 routeByRole() 会用 storage 里残留的家属会话
// 直接跳走，挡住工作人员登录入口。
function switchAccount() {
  auth.logout();
  showWorkerForm.value = false;
  workerPhone.value = '';
  workerPwd.value = '';
}

function uniLogin(): Promise<{ code: string }> {
  return new Promise((resolve, reject) => {
    uni.login({
      success: (res) => resolve({ code: res.code }),
      fail: reject,
    });
  });
}

// 注意：不在 onMounted 里自动 routeByRole()。
// 自动跳转会让冷启动时残留会话（如家属）直接跳走，演示者无法切到工作人员登录。
// 改为停留本页，由用户点「进入工作台」主动进入，或点「切换账号」后选工作人员登录。

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
.home__session {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4rpx;
  width: 100%;
  margin-bottom: 32rpx;
  padding: 16rpx 24rpx;
  background-color: #FFFFFF;
  border: 1.5rpx solid #E8E3DA;
  border-radius: 12rpx;
}
.home__session-text {
  font-size: 26rpx;
  color: #6B6760;
}
.home__worker-toggle {
  margin-top: 16rpx;
}
.worker-form {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: 16rpx;
  width: 100%;
  margin-top: 24rpx;
}
.worker-form__input {
  height: 80rpx;
  padding: 0 24rpx;
  background-color: #FFFFFF;
  border: 1.5rpx solid #E8E3DA;
  border-radius: 12rpx;
  font-size: 28rpx;
  color: #2C2B29;
}
</style>
