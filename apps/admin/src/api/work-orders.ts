import client from './client';

export interface WorkOrderRecord {
  id: string;
  elderId: string;
  elderName?: string;
  type: string;
  level: string;
  status: string;
  /** 工单来源：MANUAL / RISK_DISPATCH / FAMILY_REQUEST / SOS */
  sourceFrom?: string;
  /** 家属请求原文（sourceFrom 为 FAMILY_REQUEST/SOS 时有值）*/
  familyRequestText?: string;
  assigneeId?: string;
  assigneeName?: string;
  deadline?: string;
  createdAt: string;
}

export interface WorkOrderListParams {
  page?: number;
  limit?: number;
  status?: string;
}

export interface AssignParams {
  assigneeId: string;
}

export interface ReassignParams {
  assigneeId: string;
  reason: string;
}

export interface DispatchRecommendation {
  assignee: {
    id: string;
    name: string;
    district: string;
    skills: string[];
    dutyStatus: string;
    avgResponseMin?: number;
  };
  score: number;
}

export const workOrdersApi = {
  list: (params: WorkOrderListParams) =>
    client.get<{ data: { items: WorkOrderRecord[]; total: number; page: number; limit: number } }>('/work-orders', { params }),

  assign: (id: string, data: AssignParams) =>
    client.post(`/work-orders/${id}/assign`, data),

  reassign: (id: string, data: ReassignParams) =>
    client.post(`/work-orders/${id}/reassign`, data),

  getRecommendations: (id: string) =>
    client.get<{ data: DispatchRecommendation[] }>(`/work-orders/${id}/recommendations`),

  getTimeline: (id: string) =>
    client.get<{ data: Array<{ id: string; action: string; note?: string; createdAt: string }> }>(`/work-orders/${id}/timeline`),
};
