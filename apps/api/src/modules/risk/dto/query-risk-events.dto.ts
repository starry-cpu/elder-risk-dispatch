import { IsOptional, IsInt, Min, Max, IsEnum, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { RiskLevel, RiskStatus } from '@prisma/client';

export class QueryRiskEventsDto {
  @ApiProperty({ description: '页码', required: false, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiProperty({ description: '每页条数', required: false, default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiProperty({ description: '风险等级过滤', required: false, enum: RiskLevel })
  @IsOptional()
  @IsEnum(RiskLevel)
  level?: RiskLevel;

  @ApiProperty({ description: '风险状态过滤', required: false, enum: RiskStatus })
  @IsOptional()
  @IsEnum(RiskStatus)
  status?: RiskStatus;

  @ApiProperty({ description: '片区过滤', required: false })
  @IsOptional()
  @IsString()
  district?: string;
}
