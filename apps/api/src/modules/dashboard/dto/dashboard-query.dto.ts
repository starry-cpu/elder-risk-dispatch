import { IsOptional, IsString, IsIn } from 'class-validator';

export class DashboardQueryDto {
  @IsOptional()
  @IsString()
  @IsIn(['7d', '30d'])
  period?: string = '7d';

  @IsOptional()
  @IsString()
  district?: string;

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}
