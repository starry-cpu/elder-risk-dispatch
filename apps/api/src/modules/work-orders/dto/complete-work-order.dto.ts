import { IsString, IsArray, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CompleteWorkOrderDto {
  @ApiProperty({ description: '处理结果' })
  @IsString()
  result!: string;

  @ApiProperty({ description: '照片 URL 列表', required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}
