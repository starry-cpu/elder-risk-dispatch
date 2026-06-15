import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useDashboardStore } from '../dashboard';

// Mock 与当前 dashboard store 实际使用的 4 个 API 对齐（apps/admin/src/api/dashboard.ts）。
// 返回结构须与后端 dashboard.service 返回一致（被 ResponseInterceptor 包成 { code, data, message }）。
vi.mock('@/api', () => ({
  dashboardApi: {
    getRiskOverview: vi.fn().mockResolvedValue({
      data: {
        code: 0,
        data: {
          byLevel: [
            { level: 'HIGH', count: 3 },
            { level: 'MEDIUM', count: 8 },
            { level: 'LOW', count: 15 },
          ],
          bySource: [{ source: 'ABNORMAL_TEXT', count: 5 }],
          trend: [{ date: '2026-06-01', count: 2 }],
          total: 26,
          periodDays: 7,
        },
        message: 'ok',
      },
    }),
    getWorkOrderEfficiency: vi.fn().mockResolvedValue({
      data: {
        code: 0,
        data: {
          byStatus: [
            { status: 'COMPLETED', count: 17 },
            { status: 'PENDING', count: 2 },
            { status: 'IN_PROGRESS', count: 1 },
          ],
          byType: [{ type: 'URGENT', count: 3 }],
          avgCompletionHours: 12.5,
          overdueCount: 2,
          total: 20,
        },
        message: 'ok',
      },
    }),
    getElderCoverage: vi.fn().mockResolvedValue({
      data: {
        code: 0,
        data: {
          byDistrict: [{ district: '朝阳区', total: 50, checkedIn: 40, rate: 0.8 }],
          todayCheckInRate: 0.8,
          weekCheckInRate: 0.6,
          abnormalRate: 0.1,
          highRiskElders: [
            {
              elderId: 'e-1',
              name: '张大爷',
              district: '朝阳区',
              serviceLevel: 'HIGH',
              latestRiskLevel: 'HIGH',
              lastCheckIn: '2026-06-13T10:00:00.000Z',
            },
          ],
        },
        message: 'ok',
      },
    }),
    getGridWorkerPerformance: vi.fn().mockResolvedValue({
      data: {
        code: 0,
        data: {
          workers: [
            {
              userId: 'u-1',
              name: '王社工',
              role: 'GRID_WORKER',
              district: '朝阳区',
              dutyStatus: 'ON_DUTY',
              completedOrders: 10,
              avgResponseHours: 4.5,
            },
          ],
        },
        message: 'ok',
      },
    }),
  },
}));

describe('useDashboardStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fetchAll populates all four data sources', async () => {
    const store = useDashboardStore();
    await store.fetchAll();

    expect(store.riskOverview?.total).toBe(26);
    expect(store.workOrderEfficiency?.total).toBe(20);
    expect(store.elderCoverage?.todayCheckInRate).toBe(0.8);
    expect(store.gridWorkerPerformance?.workers).toHaveLength(1);
    expect(store.loading).toBe(false);
  });

  it('derived stat cards are computed from fetched data', async () => {
    const store = useDashboardStore();
    await store.fetchAll();

    // pendingRiskCount = riskOverview.total
    expect(store.pendingRiskCount).toBe(26);
    // keyElderCount = elderCoverage.highRiskElders.length
    expect(store.keyElderCount).toBe(1);
    // todayCompletionRate = round(completed/total*100) = round(17/20*100) = 85
    expect(store.todayCompletionRate).toBe(85);
    // poorReviewCount = workOrderEfficiency.overdueCount
    expect(store.poorReviewCount).toBe(2);
  });

  it('derived stats are safe defaults before fetch', () => {
    const store = useDashboardStore();
    expect(store.pendingRiskCount).toBe(0);
    expect(store.keyElderCount).toBe(0);
    expect(store.todayCompletionRate).toBe(0);
    expect(store.poorReviewCount).toBe(0);
  });
});
