import { IsOptional, IsEnum, IsInt, Min, IsString } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
import { WorkOrderStatus, WorkOrderType } from '@prisma/client';

export class QueryWorkOrdersDto {
  @ApiProperty({ description: '页码', default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiProperty({ description: '每页条数', default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 20;

  @ApiProperty({ description: '状态过滤', required: false, enum: WorkOrderStatus })
  @IsOptional()
  @IsEnum(WorkOrderStatus)
  status?: WorkOrderStatus;

  @ApiProperty({ description: '类型过滤', required: false, enum: WorkOrderType })
  @IsOptional()
  @IsEnum(WorkOrderType)
  type?: WorkOrderType;

  @ApiProperty({ description: '片区过滤', required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ description: '老人 ID 过滤', required: false })
  @IsOptional()
  @IsString()
  elderId?: string;

  @ApiProperty({ description: '接单者 ID 过滤', required: false })
  @IsOptional()
  @IsString()
  assigneeId?: string;
}
