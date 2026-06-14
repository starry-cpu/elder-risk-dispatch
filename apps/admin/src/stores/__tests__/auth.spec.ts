import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';

// mock @/api/auth，让 hydrate() 依赖的 authApi.getMe 可控
vi.mock('@/api/auth', () => ({
  authApi: {
    getMe: vi.fn(),
  },
}));

// 动态 import，确保拿到的是 mock 之后的模块
import { authApi } from '@/api/auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('initializes with no token and not authenticated', () => {
    const store = useAuthStore();
    expect(store.token).toBe('');
    expect(store.isAuthenticated).toBe(false);
  });

  it('setToken updates token and isAuthenticated', () => {
    const store = useAuthStore();
    store.setToken('test-token');
    expect(store.token).toBe('test-token');
    expect(store.isAuthenticated).toBe(true);
  });

  it('logout clears token', () => {
    const store = useAuthStore();
    store.setToken('test-token');
    store.logout();
    expect(store.token).toBe('');
    expect(store.isAuthenticated).toBe(false);
  });

  describe('hydrate', () => {
    it('token 为空时直接返回，不调 getMe', async () => {
      const store = useAuthStore();
      await store.hydrate();
      expect(authApi.getMe).not.toHaveBeenCalled();
      expect(store.user).toBeNull();
    });

    it('token 在但 user 为 null 时，getMe 成功回填 user', async () => {
      localStorage.setItem('token', 'cached-token');
      (authApi.getMe as any).mockResolvedValue({
        data: { code: 0, data: { id: 'u-1', name: '王管理', role: 'ADMIN' }, message: 'ok' },
      });
      const store = useAuthStore();

      // 初始：token 在、user 缺
      expect(store.isAuthenticated).toBe(true);
      expect(store.isAdmin).toBe(false);

      await store.hydrate();

      expect(authApi.getMe).toHaveBeenCalledTimes(1);
      expect(store.user).toEqual({ id: 'u-1', name: '王管理', role: 'ADMIN' });
      expect(store.isAdmin).toBe(true);
      // token 不被清
      expect(store.token).toBe('cached-token');
    });

    it('getMe 失败（token 失效）时 logout，避免看似已登录实则每次 401', async () => {
      localStorage.setItem('token', 'stale-token');
      (authApi.getMe as any).mockRejectedValue(new Error('401'));
      const store = useAuthStore();

      await store.hydrate();

      expect(store.token).toBe('');
      expect(store.user).toBeNull();
      expect(store.isAuthenticated).toBe(false);
      expect(localStorage.getItem('token')).toBeNull();
    });

    it('user 已存在时跳过 getMe（避免重复请求）', async () => {
      localStorage.setItem('token', 'cached-token');
      const store = useAuthStore();
      store.setUser({ id: 'u-1', name: '已有', role: 'ADMIN' });

      await store.hydrate();

      expect(authApi.getMe).not.toHaveBeenCalled();
      expect(store.user?.name).toBe('已有');
    });
  });
});
