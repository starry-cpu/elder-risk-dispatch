import Request from 'luch-request';

/**
 * 后端 API 地址。
 *
 * ⚠️ 微信小程序必须用绝对地址（无"当前域名"概念）。
 *
 * 默认用本机局域网 IP 而非 localhost/127.0.0.1：微信开发者工具模拟器对
 * localhost/127.0.0.1 的 http 请求存在拦截问题（TCP 连得上但请求不转发，表现为 8s 超时），
 * 用真实局域网 IP 可绕过。换电脑开发时请改此 IP，或运行时覆盖：
 *   uni.setStorageSync('apiBase', 'http://你的IP:3000/api/v1')
 * 该缓存读取放在请求拦截器里（惰性求值），既支持运行时切换，
 * 又避免在模块加载阶段访问 uni（jsdom 测试环境下 uni 尚未注入）。
 */
const DEFAULT_API_BASE = 'http://192.168.31.158:3000/api/v1';

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

/**
 * 后端统一响应包络（与 ResponseInterceptor 对齐）。
 * 各 store/composable 解析 luch-request 响应时用本类型替代 `as any`。
 */
export interface Envelope<T> {
  code: number;
  data: T;
  message: string;
}
export interface HttpResponse<T> {
  data: Envelope<T>;
}

export default http;
export { wrap };
export { DEFAULT_API_BASE as API_BASE };
