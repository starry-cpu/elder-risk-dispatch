import { IsOptional, IsString, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class QueryVisitDto {
  @ApiProperty({ description: '按老人 ID 筛选', required: false })
  @IsOptional()
  @IsString()
  elderId?: string;

  @ApiProperty({ description: '起始日期 (ISO)', required: false })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiProperty({ description: '结束日期 (ISO)', required: false })
  @IsOptional()
  @IsString()
  to?: string;

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
}
