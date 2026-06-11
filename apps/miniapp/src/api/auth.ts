import http, { wrap } from './client';
export const authApi = {
  wechatLogin: (code: string) => wrap(http.post('/auth/wechat-login', { code })),
  getMe: () => wrap(http.get('/auth/me')),
};
