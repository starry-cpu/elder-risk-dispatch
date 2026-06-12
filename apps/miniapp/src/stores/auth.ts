import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(uni.getStorageSync('token') || '');
  const user = ref<{ id: string; name: string; role: string } | null>(null);
  const loading = ref(false);
  const isAuthenticated = computed(() => token.value.length > 0);
  const isWorker = computed(() =>
    user.value?.role === 'GRID_WORKER' || user.value?.role === 'COMMUNITY_DOCTOR' ||
    user.value?.role === 'PROPERTY' || user.value?.role === 'VOLUNTEER');
  const isElder = computed(() =>
    user.value?.role === 'FAMILY' || user.value?.role === 'ELDER');
  function setToken(t: string) { token.value = t; uni.setStorageSync('token', t); }
  function setUser(u: typeof user.value) { user.value = u; }
  function logout() { token.value = ''; user.value = null; uni.removeStorageSync('token'); }

  async function login(code: string) {
    loading.value = true;
    try {
      const { authApi } = await import('@/api/auth');
      const res = await authApi.wechatLogin(code);
      const data = (res as any)?.data?.data;
      if (data?.token) setToken(data.token);
      if (data?.user) setUser(data.user);
    } finally {
      loading.value = false;
    }
  }

  async function fetchUser() {
    try {
      const { authApi } = await import('@/api/auth');
      const res = await authApi.getMe();
      const data = (res as any)?.data?.data;
      if (data) setUser(data);
    } catch {
      logout(); // clear stale token so isAuthenticated becomes false
    }
  }

  return { token, user, loading, isAuthenticated, isWorker, isElder, setToken, setUser, logout, login, fetchUser };
});
