import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDashboardStore } from '../dashboard';

vi.mock('@/api', () => ({
  dashboardApi: {
    getOverview: vi.fn().mockResolvedValue({
      data: {
        code: 0,
        data: {
          keyElderCount: 12,
          pendingRiskCount: 5,
          todayCompletionRate: 85.5,
          poorReviewCount: 2,
        },
        message: 'ok',
      },
    }),
    getRiskDistribution: vi.fn().mockResolvedValue({
      data: { code: 0, data: { high: 3, medium: 8, low: 15 }, message: 'ok' },
    }),
    getResponseTime: vi.fn().mockResolvedValue({
      data: { code: 0, data: [{ date: '2026-06-01', avgMinutes: 25 }], message: 'ok' },
    }),
    getHotspots: vi.fn().mockResolvedValue({
      data: { code: 0, data: [{ category: '生活照料', count: 10 }], message: 'ok' },
    }),
    getPoorReviews: vi.fn().mockResolvedValue({
      data: { code: 0, data: [{ category: '响应慢', count: 3 }], message: 'ok' },
    }),
  },
}));

describe('useDashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fetchOverview populates overview data', async () => {
    const store = useDashboardStore();
    await store.fetchOverview();
    expect(store.overview.keyElderCount).toBe(12);
    expect(store.overview.pendingRiskCount).toBe(5);
  });

  it('fetchAll populates all data', async () => {
    const store = useDashboardStore();
    await store.fetchAll();
    expect(store.overview.keyElderCount).toBe(12);
    expect(store.riskDistribution.high).toBe(3);
    expect(store.responseTimeTrend).toHaveLength(1);
  });
});
