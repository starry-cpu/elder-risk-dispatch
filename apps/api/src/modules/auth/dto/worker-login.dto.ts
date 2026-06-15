import { IsString, MinLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

/**
 * 工作人员手机号+密码登录入参。
 * 结构与 AdminLoginDto 一致，单列一个 DTO 以便 Swagger 文档区分端点。
 */
export class WorkerLoginDto {
  @ApiProperty({ description: '手机号' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '密码' })
  @IsString()
  @MinLength(6)
  password!: string;
}
