import { IsString, IsIn } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class PresignedUrlDto {
  @ApiProperty({ description: '文件名（含扩展名）', example: 'recording-001.mp3' })
  @IsString()
  fileName!: string;

  @ApiProperty({
    description: '文件 MIME 类型',
    example: 'audio/mp3',
    enum: ['audio/mp3', 'audio/wav', 'audio/m4a', 'image/jpeg', 'image/png', 'image/webp', 'image/heic'],
  })
  @IsString()
  contentType!: string;

  @ApiProperty({
    description: '存储目录',
    example: 'checkins',
    enum: ['checkins', 'visits'],
  })
  @IsString()
  @IsIn(['checkins', 'visits'])
  folder!: 'checkins' | 'visits';
}
