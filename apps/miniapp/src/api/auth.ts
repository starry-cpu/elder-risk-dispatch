import http, { wrap } from './client';
export const authApi = {
  wechatLogin: (code: string) => wrap(http.post('/auth/wechat-login', { code })),
  // 工作人员手机号+密码登录（演示用，免换微信号即可登任意 worker）
  workerLogin: (phone: string, password: string) =>
    wrap(http.post('/auth/worker-login', { phone, password })),
  getMe: () => wrap(http.get('/auth/me')),
};
