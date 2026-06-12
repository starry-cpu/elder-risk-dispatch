import http, { wrap } from './client';
export const workOrdersApi = {
  list: (params: { status?: string; page?: number; limit?: number }) =>
    wrap(http.get('/work-orders', { params })),
  getById: (id: string) => wrap(http.get(`/work-orders/${id}`)),
  assign: (id: string, data: { assigneeId: string }) =>
    wrap(http.post(`/work-orders/${id}/assign`, data)),
  start: (id: string) => wrap(http.post(`/work-orders/${id}/start`)),
  complete: (id: string, data: { result: string; photos?: string[] }) =>
    wrap(http.post(`/work-orders/${id}/complete`, data)),
  cancel: (id: string, data?: { reason?: string }) =>
    wrap(http.post(`/work-orders/${id}/cancel`, data)),
  reassign: (id: string, data: { assigneeId: string; reason: string }) =>
    wrap(http.post(`/work-orders/${id}/reassign`, data)),
  getTimeline: (id: string) => wrap(http.get(`/work-orders/${id}/timeline`)),
};
