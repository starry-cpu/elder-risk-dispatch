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

// 后端 RulesService.findAll 返回分页结构 { items, total, page, limit }
export interface PaginatedRules {
  items: RiskRuleRecord[];
  total: number;
  page: number;
  limit: number;
}

export const rulesApi = {
  list: () =>
    client.get<{ data: PaginatedRules }>('/risk/rules'),

  create: (data: Omit<RiskRuleRecord, 'id' | 'version'>) =>
    client.post('/risk/rules', data),

  update: (id: string, data: Partial<RiskRuleRecord>) =>
    client.patch(`/risk/rules/${id}`, data),
};
