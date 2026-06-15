<template>
  <div class="login-page">
    <div class="login-card">
      <div class="login-header">
        <div class="login-icon">
          <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
            <rect width="36" height="36" rx="8" fill="rgba(184,134,11,0.12)"/>
            <path d="M18 8c-3.6 0-6.5 2.9-6.5 6.5 0 3 1.7 5.6 4.3 6.7L17 27h2l1.2-5.8c2.6-1.1 4.3-3.7 4.3-6.7C24.5 10.9 21.6 8 18 8z" fill="#b8860b" opacity="0.8"/>
            <circle cx="14" cy="15" r="1.5" fill="#fff"/>
            <circle cx="21" cy="15" r="1.5" fill="#fff"/>
            <path d="M14 20c1 1 2.5 1.5 4 0" stroke="#fff" stroke-width="1" stroke-linecap="round"/>
          </svg>
        </div>
        <h1 class="login-title">照护调度系统</h1>
        <p class="login-desc">社区独居老人风险预警与工单调度</p>
      </div>

      <el-form
        ref="formRef"
        :model="form"
        :rules="rules"
        label-position="top"
        class="login-form"
      >
        <el-form-item label="手机号" prop="phone">
          <el-input
            v-model="form.phone"
            placeholder="请输入手机号"
            size="large"
          />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input
            v-model="form.password"
            type="password"
            placeholder="请输入密码"
            show-password
            size="large"
          />
        </el-form-item>
        <el-form-item>
          <el-button
            type="primary"
            size="large"
            class="login-btn"
            :loading="loading"
            @click="handleLogin"
          >
            登录系统
          </el-button>
        </el-form-item>
      </el-form>
    </div>

    <p class="login-footer">社区照护 · 安心守护</p>
  </div>
</template>

<script setup lang="ts">
import { reactive, ref } from 'vue';
import { useRouter } from 'vue-router';
import { ElMessage } from 'element-plus';
import type { FormInstance, FormRules } from 'element-plus';
import { useAuthStore } from '@/stores/auth';
import { authApi } from '@/api';

const router = useRouter();
const authStore = useAuthStore();
const formRef = ref<FormInstance>();
const loading = ref(false);

const form = reactive({
  phone: '',
  password: '',
});

const rules: FormRules = {
  phone: [{ required: true, message: '请输入手机号', trigger: 'blur' }],
  password: [{ required: true, message: '请输入密码', trigger: 'blur' }],
};

async function handleLogin() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;

  loading.value = true;
  try {
    const res = await authApi.adminLogin(form);
    const token = res.data.data.token;
    authStore.setToken(token);

    const meRes = await authApi.getMe();
    authStore.setUser(meRes.data.data);

    ElMessage.success('登录成功');
    router.push('/dashboard');
  } catch {
    // error handled by interceptor
  } finally {
    loading.value = false;
  }
}
</script>

<style scoped>
.login-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  background: var(--surface-paper);
  position: relative;
}

/* Subtle radial glow at top */
.login-page::before {
  content: '';
  position: absolute;
  top: -160px;
  left: 50%;
  transform: translateX(-50%);
  width: 600px;
  height: 600px;
  background: radial-gradient(circle, rgba(184,134,11,0.06) 0%, transparent 70%);
  pointer-events: none;
}

.login-card {
  width: 400px;
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-lg);
  box-shadow: var(--shadow-elevated);
  padding: 40px 36px 32px;
  position: relative;
  z-index: 1;
}

.login-header {
  text-align: center;
  margin-bottom: 32px;
}

.login-icon {
  display: flex;
  justify-content: center;
  margin-bottom: 16px;
}

.login-title {
  font-family: var(--font-display);
  font-size: 22px;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 6px;
  letter-spacing: 0.05em;
}

.login-desc {
  font-size: 13px;
  color: var(--text-muted);
  margin: 0;
  letter-spacing: 0.03em;
}

.login-form :deep(.el-form-item__label) {
  color: var(--text-secondary);
  font-size: 13px;
  font-weight: 450;
}

.login-btn {
  width: 100%;
  font-size: 15px;
  letter-spacing: 0.04em;
  margin-top: 4px;
}

.login-footer {
  margin-top: 32px;
  font-size: 12px;
  color: var(--text-muted);
  letter-spacing: 0.06em;
  position: relative;
  z-index: 1;
}
</style>
