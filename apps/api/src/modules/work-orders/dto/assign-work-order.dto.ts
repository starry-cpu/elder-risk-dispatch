import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class AssignWorkOrderDto {
  @ApiProperty({ description: '接单人员 ID' })
  @IsString()
  assigneeId!: string;
}
