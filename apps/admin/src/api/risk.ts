import client from './client';

export interface RiskEventRecord {
  id: string;
  elderId: string;
  elderName?: string;
  level: 'LOW' | 'MEDIUM' | 'HIGH';
  source: string;
  score: number;
  reason: string;
  status: string;
  createdAt: string;
}

export interface RiskListParams {
  page?: number;
  limit?: number;
  status?: string;
  level?: string;
}

export const riskApi = {
  list: (params: RiskListParams) =>
    client.get<{ data: { items: RiskEventRecord[]; total: number; page: number; limit: number } }>('/risk/events', { params }),

  review: (id: string, data: { status: string; note?: string }) =>
    client.post(`/risk/events/${id}/review`, data),
};
