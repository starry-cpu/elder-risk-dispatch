import {
  Controller,
  Get,
  Post,
  Query,
  BadRequestException,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
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

  @Post('audio')
  @ApiOperation({ summary: '上传语音文件（小程序 multipart 代理）' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB 上限
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('未收到文件');
    return this.uploadsService.saveAudioFile(file.buffer, file.mimetype, file.originalname);
  }
}
