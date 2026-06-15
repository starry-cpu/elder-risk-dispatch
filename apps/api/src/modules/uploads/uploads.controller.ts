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
import { Role } from '@prisma/client';
import { UploadsService } from './uploads.service';
import { PresignedUrlDto } from './dto/presigned-url.dto';
import { Roles } from '../../common/decorators/roles.decorator';

@ApiTags('Uploads')
@ApiBearerAuth()
@Controller('uploads')
export class UploadsController {
  constructor(private readonly uploadsService: UploadsService) {}

  // 预签名直传仅面向后台/网格员（走访照片、巡检录音等）；
  // FAMILY 走语音代理 /uploads/audio，不应能直接向 bucket 写任意文件。
  // folder 已被 PresignedUrlDto 限制为 checkins|visits 白名单。
  @Get('presigned-url')
  @Roles(Role.ADMIN, Role.GRID_WORKER, Role.COMMUNITY_DOCTOR)
  @ApiOperation({ summary: '获取 MinIO 预签名上传 URL' })
  async getPresignedUrl(@Query() dto: PresignedUrlDto) {
    return this.uploadsService.generatePresignedUrl(
      dto.fileName,
      dto.contentType,
      dto.folder,
    );
  }

  // 语音代理：小程序端 FAMILY 报平安/SOS 与 worker 走访都会用到。
  @Post('audio')
  @Roles(Role.ADMIN, Role.GRID_WORKER, Role.COMMUNITY_DOCTOR, Role.FAMILY)
  @ApiOperation({ summary: '上传语音文件（小程序 multipart 代理）' })
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 10 * 1024 * 1024 } })) // 10MB 上限
  async uploadAudio(@UploadedFile() file: Express.Multer.File) {
    if (!file) throw new BadRequestException('未收到文件');
    return this.uploadsService.saveAudioFile(file.buffer, file.mimetype, file.originalname);
  }
}
