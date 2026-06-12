import Request from 'luch-request';

// ⚠️ 微信小程序必须用绝对地址，开发时改为本机局域网 IP
// 示例：http://192.168.1.100:3000/api/v1
const API_BASE = 'http://localhost:3000/api/v1';

const http = new Request({
  baseURL: API_BASE,
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
      // 业务错误交给调用方处理
      return Promise.reject(new Error(body.message));
    }
    return response;
  },
  (error) => {
    // 网络/HTTP 错误交给调用方处理
    return Promise.reject(error);
  }
);

function wrap<T>(promise: Promise<{ data: { code: number; data: T; message: string } }>): Promise<{ data: { code: number; data: T; message: string } }> {
  return promise;
}

export default http;
export { wrap };
