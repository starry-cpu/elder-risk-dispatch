import { describe, it, expect } from 'vitest';
import { useRiskTaskList } from '../useRiskTaskList';

const mockItems = [
  { id: '1', level: 'HIGH' as const, createdAt: '2026-06-12T08:00:00Z', score: 90, elderName: 'A', source: 'MISSED_CHECKIN', reason: '未报平安', status: 'PENDING_REVIEW' },
  { id: '2', level: 'MEDIUM' as const, createdAt: '2026-06-12T09:00:00Z', score: 50, elderName: 'B', source: 'DEVICE', reason: '烟感', status: 'PENDING_REVIEW' },
  { id: '3', level: 'HIGH' as const, createdAt: '2026-06-12T10:00:00Z', score: 80, elderName: 'C', source: 'ABNORMAL_TEXT', reason: '异常文本', status: 'CONFIRMED' },
  { id: '4', level: 'LOW' as const, createdAt: '2026-06-12T07:00:00Z', score: 20, elderName: 'D', source: 'HISTORY', reason: '历史', status: 'PENDING_REVIEW' },
];

describe('useRiskTaskList', () => {
  it('sorts by level priority (HIGH first, then MEDIUM, then LOW)', () => {
    const { sortItems } = useRiskTaskList();
    const sorted = sortItems([...mockItems]);
    expect(sorted[0].level).toBe('HIGH');
    expect(sorted[1].level).toBe('HIGH');
    expect(sorted[2].level).toBe('MEDIUM');
    expect(sorted[3].level).toBe('LOW');
  });
  it('sorts by score within same level', () => {
    const { sortItems } = useRiskTaskList();
    const sorted = sortItems([...mockItems]);
    const highItems = sorted.filter(i => i.level === 'HIGH');
    expect(highItems[0].score).toBeGreaterThanOrEqual(highItems[1].score);
  });
  it('filters by status', () => {
    const { filterByStatus } = useRiskTaskList();
    const filtered = filterByStatus(mockItems, 'PENDING_REVIEW');
    expect(filtered).toHaveLength(3);
    expect(filtered.every(i => i.status === 'PENDING_REVIEW')).toBe(true);
  });
  it('filters by level', () => {
    const { filterByLevel } = useRiskTaskList();
    const filtered = filterByLevel(mockItems, 'HIGH');
    expect(filtered).toHaveLength(2);
    expect(filtered.every(i => i.level === 'HIGH')).toBe(true);
  });
  it('returns all items when filter is empty', () => {
    const { filterByStatus } = useRiskTaskList();
    expect(filterByStatus(mockItems, '')).toHaveLength(4);
  });
});
