import client from './client';

// === Risk Overview (GET /dashboard/risk-overview) ===
export interface RiskOverview {
  byLevel: Array<{ level: string; count: number }>;
  bySource: Array<{ source: string; count: number }>;
  trend: Array<{ date: string; count: number }>;
  total: number;
  periodDays: number;
}

// === Work Order Efficiency (GET /dashboard/work-order-efficiency) ===
export interface WorkOrderEfficiency {
  byStatus: Array<{ status: string; count: number }>;
  byType: Array<{ type: string; count: number }>;
  avgCompletionHours: number;
  overdueCount: number;
  total: number;
}

// === Elder Coverage (GET /dashboard/elder-coverage) ===
export interface ElderCoverage {
  byDistrict: Array<{ district: string; total: number; checkedIn: number; rate: number }>;
  todayCheckInRate: number;
  weekCheckInRate: number;
  abnormalRate: number;
  highRiskElders: Array<{
    elderId: string;
    name: string;
    district: string;
    serviceLevel: string;
    latestRiskLevel: string | null;
    lastCheckIn: string | null;
  }>;
}

// === Grid Worker Performance (GET /dashboard/grid-worker-performance) ===
export interface GridWorkerPerformance {
  workers: Array<{
    userId: string;
    name: string;
    role: string;
    district: string;
    dutyStatus: string;
    completedOrders: number;
    avgResponseHours: number;
  }>;
}

export const dashboardApi = {
  getRiskOverview: (params?: { period?: string }) =>
    client.get<{ data: RiskOverview }>('/dashboard/risk-overview', { params }),

  getWorkOrderEfficiency: (params?: { period?: string }) =>
    client.get<{ data: WorkOrderEfficiency }>('/dashboard/work-order-efficiency', { params }),

  getElderCoverage: () =>
    client.get<{ data: ElderCoverage }>('/dashboard/elder-coverage'),

  getGridWorkerPerformance: () =>
    client.get<{ data: GridWorkerPerformance }>('/dashboard/grid-worker-performance'),
};
