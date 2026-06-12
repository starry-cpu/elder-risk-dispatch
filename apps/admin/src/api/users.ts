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

export const usersApi = {
  list: (params?: { role?: string; district?: string }) =>
    client.get<{ data: UserRecord[] }>('/users', { params }),

  create: (data: Omit<UserRecord, 'id'>) =>
    client.post('/users', data),

  update: (id: string, data: Partial<UserRecord>) =>
    client.patch(`/users/${id}`, data),
};
