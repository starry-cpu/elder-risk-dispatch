import { IsString, IsBoolean, IsNumber, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class DeviceDataDto {
  @ApiProperty({ description: '设备标识' })
  @IsString()
  deviceId!: string;

  @ApiProperty({ description: '关联老人 ID' })
  @IsString()
  elderId!: string;

  @ApiProperty({ description: '设备类型 (BLOOD_PRESSURE/HEART_RATE/FALL_DETECTOR/SMOKE/WATER)' })
  @IsString()
  deviceType!: string;

  @ApiProperty({ description: '指标类型' })
  @IsString()
  metricType!: string;

  @ApiProperty({ description: '读数/值', required: false })
  @IsOptional()
  @IsString()
  value?: string;

  @ApiProperty({ description: '是否告警' })
  @IsBoolean()
  alarm!: boolean;

  @ApiProperty({ description: '设备端 Unix 毫秒时间戳' })
  @IsNumber()
  timestamp!: number;
}
