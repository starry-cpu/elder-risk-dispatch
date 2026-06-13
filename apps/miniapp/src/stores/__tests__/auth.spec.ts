import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';

vi.mock('@/api/elders', () => ({
  eldersApi: {
    findMine: vi.fn(),
  },
}));

// 延迟引入，使 vi.mock 优先生效
const { eldersApi } = await import('@/api/elders');

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
