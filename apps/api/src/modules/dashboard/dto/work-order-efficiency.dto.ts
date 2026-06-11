export class WorkOrderEfficiencyDto {
  byStatus!: Array<{ status: string; count: number }>;
  byType!: Array<{ type: string; count: number }>;
  avgCompletionHours!: number;
  overdueCount!: number;
  total!: number;
}
