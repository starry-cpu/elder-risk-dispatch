import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';

vi.stubGlobal('uni', {
  getStorageSync: vi.fn(() => ''),
  setStorageSync: vi.fn(),
  removeStorageSync: vi.fn(),
  showToast: vi.fn(),
});

describe('useAuthStore (miniapp)', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
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
});
