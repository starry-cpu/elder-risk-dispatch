import client from './client';

export interface AdminLoginRequest {
  phone: string;
  password: string;
}

export const authApi = {
  adminLogin: (data: AdminLoginRequest) =>
    client.post<{ data: { accessToken: string } }>('/auth/admin-login', data),

  getMe: () =>
    client.get<{ data: { id: string; name: string; role: string } }>('/auth/me'),
};
