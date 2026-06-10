import { IsString, IsOptional, IsArray, IsNumber, Min, Max, MaxLength, ArrayMaxSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateVisitDto {
  @ApiProperty({ description: '关联老人 ID' })
  @IsString()
  elderId!: string;

  @ApiProperty({ description: '观察记录', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  observation!: string;

  @ApiProperty({ description: '照片 URL 数组', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  @ArrayMaxSize(9)
  photos?: string[];

  @ApiProperty({ description: '备注', required: false })
  @IsOptional()
  @IsString()
  note?: string;

  @ApiProperty({ description: '经度（中国范围: 73-135）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(73)
  @Max(135)
  longitude?: number;

  @ApiProperty({ description: '纬度（中国范围: 18-54）', required: false })
  @IsOptional()
  @IsNumber()
  @Min(18)
  @Max(54)
  latitude?: number;

  @ApiProperty({ description: '巡访时间，默认当前时间', required: false })
  @IsOptional()
  @IsString()
  visitTime?: string;
}
