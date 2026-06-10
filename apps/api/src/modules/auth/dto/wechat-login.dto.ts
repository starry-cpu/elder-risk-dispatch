import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class WechatLoginDto {
  @ApiProperty({ description: '微信登录 code (wx.login 获取)' })
  @IsString()
  code!: string;

  @ApiProperty({ description: '微信用户昵称（新用户时使用）', required: false })
  @IsOptional()
  @IsString()
  nickname?: string;
}
