import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

// 统一上传结果：预签名 URL 与直传都用此结构（直传时 expiresIn=0 表示无过期）
export interface UploadResult {
  url: string;
  key: string;
  expiresIn: number;
}

const AUDIO_TYPES = ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a'];
const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];

const FOLDER_ALLOWED_TYPES: Record<string, string[]> = {
  checkins: AUDIO_TYPES,
  visits: IMAGE_TYPES,
};

@Injectable()
export class UploadsService {
  private readonly s3Client: S3Client;
  private readonly bucket: string;

  constructor() {
    this.s3Client = new S3Client({
      endpoint: process.env.S3_ENDPOINT || 'http://localhost:9000',
      region: process.env.S3_REGION || 'us-east-1',
      credentials: {
        accessKeyId: process.env.S3_ACCESS_KEY || 'minioadmin',
        secretAccessKey: process.env.S3_SECRET_KEY || 'minioadmin',
      },
      forcePathStyle: true,
    });
    this.bucket = process.env.S3_BUCKET || 'care';
  }

  validateContentType(contentType: string, allowed: string[]): boolean {
    if (!contentType) return false;
    return allowed.includes(contentType);
  }

  getAllowedTypesForFolder(folder: string): string[] {
    return FOLDER_ALLOWED_TYPES[folder] || [];
  }

  async generatePresignedUrl(
    fileName: string,
    contentType: string,
    folder: 'checkins' | 'visits',
  ): Promise<UploadResult> {
    const allowed = this.getAllowedTypesForFolder(folder);
    if (!this.validateContentType(contentType, allowed)) {
      throw new BadRequestException(
        `不支持的文件类型: ${contentType}。${folder} 目录允许: ${allowed.join(', ')}`,
      );
    }

    const ext = fileName.split('.').pop() || '';
    const uniqueFileName = `${uuidv4()}.${ext}`;
    const key = `${folder}/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: contentType,
    });

    const url = await getSignedUrl(this.s3Client, command, { expiresIn: 900 });
    return { url, key, expiresIn: 900 };
  }

  // 小程序录音文件直传：multipart 经 multer 解析为 buffer，直接 PutObject 到 MinIO
  async saveAudioFile(
    buffer: Buffer,
    contentType: string,
    fileName: string,
  ): Promise<UploadResult> {
    const allowed = this.getAllowedTypesForFolder('checkins'); // ['audio/mp3', 'audio/mpeg', 'audio/wav', 'audio/m4a']
    if (!this.validateContentType(contentType, allowed)) {
      throw new BadRequestException(
        `不支持的音频类型: ${contentType}。允许: ${allowed.join(', ')}`,
      );
    }

    const ext = fileName.split('.').pop() || 'mp3';
    const uniqueFileName = `${uuidv4()}.${ext}`;
    const key = `checkins/${uniqueFileName}`;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: buffer,
      ContentType: contentType,
    });

    await this.s3Client.send(command);

    // 返回可访问的 url（MinIO endpoint + bucket + key）
    const endpoint = process.env.S3_ENDPOINT || 'http://localhost:9000';
    const url = `${endpoint}/${this.bucket}/${key}`;
    return { url, key, expiresIn: 0 };
  }
}
