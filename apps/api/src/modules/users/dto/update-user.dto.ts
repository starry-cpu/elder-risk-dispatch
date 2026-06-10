import { IsString, IsOptional, IsArray, IsEnum } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { DutyStatus } from '@prisma/client';

export class UpdateUserDto {
  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '技能标签', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({ description: '片区', required: false })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiProperty({ description: '在岗状态', required: false, enum: DutyStatus })
  @IsOptional()
  @IsEnum(DutyStatus)
  dutyStatus?: DutyStatus;
}
