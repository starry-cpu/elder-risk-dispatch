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
  const isElder = computed(() => user.value?.role === 'FAMILY');
  function setToken(t: string) { token.value = t; uni.setStorageSync('token', t); }
  function setUser(u: typeof user.value) { user.value = u; }
  function logout() { token.value = ''; user.value = null; uni.removeStorageSync('token'); }
  return { token, user, loading, isAuthenticated, isWorker, isElder, setToken, setUser, logout };
});
