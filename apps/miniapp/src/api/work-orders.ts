import http, { wrap } from './client';
export const workOrdersApi = {
  list: (params: { status?: string; page?: number; limit?: number }) =>
    wrap(http.get('/work-orders', { params })),
  getById: (id: string) => wrap(http.get(`/work-orders/${id}`)),
  accept: (id: string) => wrap(http.post(`/work-orders/${id}/accept`)),
  start: (id: string) => wrap(http.post(`/work-orders/${id}/start`)),
  complete: (id: string, data: { result: string; photos?: string[] }) =>
    wrap(http.post(`/work-orders/${id}/complete`, data)),
  getTimeline: (id: string) => wrap(http.get(`/work-orders/${id}/timeline`)),
};
