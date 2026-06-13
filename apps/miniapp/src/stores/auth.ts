import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(uni.getStorageSync('token') || '');
  // 持久化 user，使冷启动时无需联网即可恢复角色路由（避免每次启动都阻塞 8s 等待 fetchUser）
  const user = ref<{ id: string; name: string; role: string } | null>(
    uni.getStorageSync('user') || null
  );
  const loading = ref(false);
  const isAuthenticated = computed(() => token.value.length > 0);
  const isWorker = computed(() =>
    user.value?.role === 'GRID_WORKER' || user.value?.role === 'COMMUNITY_DOCTOR' ||
    user.value?.role === 'PROPERTY' || user.value?.role === 'VOLUNTEER');
  const isElder = computed(() =>
    user.value?.role === 'FAMILY' || user.value?.role === 'ELDER');
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  function setToken(t: string) { token.value = t; uni.setStorageSync('token', t); }
  function setUser(u: typeof user.value) {
    user.value = u;
    // 与 token 一并持久化，刷新/重启后可立即恢复角色路由
    if (u) uni.setStorageSync('user', u);
    else uni.removeStorageSync('user');
  }
  function logout() {
    token.value = '';
    user.value = null;
    uni.removeStorageSync('token');
    uni.removeStorageSync('user');
  }

  // /auth/me 返回 JwtPayload（{ sub, loginType, role, district }），
  // 而前端按 { id, name, role } 消费。这里做一次字段归一化。
  function normalizeUser(data: any): { id: string; name: string; role: string } {
    return {
      id: data?.id ?? data?.sub ?? '',
      name: data?.name ?? data?.loginType ?? '用户',
      role: data?.role ?? '',
    };
  }

  async function login(code: string) {
    loading.value = true;
    try {
      const res = await authApi.wechatLogin(code);
      const data = (res as any)?.data?.data;
      if (data?.token) setToken(data.token);
      if (data?.user) setUser(normalizeUser(data.user));
    } finally {
      loading.value = false;
    }
  }

  async function fetchUser() {
    const res = await authApi.getMe();
    const data = (res as any)?.data?.data;
    if (data) setUser(normalizeUser(data));
  }

  return { token, user, loading, isAuthenticated, isWorker, isElder, isAdmin, setToken, setUser, logout, login, fetchUser };
});
