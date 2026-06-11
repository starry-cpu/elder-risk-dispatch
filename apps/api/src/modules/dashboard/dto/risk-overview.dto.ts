export class RiskOverviewDto {
  byLevel!: Array<{ level: string; count: number }>;
  bySource!: Array<{ source: string; count: number }>;
  trend!: Array<{ date: string; count: number }>;
  total!: number;
  periodDays!: number;
}
