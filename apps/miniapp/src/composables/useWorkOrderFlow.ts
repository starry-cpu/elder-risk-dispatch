const TRANSITIONS: Record<string, string[]> = {
  PENDING: ['ACCEPT'],
  ASSIGNED: ['START'],
  IN_PROGRESS: ['COMPLETE'],
  COMPLETED: [],
  CANCELLED: [],
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待分配',
  ASSIGNED: '已分配',
  IN_PROGRESS: '处理中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export function useWorkOrderFlow() {
  const statusLabels = STATUS_LABELS;

  function getAvailableActions(status: string): string[] {
    return TRANSITIONS[status] || [];
  }

  function canPerformAction(currentStatus: string, action: string): boolean {
    const available = TRANSITIONS[currentStatus] || [];
    return available.includes(action);
  }

  function validateCompletion(result: string): { valid: boolean; message?: string } {
    if (!result || result.trim().length === 0) {
      return { valid: false, message: '请填写处理结果' };
    }
    return { valid: true };
  }

  return { statusLabels, getAvailableActions, canPerformAction, validateCompletion };
}
