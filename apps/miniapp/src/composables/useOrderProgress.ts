const TYPE_LABELS: Record<string, string> = {
  HEALTH: '健康服务',
  LIFE: '生活照料',
  REPAIR: '维修服务',
  ESCORT: '陪诊服务',
  COMPANION: '陪伴服务',
  ERRAND: '代购服务',
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: '待分配',
  ASSIGNED: '已分配',
  IN_PROGRESS: '处理中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

export interface OrderSummary {
  id: string;
  elderName?: string;
  type: string;
  status: string;
  level: string;
  createdAt: string;
}

export interface TimelineDisplayItem {
  id: string;
  title: string;
  status: string;
  statusLabel: string;
  level: string;
  createdAt: string;
}

export function useOrderProgress() {
  function mapToTimelineDisplay(order: OrderSummary): TimelineDisplayItem {
    return {
      id: order.id,
      title: TYPE_LABELS[order.type] || order.type,
      status: order.status,
      statusLabel: STATUS_LABELS[order.status] || order.status,
      level: order.level,
      createdAt: order.createdAt,
    };
  }

  function formatOrdersList(orders: OrderSummary[]): TimelineDisplayItem[] {
    return [...orders]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map(mapToTimelineDisplay);
  }

  return { mapToTimelineDisplay, formatOrdersList, TYPE_LABELS, STATUS_LABELS };
}
