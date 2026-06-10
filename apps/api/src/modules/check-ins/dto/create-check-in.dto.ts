import { IsString, IsEnum, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { CheckInMethod } from '@prisma/client';

export class CreateCheckInDto {
  @ApiProperty({ description: '关联老人 ID' })
  @IsString()
  elderId!: string;

  @ApiProperty({ description: '报到方式', enum: CheckInMethod })
  @IsEnum(CheckInMethod)
  method!: CheckInMethod;

  @ApiProperty({ description: '文本内容（TEXT/VOICE/PROXY 模式需要）', required: false })
  @IsOptional()
  @IsString()
  content?: string;

  @ApiProperty({ description: '语音文件 URL（VOICE 模式需要）', required: false })
  @IsOptional()
  @IsString()
  voiceUrl?: string;
}
