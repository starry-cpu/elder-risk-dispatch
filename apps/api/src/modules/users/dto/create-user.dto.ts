import { IsString, IsOptional, IsEnum, MinLength, IsArray, ValidateIf } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateUserDto {
  @ApiProperty({ description: '手机号' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '姓名' })
  @IsString()
  @MinLength(1)
  name!: string;

  @ApiProperty({ description: '角色', enum: Role })
  @IsEnum(Role)
  role!: Role;

  @ApiProperty({ description: '密码（非 FAMILY 角色必填）', required: false })
  @ValidateIf((o: CreateUserDto) => o.role !== Role.FAMILY)
  @IsString()
  @MinLength(6)
  password!: string;

  @ApiProperty({ description: '技能标签', required: false, type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[];

  @ApiProperty({ description: '片区', required: false })
  @IsOptional()
  @IsString()
  district?: string;
}
