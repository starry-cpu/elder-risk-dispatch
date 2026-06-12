import { describe, it, expect, beforeEach } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useAuthStore } from '../auth';

describe('useAuthStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
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
});
