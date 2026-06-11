import { IsString, IsEnum, IsOptional, IsDateString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderType, RiskLevel } from '@prisma/client';

export class CreateWorkOrderDto {
  @ApiProperty({ description: '老人 ID' })
  @IsString()
  elderId!: string;

  @ApiProperty({ description: '关联风险事件 ID', required: false })
  @IsOptional()
  @IsString()
  riskEventId?: string;

  @ApiProperty({ description: '工单类型', enum: WorkOrderType })
  @IsEnum(WorkOrderType)
  type!: WorkOrderType;

  @ApiProperty({ description: '风险等级', enum: RiskLevel, required: false })
  @IsOptional()
  @IsEnum(RiskLevel)
  level?: RiskLevel;

  @ApiProperty({ description: '截止时间', required: false })
  @IsOptional()
  @IsDateString()
  deadline?: string;

  @ApiProperty({ description: '创建原因', required: false })
  @IsOptional()
  @IsString()
  dispatchReason?: string;
}
