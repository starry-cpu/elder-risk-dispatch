import http, { wrap } from './client';
export const checkInsApi = {
  create: (data: { elderId: string; method: string; content?: string; voiceUrl?: string }) =>
    wrap(http.post('/check-ins', data)),
  listByElder: (elderId: string, params?: { page?: number; limit?: number }) =>
    wrap(http.get(`/elders/${elderId}/check-ins`, { params })),
};
