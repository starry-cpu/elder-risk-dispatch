import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useWorkOrderStore } from '../work-orders';

vi.mock('@/api', () => ({
  workOrdersApi: {
    list: vi.fn().mockResolvedValue({ data: { data: { items: [{ id: '1', elderId: 'e1', elderName: '张大爷', type: 'HEALTH', level: 'HIGH', status: 'PENDING', createdAt: '2026-06-12T00:00:00Z' }], total: 1, page: 1, limit: 20 } } }),
    assign: vi.fn().mockResolvedValue({ data: { data: { success: true } } }),
    reassign: vi.fn().mockResolvedValue({ data: { data: { success: true } } }),
    getRecommendations: vi.fn().mockResolvedValue({ data: { data: [{ assignee: { id: 'u1', name: '李网格', district: '东城', skills: ['HEALTH'], dutyStatus: 'ON_DUTY', avgResponseMin: 15 }, score: 85 }] } }),
    getTimeline: vi.fn().mockResolvedValue({ data: { data: [{ id: 't1', action: 'CREATED', createdAt: '2026-06-12T00:00:00Z' }] } }),
  },
}));

describe('useWorkOrderStore', () => {
  beforeEach(() => { setActivePinia(createPinia()); });
  it('fetchList populates items', async () => {
    const store = useWorkOrderStore();
    await store.fetchList({});
    expect(store.items).toHaveLength(1);
    expect(store.items[0].type).toBe('HEALTH');
  });
  it('fetchRecommendations populates recs', async () => {
    const store = useWorkOrderStore();
    const recs = await store.fetchRecommendations('1');
    expect(recs).toHaveLength(1);
    expect(recs[0].score).toBe(85);
  });
});
