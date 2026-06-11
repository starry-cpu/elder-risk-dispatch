// apps/api/src/modules/ai/dto/classify.dto.ts
import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ClassifyDto {
  @ApiProperty({ description: '待分类的文本内容' })
  @IsString()
  text!: string;
}
