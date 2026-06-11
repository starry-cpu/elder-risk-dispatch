import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class EvaluateRiskDto {
  @ApiProperty({ description: '老人 ID' })
  @IsString()
  elderId!: string;
}
