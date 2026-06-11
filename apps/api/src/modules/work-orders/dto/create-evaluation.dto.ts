import { IsInt, Min, Max, IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateEvaluationDto {
  @ApiProperty({ description: '评分（1-5）' })
  @IsInt()
  @Min(1)
  @Max(5)
  rating!: number;

  @ApiProperty({ description: '评价内容', required: false })
  @IsOptional()
  @IsString()
  comment?: string;

  @ApiProperty({ description: '标签', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
