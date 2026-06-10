import { Injectable, BadRequestException } from '@nestjs/common';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';

export interface PresignedUrlResult {
  url: string;
  key: string;
  expiresIn: number;
}

const AUDIO_TYPES = ['audio/mp3', 'audio/wav', 'audio/m4a'];
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
  ): Promise<PresignedUrlResult> {
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
}
