import { WorkOrderStatus } from '@prisma/client';

export interface TransitionContext {
  isAssignee?: boolean;
  hasReason?: boolean;
}

export interface TransitionResult {
  allowed: boolean;
  error?: string;
}

// Map of allowed transitions: from -> { to -> guard condition }
const TRANSITION_MAP: Record<
  WorkOrderStatus,
  Partial<Record<WorkOrderStatus, (ctx: TransitionContext) => TransitionResult>>
> = {
  [WorkOrderStatus.PENDING]: {
    [WorkOrderStatus.ASSIGNED]: (ctx) => {
      if (!ctx.isAssignee) {
        return { allowed: false, error: 'PENDING 状态必须先指定接单人员' };
      }
      return { allowed: true };
    },
    [WorkOrderStatus.IN_PROGRESS]: () => ({
      allowed: false,
      error: '必须先派单（ASSIGNED）才能开始处理',
    }),
    [WorkOrderStatus.COMPLETED]: () => ({
      allowed: false,
      error: '必须先派单并处理完成后才能标记为已完成',
    }),
    [WorkOrderStatus.CANCELLED]: () => ({ allowed: true }),
  },
  [WorkOrderStatus.ASSIGNED]: {
    [WorkOrderStatus.ASSIGNED]: (ctx) => {
      if (!ctx.hasReason) {
        return { allowed: false, error: '改派时必须填写原因' };
      }
      return { allowed: true };
    },
    [WorkOrderStatus.IN_PROGRESS]: (ctx) => {
      if (!ctx.isAssignee) {
        return { allowed: false, error: '只有接单人员可以开始处理' };
      }
      return { allowed: true };
    },
    [WorkOrderStatus.CANCELLED]: () => ({ allowed: true }),
  },
  [WorkOrderStatus.IN_PROGRESS]: {
    [WorkOrderStatus.COMPLETED]: () => ({ allowed: true }),
    [WorkOrderStatus.CANCELLED]: (ctx) => {
      if (!ctx.hasReason) {
        return { allowed: false, error: '进行中的工单取消时必须填写原因' };
      }
      return { allowed: true };
    },
  },
  [WorkOrderStatus.COMPLETED]: {},
  [WorkOrderStatus.CANCELLED]: {},
};

export class WorkOrderStateMachine {
  static canTransition(
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    context: TransitionContext = {},
  ): TransitionResult {
    // Terminal states cannot transition anywhere
    if (from === WorkOrderStatus.COMPLETED) {
      return { allowed: false, error: '已完成的工单不可变更' };
    }
    if (from === WorkOrderStatus.CANCELLED) {
      return { allowed: false, error: '已取消的工单不可变更' };
    }

    // Self-transition is only valid for reassign (ASSIGNED→ASSIGNED with reason)
    if (from === to) {
      const guard = TRANSITION_MAP[from]?.[to];
      if (guard) {
        return guard(context);
      }
      return { allowed: false, error: `不允许从 ${from} 保持不变` };
    }

    const guard = TRANSITION_MAP[from]?.[to];
    if (!guard) {
      return { allowed: false, error: `不允许从 ${from} 转移到 ${to}` };
    }

    return guard(context);
  }

  static transition(
    from: WorkOrderStatus,
    to: WorkOrderStatus,
    context: TransitionContext = {},
  ): WorkOrderStatus {
    const result = WorkOrderStateMachine.canTransition(from, to, context);
    if (!result.allowed) {
      throw new Error(result.error ?? '非法的状态转移');
    }
    return to;
  }
}
