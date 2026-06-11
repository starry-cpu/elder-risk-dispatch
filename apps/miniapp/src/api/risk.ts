import http, { wrap } from './client';
export const riskApi = {
  listEvents: (params: { status?: string; level?: string; page?: number; limit?: number }) =>
    wrap(http.get('/risk/events', { params })),
  review: (id: string, data: { status: string; note?: string }) =>
    wrap(http.post(`/risk/events/${id}/review`, data)),
};
