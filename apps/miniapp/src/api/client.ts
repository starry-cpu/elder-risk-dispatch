import Request from 'luch-request';

/**
 * 后端 API 地址。
 *
 * ⚠️ 微信小程序必须用绝对地址（无"当前域名"概念）。
 *
 * 默认本机开发用 localhost；真机预览时请在小程序里手动写入你电脑的局域网 IP：
 *   uni.setStorageSync('apiBase', 'http://192.168.1.100:3000/api/v1')
 * 该缓存读取放在请求拦截器里（惰性求值），既支持运行时切换，
 * 又避免在模块加载阶段访问 uni（jsdom 测试环境下 uni 尚未注入）。
 */
const DEFAULT_API_BASE = 'http://localhost:3000/api/v1';

// baseURL 在拦截器中按需解析，构造时给一个占位，避免顶层访问 uni。
const http = new Request({
  baseURL: DEFAULT_API_BASE,
  timeout: 15000,
  header: { 'Content-Type': 'application/json' },
});

http.interceptors.request.use((config) => {
  // 惰性解析 apiBase：允许运行时通过 storage 切换（便于真机联调局域网 IP）
  const apiBase = uni.getStorageSync('apiBase') || DEFAULT_API_BASE;
  config.baseURL = apiBase;

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
export { DEFAULT_API_BASE as API_BASE };
