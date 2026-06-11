import client from './client';

export interface RiskRuleRecord {
  id: string;
  name: string;
  condition: Record<string, unknown>;
  weight: number;
  level: string;
  version: number;
  enabled: boolean;
}

export const rulesApi = {
  list: () =>
    client.get<{ data: RiskRuleRecord[] }>('/risk/rules'),

  create: (data: Omit<RiskRuleRecord, 'id' | 'version'>) =>
    client.post('/risk/rules', data),

  update: (id: string, data: Partial<RiskRuleRecord>) =>
    client.patch(`/risk/rules/${id}`, data),
};
