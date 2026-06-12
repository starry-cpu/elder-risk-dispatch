import { defineStore } from 'pinia';
import { ref, computed } from 'vue';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token') || '');
  const user = ref<{ id: string; name: string; role: string } | null>(null);

  const isAuthenticated = computed(() => token.value.length > 0);
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  function setToken(t: string) {
    token.value = t;
    localStorage.setItem('token', t);
  }

  function setUser(u: typeof user.value) {
    user.value = u;
  }

  function logout() {
    token.value = '';
    user.value = null;
    localStorage.removeItem('token');
  }

  return { token, user, isAuthenticated, isAdmin, setToken, setUser, logout };
});
