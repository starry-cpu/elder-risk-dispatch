// apps/api/src/modules/risk/dto/evaluate-risk.dto.ts
import { IsString, IsInt, IsBoolean, IsArray, IsOptional, Min } from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';

export class EvaluateRiskDto {
  @ApiProperty({ description: '老人 ID' })
  @IsString()
  elderId!: string;

  @ApiProperty({ description: '距上次报平安小时数', default: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  hoursSinceLastCheckIn?: number = 0;

  @ApiProperty({ description: '设备报警类型列表', default: [] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  deviceAlarms?: string[] = [];

  @ApiProperty({ description: 'AI 分类是否异常文本', default: false })
  @IsOptional()
  @IsBoolean()
  abnormalText?: boolean = false;

  @ApiProperty({ description: '年龄', required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  age?: number = 0;

  @ApiProperty({ description: '是否有慢病', default: false })
  @IsOptional()
  @IsBoolean()
  hasChronicDisease?: boolean = false;

  @ApiProperty({ description: '近7天是否有高风险事件', default: false })
  @IsOptional()
  @IsBoolean()
  recentHighRisk?: boolean = false;
}
