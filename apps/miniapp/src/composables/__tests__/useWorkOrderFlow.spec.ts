import { describe, it, expect } from 'vitest';
import { useWorkOrderFlow } from '../useWorkOrderFlow';

describe('useWorkOrderFlow', () => {
  it('returns empty actions for PENDING status (worker does not interact with unassigned)', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    expect(getAvailableActions('PENDING')).toHaveLength(0);
  });
  it('returns available actions for ASSIGNED status', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    expect(getAvailableActions('ASSIGNED')).toContain('START');
  });
  it('returns available actions for IN_PROGRESS status', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    expect(getAvailableActions('IN_PROGRESS')).toContain('COMPLETE');
  });
  it('returns empty actions for COMPLETED status', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    expect(getAvailableActions('COMPLETED')).toHaveLength(0);
  });
  it('returns empty actions for CANCELLED status', () => {
    const { getAvailableActions } = useWorkOrderFlow();
    expect(getAvailableActions('CANCELLED')).toHaveLength(0);
  });
  it('validates START requires ASSIGNED status', () => {
    const { canPerformAction } = useWorkOrderFlow();
    expect(canPerformAction('ASSIGNED', 'START')).toBe(true);
    expect(canPerformAction('IN_PROGRESS', 'START')).toBe(false);
  });
  it('validates COMPLETE requires result text', () => {
    const { validateCompletion } = useWorkOrderFlow();
    expect(validateCompletion('').valid).toBe(false);
    expect(validateCompletion('处理完成').valid).toBe(true);
  });
  it('provides status labels', () => {
    const { statusLabels } = useWorkOrderFlow();
    expect(statusLabels['PENDING']).toBe('待分配');
    expect(statusLabels['COMPLETED']).toBe('已完成');
  });
});
