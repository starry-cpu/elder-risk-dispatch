// apps/api/src/modules/ai/dto/summarize.dto.ts
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class SummarizeDto {
  @ApiProperty({ description: '工单 ID' })
  @IsString()
  workOrderId!: string;
}
