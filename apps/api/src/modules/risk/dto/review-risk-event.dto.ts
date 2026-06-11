import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { RiskStatus } from '@prisma/client';

export class ReviewRiskEventDto {
  @ApiProperty({ description: '复核决定', enum: [RiskStatus.CONFIRMED, RiskStatus.IGNORED] })
  @IsEnum([RiskStatus.CONFIRMED, RiskStatus.IGNORED])
  status!: typeof RiskStatus.CONFIRMED | typeof RiskStatus.IGNORED;

  @ApiProperty({ description: '复核备注', required: false })
  @IsOptional()
  @IsString()
  note?: string;
}
