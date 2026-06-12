import client from './client';

export interface ElderListParams {
  page?: number;
  limit?: number;
  district?: string;
  serviceLevel?: string;
  search?: string;
}

export interface ElderRecord {
  id: string;
  name: string;
  gender: string;
  birthDate: string;
  district: string;
  healthTags: string[];
  serviceLevel: string;
  lastCheckInTime?: string;
}

export interface ElderDetail extends ElderRecord {
  address: string;
  contacts: Array<{
    id: string;
    name: string;
    relation: string;
    phone: string;
    isPrimary: boolean;
  }>;
  riskProfile: Array<{
    id: string;
    level: string;
    source: string;
    score: number;
    reason: string;
    createdAt: string;
  }>;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export const eldersApi = {
  list: (params: ElderListParams) =>
    client.get<{ data: PaginatedResponse<ElderRecord> }>('/elders', { params }),

  getById: (id: string) =>
    client.get<{ data: ElderDetail }>(`/elders/${id}`),

  getRiskProfile: (id: string) =>
    client.get<{ data: ElderDetail['riskProfile'] }>(`/elders/${id}/risk-profile`),
};
