import client from './client';

export interface AuditLogRecord {
  id: string;
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string;
  detail?: Record<string, unknown>;
  ip?: string;
  createdAt: string;
}

export interface AuditListParams {
  page?: number;
  limit?: number;
  action?: string;
  resourceType?: string;
  from?: string;
  to?: string;
}

export const auditApi = {
  list: (params: AuditListParams) =>
    client.get<{ data: { items: AuditLogRecord[]; total: number; page: number; limit: number } }>('/audit/logs', { params }),
};
