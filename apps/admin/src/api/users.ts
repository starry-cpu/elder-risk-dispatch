import client from './client';

export interface UserRecord {
  id: string;
  name: string;
  phone: string;
  role: string;
  skills: string[];
  district: string;
  dutyStatus: string;
}

// 后端 UsersService.findAll 返回分页结构 { items, total, page, limit }
export interface PaginatedUsers {
  items: UserRecord[];
  total: number;
  page: number;
  limit: number;
}

export const usersApi = {
  list: (params?: { role?: string; district?: string }) =>
    client.get<{ data: PaginatedUsers }>('/users', { params }),

  create: (data: Omit<UserRecord, 'id'>) =>
    client.post('/users', data),

  update: (id: string, data: Partial<UserRecord>) =>
    client.patch(`/users/${id}`, data),
};
