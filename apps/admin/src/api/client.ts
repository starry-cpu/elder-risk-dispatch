import axios, { type AxiosInstance, type AxiosError } from 'axios';
import { ElMessage } from 'element-plus';

interface ApiResponse<T = unknown> {
  code: number;
  data: T;
  message: string;
}

const client: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => {
    const body = response.data as ApiResponse;
    if (body.code !== 0) {
      ElMessage.error(body.message || '请求失败');
      return Promise.reject(new Error(body.message));
    }
    return response;
  },
  (error: AxiosError<ApiResponse>) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
      return Promise.reject(error);
    }
    const msg = error.response?.data?.message || error.message || '网络错误';
    ElMessage.error(msg);
    return Promise.reject(error);
  }
);

export default client;
export type { ApiResponse };
