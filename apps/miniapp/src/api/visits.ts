import http, { wrap } from './client';
export const visitsApi = {
  create: (data: { elderId: string; observation: string; photos?: string[]; note?: string }) =>
    wrap(http.post('/visits', data)),
  list: (params: { elderId?: string; from?: string; to?: string }) =>
    wrap(http.get('/visits', { params })),
};
