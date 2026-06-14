import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { authApi } from '@/api/auth';
import { eldersApi } from '@/api/elders';
import type { HttpResponse } from '@/api/client';
import type { ElderBrief } from '@/composables/useElderIdentity';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(uni.getStorageSync('token') || '');
  // 持久化 user，使冷启动时无需联网即可恢复角色路由（避免每次启动都阻塞 8s 等待 fetchUser）
  const user = ref<{ id: string; name: string; role: string } | null>(
    uni.getStorageSync('user') || null
  );
  // 当前家属关联的老人列表 + 选中的老人 id（取代散落的 getStorageSync('elderId')）
  const elders = ref<ElderBrief[]>(uni.getStorageSync('elders') || []);
  const currentElderId = ref<string>(uni.getStorageSync('currentElderId') || '');
  const currentElder = computed(() =>
    elders.value.find((e) => e.id === currentElderId.value) || null,
  );
  const loading = ref(false);
  const isAuthenticated = computed(() => token.value.length > 0);
  const isWorker = computed(() =>
    user.value?.role === 'GRID_WORKER' || user.value?.role === 'COMMUNITY_DOCTOR' ||
    user.value?.role === 'PROPERTY' || user.value?.role === 'VOLUNTEER');
  // 仅 FAMILY 视为老人端用户（ELDER 角色为遗留死代码，已移除）
  const isElder = computed(() => user.value?.role === 'FAMILY');
  const isAdmin = computed(() => user.value?.role === 'ADMIN');

  function setToken(t: string) { token.value = t; uni.setStorageSync('token', t); }
  function setUser(u: typeof user.value) {
    user.value = u;
    // 与 token 一并持久化，刷新/重启后可立即恢复角色路由
    if (u) uni.setStorageSync('user', u);
    else uni.removeStorageSync('user');
  }
  function setCurrentElder(id: string) {
    currentElderId.value = id;
    uni.setStorageSync('currentElderId', id);
  }
  // 拉取当前家属关联的老人列表，并自动选中第一个（仅对 FAMILY 生效）。
  // 设计要点：
  //  - 已有非空缓存则跳过（节省带宽；后台新增关联用 refreshElders() 强制刷新）
  //  - **空结果不缓存**：首次登录尚未关联老人时拉到 []，不写 storage，
  //    否则下次冷启动 store 从 storage 读到 []，本函数的缓存守卫会让它
  //    永远不重拉，导致后台补关联后家属端看不到老人（MIN-B4）
  async function ensureElders(force = false) {
    if (!isElder.value) return;
    if (!force && elders.value.length > 0) return;
    try {
      const res = await eldersApi.findMine() as HttpResponse<{ items: ElderBrief[] }>;
      const items = res?.data?.data?.items ?? [];
      elders.value = items;
      // 只有非空才缓存（见上注释）
      if (items.length > 0) {
        uni.setStorageSync('elders', items);
      } else {
        uni.removeStorageSync('elders');
      }
      if (items.length > 0 && !currentElderId.value) {
        setCurrentElder(items[0].id);
      }
    } catch (e) {
      console.warn('[auth] ensureElders failed', e);
      elders.value = [];
    }
  }
  // 强制刷新老人列表（bind 页关联成功 / 管理端补关联后调用）
  function refreshElders() {
    return ensureElders(true);
  }
  function logout() {
    token.value = '';
    user.value = null;
    elders.value = [];
    currentElderId.value = '';
    uni.removeStorageSync('token');
    uni.removeStorageSync('user');
    uni.removeStorageSync('elders');
    uni.removeStorageSync('currentElderId');
  }

  // /auth/me 返回 JwtPayload（{ sub, loginType, role, district }），
  // /auth/wechat-login 返回 sanitized user（{ id, name, role, ... }）。
  // 前端按 { id, name, role } 消费，这里做一次字段归一化兼容两种形状。
  type RawUser = Partial<{ id: string; sub: string; name: string; loginType: string; role: string }>;
  function normalizeUser(data: RawUser): { id: string; name: string; role: string } {
    return {
      id: data?.id ?? data?.sub ?? '',
      name: data?.name ?? data?.loginType ?? '用户',
      role: data?.role ?? '',
    };
  }

  async function login(code: string) {
    loading.value = true;
    try {
      const res = await authApi.wechatLogin(code) as HttpResponse<{ token: string; user: RawUser }>;
      const data = res?.data?.data;
      if (data?.token) setToken(data.token);
      if (data?.user) {
        setUser(normalizeUser(data.user));
        await ensureElders();
      }
    } finally {
      loading.value = false;
    }
  }

  async function fetchUser() {
    const res = await authApi.getMe() as HttpResponse<RawUser>;
    const data = res?.data?.data;
    if (data) {
      setUser(normalizeUser(data));
      await ensureElders();
    }
  }

  return {
    token, user, elders, currentElderId, currentElder, loading,
    isAuthenticated, isWorker, isElder, isAdmin,
    setToken, setUser, setCurrentElder, ensureElders, refreshElders, logout, login, fetchUser,
  };
});
