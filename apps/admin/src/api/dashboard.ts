import client from './client';

export interface DashboardOverview {
  keyElderCount: number;
  pendingRiskCount: number;
  todayCompletionRate: number;
  poorReviewCount: number;
}

export interface RiskDistribution {
  high: number;
  medium: number;
  low: number;
}

export interface ResponseTimeTrend {
  date: string;
  avgMinutes: number;
}

export interface Hotspot {
  category: string;
  count: number;
}

export const dashboardApi = {
  getOverview: () =>
    client.get<{ data: DashboardOverview }>('/dashboard/overview'),

  getResponseTime: () =>
    client.get<{ data: ResponseTimeTrend[] }>('/dashboard/response-time'),

  getRiskDistribution: () =>
    client.get<{ data: RiskDistribution }>('/dashboard/risk-distribution'),

  getHotspots: () =>
    client.get<{ data: Hotspot[] }>('/dashboard/hotspots'),

  getPoorReviews: () =>
    client.get<{ data: Hotspot[] }>('/dashboard/poor-reviews'),
};
