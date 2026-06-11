import { IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ReassignWorkOrderDto {
  @ApiProperty({ description: '新接单人员 ID' })
  @IsString()
  newAssigneeId!: string;

  @ApiProperty({ description: '改派原因' })
  @IsString()
  reason!: string;
}
