export class ElderCoverageDto {
  byDistrict!: Array<{ district: string; total: number; checkedIn: number; rate: number }>;
  todayCheckInRate!: number;
  weekCheckInRate!: number;
  abnormalRate!: number;
  highRiskElders!: Array<{
    elderId: string;
    name: string;
    district: string;
    serviceLevel: string;
    latestRiskLevel: string;
    lastCheckIn: string | null;
  }>;
}
