export class GridWorkerPerformanceDto {
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
