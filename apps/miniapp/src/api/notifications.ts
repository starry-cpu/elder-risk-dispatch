import http, { wrap } from './client';
export const notificationsApi = {
  subscribe: (data: { templateId: string }) =>
    wrap(http.post('/notifications/subscribe', data)),
};
