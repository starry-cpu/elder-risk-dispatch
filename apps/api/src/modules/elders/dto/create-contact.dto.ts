import { IsString, IsOptional } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateContactDto {
  @ApiProperty({ description: '联系人姓名' })
  @IsString()
  name!: string;

  @ApiProperty({ description: '与老人关系' })
  @IsString()
  relation!: string;

  @ApiProperty({ description: '联系电话（加密存储）' })
  @IsString()
  phone!: string;

  @ApiProperty({ description: '是否主要联系人', required: false })
  @IsOptional()
  isPrimary?: boolean;
}
