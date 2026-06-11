import { IsString, IsIn, IsObject, IsOptional, IsNotEmpty } from 'class-validator';

export class SendNotificationDto {
  @IsString()
  @IsNotEmpty()
  @IsIn(['USER', 'ELDER'])
  targetType!: string;

  @IsString()
  @IsNotEmpty()
  targetId!: string;

  @IsString()
  @IsOptional()
  templateId?: string;

  @IsObject()
  payload!: Record<string, unknown>;
}
