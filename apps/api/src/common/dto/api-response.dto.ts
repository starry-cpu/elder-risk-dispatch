import { ApiProperty } from '@nestjs/swagger';

export class ApiResponseDto<T = unknown> {
  @ApiProperty({ description: '状态码，0 表示成功' })
  code!: number;

  @ApiProperty({ description: '响应数据' })
  data?: T;

  @ApiProperty({ description: '响应消息' })
  message!: string;

  static success<T>(data: T, message = 'ok'): ApiResponseDto<T> {
    return { code: 0, data, message };
  }

  static error(code: number, message: string): ApiResponseDto<null> {
    return { code, data: null, message };
  }
}
