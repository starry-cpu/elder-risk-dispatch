import { IsString, IsOptional, IsEnum, IsArray, IsNumber, IsBoolean } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { ServiceLevel } from '@prisma/client';

export class CreateElderContactDto {
  @ApiProperty({ description: '联系人姓名' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '与老人关系' })
  @IsString()
  relation!: string;

  @ApiProperty({ description: '联系电话' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '是否主要联系人', required: false })
  @IsOptional()
  @IsBoolean()
  isPrimary?: boolean;
}

export class CreateElderDto {
  @ApiProperty({ description: '姓名' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '性别（M/F）', required: false })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiProperty({ description: '出生日期', required: false })
  @IsOptional()
  @IsString()
  birthDate?: string;

  @ApiProperty({ description: '身份证号（加密存储）', required: false })
  @IsOptional()
  @IsString()
  idCard?: string;

  @ApiProperty({ description: '住址（加密存储）', required: false })
  @IsOptional()
  @IsString()
  address?: string;

  @ApiProperty({ description: '所属片区' })
  @IsString()
  district!: string;

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

  @ApiProperty({ description: '紧急联系人', required: false, type: [CreateElderContactDto] })
  @IsOptional()
  @IsArray()
  contacts?: CreateElderContactDto[];
}
