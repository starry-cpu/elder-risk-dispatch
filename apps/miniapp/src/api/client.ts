import Request from 'luch-request';

const http = new Request({
  baseURL: '/api/v1',
  timeout: 15000,
  header: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  const token = uni.getStorageSync('token');
  if (token) {
    config.header = { ...config.header as Record<string, string>, Authorization: `Bearer ${token}` };
  }
  return config;
});

http.interceptors.response.use(
  (response) => {
    const body = response.data as { code: number; data: unknown; message: string };
    if (body.code !== 0) {
      uni.showToast({ title: body.message || '请求失败', icon: 'none' });
      return Promise.reject(new Error(body.message));
    }
    return response;
  },
  (error) => {
    const msg = (error as unknown as Error).message || '网络错误';
    uni.showToast({ title: msg, icon: 'none' });
    return Promise.reject(error);
  }
);

function wrap<T>(promise: Promise<{ data: { code: number; data: T; message: string } }>): Promise<{ data: { code: number; data: T; message: string } }> {
  return promise;
}

export default http;
export { wrap };
