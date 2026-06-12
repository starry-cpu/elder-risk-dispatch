import { describe, it, expect } from 'vitest';
import { useOrderProgress } from '../useOrderProgress';

describe('useOrderProgress', () => {
  it('maps work order to progress display', () => {
    const { mapToTimelineDisplay } = useOrderProgress();
    const order = {
      id: '1',
      elderName: '张大爷',
      type: 'HEALTH',
      status: 'IN_PROGRESS',
      level: 'HIGH',
      createdAt: '2026-06-12T08:00:00Z',
    };
    const display = mapToTimelineDisplay(order);
    expect(display.id).toBe('1');
    expect(display.title).toBe('健康服务');
    expect(display.statusLabel).toBe('处理中');
  });

  it('handles unknown type gracefully', () => {
    const { mapToTimelineDisplay } = useOrderProgress();
    const display = mapToTimelineDisplay({
      id: '1',
      type: 'UNKNOWN',
      status: 'PENDING',
      level: 'LOW',
      createdAt: '',
    });
    expect(display.title).toBe('UNKNOWN');
  });

  it('formats empty work orders list', () => {
    const { formatOrdersList } = useOrderProgress();
    expect(formatOrdersList([])).toHaveLength(0);
  });

  it('sorts orders by createdAt descending', () => {
    const { formatOrdersList } = useOrderProgress();
    const orders = [
      {
        id: '1',
        elderName: 'A',
        type: 'HEALTH',
        status: 'PENDING',
        level: 'LOW' as const,
        createdAt: '2026-06-12T08:00:00Z',
      },
      {
        id: '2',
        elderName: 'B',
        type: 'LIFE',
        status: 'PENDING',
        level: 'MEDIUM' as const,
        createdAt: '2026-06-12T10:00:00Z',
      },
    ];
    const result = formatOrdersList(orders);
    expect(result[0].id).toBe('2');
    expect(result[1].id).toBe('1');
  });
});
