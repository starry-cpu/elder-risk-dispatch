import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';

vi.mock('@/api/elders', () => ({
  eldersApi: {
    findMine: vi.fn(),
  },
}));

vi.mock('@/api/auth', () => ({
  authApi: {
    workerLogin: vi.fn(),
  },
}));

// 延迟引入，使 vi.mock 优先生效
const { eldersApi } = await import('@/api/elders');
const { authApi } = await import('@/api/auth');

vi.stubGlobal('uni', {
  getStorageSync: vi.fn(() => ''),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
});

describe('useAuthStore (miniapp)', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    vi.clearAllMocks();
  });
  it('initializes with no token', () => {
    const store = useAuthStore();
    expect(store.isAuthenticated).toBe(false);
  });
  it('setToken updates isAuthenticated', () => {
    const store = useAuthStore();
    store.setToken('test-token');
    expect(store.isAuthenticated).toBe(true);
  });
  it('has loading state initialized to false', async () => {
    const store = useAuthStore();
    expect(store.loading).toBe(false);
  });
  it('isElder is true only for FAMILY role (not ELDER which is dead code)', () => {
    const store = useAuthStore();
    store.setUser({ id: 'u1', name: '家属', role: 'FAMILY' });
    expect(store.isElder).toBe(true);
  });
  it('setCurrentElder persists currentElderId to storage', () => {
    const store = useAuthStore();
    store.setCurrentElder('elder-1');
    expect(store.currentElderId).toBe('elder-1');
    expect(uni.setStorageSync).toHaveBeenCalledWith('currentElderId', 'elder-1');
  });
  it('logout clears elders and currentElderId', () => {
    const store = useAuthStore();
    store.setToken('t');
    store.setUser({ id: 'u1', name: '家属', role: 'FAMILY' });
    store.setCurrentElder('elder-1');
    store.logout();
    expect(store.currentElderId).toBe('');
    expect(store.elders).toEqual([]);
    expect(uni.removeStorageSync).toHaveBeenCalledWith('currentElderId');
    expect(uni.removeStorageSync).toHaveBeenCalledWith('elders');
  });

  describe('loginWithPassword', () => {
    it('stores token + user on success', async () => {
      (authApi.workerLogin as any).mockResolvedValue({
        data: { data: { token: 'jwt-1', user: { id: 'w1', name: '陈秀英', role: 'GRID_WORKER' } } },
      });
      const store = useAuthStore();
      await store.loginWithPassword('13901100001', 'worker123');
      expect(authApi.workerLogin).toHaveBeenCalledWith('13901100001', 'worker123');
      expect(store.token).toBe('jwt-1');
      expect(store.user).toEqual({ id: 'w1', name: '陈秀英', role: 'GRID_WORKER' });
      expect(store.isWorker).toBe(true);
    });

    it('throws on api failure so the login page can show a toast', async () => {
      (authApi.workerLogin as any).mockRejectedValue(new Error('手机号或密码错误'));
      const store = useAuthStore();
      await expect(store.loginWithPassword('13901100001', 'wrong')).rejects.toThrow('手机号或密码错误');
      // 失败不应写入任何凭据
      expect(store.isAuthenticated).toBe(false);
    });

    it('throws when response envelope is malformed', async () => {
      (authApi.workerLogin as any).mockResolvedValue({ data: { data: {} } });
      const store = useAuthStore();
      await expect(store.loginWithPassword('13901100001', 'worker123')).rejects.toThrow();
    });
  });

  describe('ensureElders', () => {
    it('fetches linked elders and auto-selects the first when none selected', async () => {
      (eldersApi.findMine as any).mockResolvedValue({
        data: { data: { items: [
          { id: 'e-1', name: '张大爷', serviceLevel: 'HIGH', district: '朝阳区' },
          { id: 'e-2', name: '李奶奶', serviceLevel: 'NORMAL', district: '朝阳区' },
        ] } },
      });

      const store = useAuthStore();
      store.setUser({ id: 'u1', name: '家属', role: 'FAMILY' });
      await store.ensureElders();

      expect(eldersApi.findMine).toHaveBeenCalled();
      expect(store.elders).toHaveLength(2);
      // 自动选中第一个
      expect(store.currentElderId).toBe('e-1');
      expect(uni.setStorageSync).toHaveBeenCalledWith('elders', store.elders);
      expect(uni.setStorageSync).toHaveBeenCalledWith('currentElderId', 'e-1');
    });

    it('does not override an existing currentElderId', async () => {
      (eldersApi.findMine as any).mockResolvedValue({
        data: { data: { items: [
          { id: 'e-1', name: '张大爷', serviceLevel: 'HIGH', district: '朝阳区' },
        ] } },
      });

      const store = useAuthStore();
      store.setUser({ id: 'u1', name: '家属', role: 'FAMILY' });
      store.setCurrentElder('e-1');
      await store.ensureElders();

      expect(store.currentElderId).toBe('e-1');
    });

    it('clears elders to empty on API failure', async () => {
      (eldersApi.findMine as any).mockRejectedValue(new Error('network'));

      const store = useAuthStore();
      store.setUser({ id: 'u1', name: '家属', role: 'FAMILY' });
      await store.ensureElders();

      expect(store.elders).toEqual([]);
    });

    it('skips fetching for non-FAMILY role', async () => {
      const store = useAuthStore();
      store.setUser({ id: 'u1', name: '网格员', role: 'GRID_WORKER' });
      await store.ensureElders();

      expect(eldersApi.findMine).not.toHaveBeenCalled();
    });
  });
});
