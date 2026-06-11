import { WorkOrderStatus } from '@prisma/client';
import { WorkOrderStateMachine } from './work-orders.state-machine';

describe('WorkOrderStateMachine', () => {
  describe('canTransition', () => {
    // === Legal transitions ===

    it('PENDING → ASSIGNED when assigneeId provided', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.ASSIGNED,
        { isAssignee: true },
      );
      expect(result.allowed).toBe(true);
    });

    it('PENDING → CANCELLED without reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.CANCELLED,
        { hasReason: false },
      );
      expect(result.allowed).toBe(true);
    });

    it('ASSIGNED → IN_PROGRESS when requester is assignee', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.IN_PROGRESS,
        { isAssignee: true },
      );
      expect(result.allowed).toBe(true);
    });

    it('ASSIGNED → CANCELLED without reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.CANCELLED,
        { hasReason: false },
      );
      expect(result.allowed).toBe(true);
    });

    it('ASSIGNED → ASSIGNED (reassign) with reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.ASSIGNED,
        { hasReason: true },
      );
      expect(result.allowed).toBe(true);
    });

    it('IN_PROGRESS → COMPLETED when result provided', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.COMPLETED,
        {},
      );
      expect(result.allowed).toBe(true);
    });

    it('IN_PROGRESS → CANCELLED with reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.CANCELLED,
        { hasReason: true },
      );
      expect(result.allowed).toBe(true);
    });

    // === Illegal transitions ===

    it('PENDING → IN_PROGRESS is illegal (skip ASSIGNED)', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.IN_PROGRESS,
        { isAssignee: true },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('必须先派单');
    });

    it('PENDING → COMPLETED is illegal (skip all)', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.COMPLETED,
        {},
      );
      expect(result.allowed).toBe(false);
    });

    it('IN_PROGRESS → PENDING is illegal (backward)', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.PENDING,
        {},
      );
      expect(result.allowed).toBe(false);
    });

    it('COMPLETED → any state is illegal (terminal)', () => {
      for (const to of [WorkOrderStatus.PENDING, WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.CANCELLED]) {
        const result = WorkOrderStateMachine.canTransition(WorkOrderStatus.COMPLETED, to, {});
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('已完成的工单不可变更');
      }
    });

    it('CANCELLED → any state is illegal (terminal)', () => {
      for (const to of [WorkOrderStatus.PENDING, WorkOrderStatus.ASSIGNED, WorkOrderStatus.IN_PROGRESS, WorkOrderStatus.COMPLETED]) {
        const result = WorkOrderStateMachine.canTransition(WorkOrderStatus.CANCELLED, to, {});
        expect(result.allowed).toBe(false);
        expect(result.error).toContain('已取消的工单不可变更');
      }
    });

    // === Guard tests ===

    it('ASSIGNED → IN_PROGRESS blocked when requester is not assignee', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.IN_PROGRESS,
        { isAssignee: false },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('接单人员');
    });

    it('IN_PROGRESS → CANCELLED blocked without reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.IN_PROGRESS,
        WorkOrderStatus.CANCELLED,
        { hasReason: false },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('原因');
    });

    it('ASSIGNED → ASSIGNED (reassign) blocked without reason', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.ASSIGNED,
        WorkOrderStatus.ASSIGNED,
        { hasReason: false },
      );
      expect(result.allowed).toBe(false);
      expect(result.error).toContain('原因');
    });

    it('PENDING → ASSIGNED blocked when no assignee context', () => {
      const result = WorkOrderStateMachine.canTransition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.ASSIGNED,
        { isAssignee: false },
      );
      expect(result.allowed).toBe(false);
    });

    // === transition method ===

    it('transition returns new status for valid transitions', () => {
      const result = WorkOrderStateMachine.transition(
        WorkOrderStatus.PENDING,
        WorkOrderStatus.CANCELLED,
        {},
      );
      expect(result).toBe(WorkOrderStatus.CANCELLED);
    });

    it('transition throws for invalid transitions', () => {
      expect(() =>
        WorkOrderStateMachine.transition(WorkOrderStatus.COMPLETED, WorkOrderStatus.PENDING, {}),
      ).toThrow();
    });
  });
});
