import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { UploadsService } from './uploads.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  @Get('presigned-url')
  @ApiOperation({ summary: '获取 MinIO 预签名上传 URL' })
  async getPresignedUrl(@Query() dto: PresignedUrlDto) {
    return this.uploadsService.generatePresignedUrl(
      dto.fileName,
      dto.contentType,
      dto.folder,
    );
  }
}
