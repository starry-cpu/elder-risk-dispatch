import { IsString, IsNotEmpty, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateFamilyRequestDto {
  @ApiProperty({ description: '老人 ID', example: 'cmqckuz1l0002i5sw1a5zpure' })
  @IsString()
  @IsNotEmpty({ message: '老人 ID 不能为空' })
  elderId!: string;

  @ApiProperty({
    description: '请求帮助的描述，例如：水管坏了需要人修、需要陪同就医',
    example: '水管坏了需要人修',
  })
  @IsString()
  @MinLength(2, { message: '请求描述至少 2 个字符' })
  @MaxLength(500, { message: '请求描述最多 500 个字符' })
  text!: string;
}
