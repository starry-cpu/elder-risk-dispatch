<template>
  <div class="min-h-screen flex-center bg-gray-100">
    <el-card class="w-400px">
      <h2 class="text-center text-2xl mb-6">照护调度系统</h2>
      <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
        <el-form-item label="手机号" prop="phone">
          <el-input v-model="form.phone" placeholder="请输入手机号" />
        </el-form-item>
        <el-form-item label="密码" prop="password">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" show-password />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" class="w-full" :loading="loading" @click="handleLogin">
            登录
          </el-button>
        </el-form-item>
      </el-form>
    </el-card>
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
    const token = res.data.data.accessToken;
    authStore.setToken(token);

    // Also fetch user info
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
