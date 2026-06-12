import { describe, it, expect, beforeEach, vi } from 'vitest';
import { setActivePinia, createPinia } from 'pinia';
import { useElderStore } from '../elders';

vi.mock('@/api', () => ({
  eldersApi: {
    list: vi.fn().mockResolvedValue({
      data: {
        data: {
          items: [
            {
              id: '1',
              name: '张大爷',
              gender: 'M',
              district: '东城',
              healthTags: ['慢病'],
              serviceLevel: 'KEY',
              lastCheckInTime: '2026-06-12T08:00:00Z',
            },
          ],
          total: 1,
          page: 1,
          limit: 20,
        },
      },
    }),
    getById: vi.fn().mockResolvedValue({
      data: {
        data: {
          id: '1',
          name: '张大爷',
          gender: 'M',
          district: '东城',
          address: '东城街道1号',
          healthTags: ['慢病'],
          serviceLevel: 'KEY',
          contacts: [],
          riskProfile: [],
        },
      },
    }),
    getRiskProfile: vi.fn().mockResolvedValue({
      data: {
        data: [
          {
            id: 'r1',
            level: 'HIGH',
            source: 'MISSED_CHECKIN',
            score: 80,
            reason: '未报平安',
            createdAt: '2026-06-11T00:00:00Z',
          },
        ],
      },
    }),
  },
}));

describe('useElderStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
  });

  it('fetchList populates items', async () => {
    const store = useElderStore();
    await store.fetchList({});
    expect(store.items).toHaveLength(1);
    expect(store.items[0].name).toBe('张大爷');
  });

  it('fetchDetail populates current elder', async () => {
    const store = useElderStore();
    await store.fetchDetail('1');
    expect(store.currentElder?.name).toBe('张大爷');
  });
});
