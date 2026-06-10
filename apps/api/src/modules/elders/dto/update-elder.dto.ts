import { IsString, IsOptional, IsEnum, IsArray, IsNumber } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceLevel } from '@prisma/client';

export class UpdateElderDto {
  @ApiProperty({ description: '姓名', required: false })
  @IsOptional()
  @IsString()
  name?: string;

  @ApiProperty({ description: '性别', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ description: '出生日期', required: false })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiProperty({ description: '身份证号', required: false })
  @IsOptional()
  @IsString()
  idCard?: string;

  @ApiProperty({ description: '住址', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: '经度', required: false })
  @IsOptional()
  @IsNumber()
  longitude?: number;

  @ApiProperty({ description: '纬度', required: false })
  @IsOptional()
  @IsNumber()
  latitude?: number;

  @ApiProperty({ description: '健康标签', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  healthTags?: string[];

  @ApiProperty({ description: '服务等级', required: false, enum: ServiceLevel })
  @IsOptional()
  @IsEnum(ServiceLevel)
  serviceLevel?: ServiceLevel;

  @ApiProperty({ description: '居住状况', required: false })
  @IsOptional()
  @IsString()
  livingStatus?: string;
}
