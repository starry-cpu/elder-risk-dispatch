import http, { wrap } from './client';
export const eldersApi = {
  getById: (id: string) => wrap(http.get(`/elders/${id}`)),
  getRiskProfile: (id: string) => wrap(http.get(`/elders/${id}/risk-profile`)),
  findMine: () => wrap(http.get('/elders/mine')),
};
