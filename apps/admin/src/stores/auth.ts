import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';

export const useAuthStore = defineStore('auth', () => {
  // token 持久化到 localStorage；user 不持久化，改由 hydrate() 在启动/刷新时回填，
  // 避免陈旧 user（角色/姓名变更后）残留在本地。
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

  /**
   * 应用启动（及页面刷新）时回填 user。
   *
   * 场景：刷新后 token 仍在 localStorage（isAuthenticated=true），但内存里的 user
   * 恒为 null，导致顶栏显示回退名、isAdmin=false、角色门控失效。
   *
   * 行为：
   * - token 为空：不做任何事（未登录）。
   * - token 非空但 user 已存在：跳过（已回填过）。
   * - token 非空且 user 为 null：调 getMe() 回填；失败（401/网络）则 logout()，
   *   让 App.vue 自动切回登录视图，避免"看似已登录实则每次请求都 401"。
   *
   * 在 main.ts 中 mount 前 await 调用一次。
   */
  async function hydrate() {
    if (!token.value || user.value) return;
    try {
      const res = await authApi.getMe();
      const me = res?.data?.data;
      if (me) {
        setUser({ id: me.id, name: me.name, role: me.role });
      } else {
        logout();
      }
    } catch {
      // token 无效或网络异常：清掉，让用户重新登录
      logout();
    }
  }

  return { token, user, isAuthenticated, isAdmin, setToken, setUser, logout, hydrate };
});
