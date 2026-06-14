import client from './client';

export interface AdminLoginRequest {
  phone: string;
  password: string;
}

// 与后端 AuthService.sanitizeUser 返回结构一致（apps/api auth.service.ts）
export interface AdminUser {
  id: string;
  name: string;
  phone: string;
  role: string;
  district: string | null;
  skills: string[];
  dutyStatus: string;
  createdAt: string;
}

export const authApi = {
  adminLogin: (data: AdminLoginRequest) =>
    client.post<{ data: { token: string; user: AdminUser } }>('/auth/admin-login', data),

  getMe: () =>
    client.get<{ data: { id: string; name: string; role: string } }>('/auth/me'),
};
