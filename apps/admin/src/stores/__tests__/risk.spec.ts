import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useRiskStore } from '../risk';

vi.mock('@/api', () => ({
  riskApi: {
    list: vi.fn().mockResolvedValue({
      data: { data: { items: [{ id: '1', elderId: 'e1', level: 'HIGH', source: 'MISSED_CHECKIN', score: 80, reason: '未报平安', status: 'PENDING_REVIEW', createdAt: '2026-06-12T00:00:00Z', elderName: '张大爷' }], total: 1, page: 1, limit: 20 } },
    }),
    review: vi.fn().mockResolvedValue({ data: { data: { success: true } } }),
  },
}));

describe('useRiskStore', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('fetchList populates items', async () => {
    const store = useRiskStore();
    await store.fetchList({});
    expect(store.items).toHaveLength(1);
    expect(store.items[0].level).toBe('HIGH');
  });
  it('addNewEvent prepends item', () => {
    const store = useRiskStore();
    store.addNewEvent({ id: '2', elderId: 'e2', level: 'MEDIUM' as const, source: 'DEVICE', score: 50, reason: '烟感', status: 'PENDING_REVIEW', createdAt: '2026-06-12T01:00:00Z' });
    expect(store.items).toHaveLength(1);
    expect(store.items[0].id).toBe('2');
  });
});
