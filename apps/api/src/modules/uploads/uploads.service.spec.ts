import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

jest.mock('@aws-sdk/client-s3');
jest.mock('@aws-sdk/s3-request-presigner');

describe('UploadsService', () => {
  let service: UploadsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [UploadsService],
    }).compile();
    service = module.get<UploadsService>(UploadsService);
  });

  describe('validateContentType', () => {
    it('should accept audio/mp3 for checkins folder', () => {
      expect(service.validateContentType('audio/mp3', ['audio/mp3', 'audio/wav', 'audio/m4a'])).toBe(true);
    });

    it('should accept audio/wav for checkins folder', () => {
      expect(service.validateContentType('audio/wav', ['audio/mp3', 'audio/wav', 'audio/m4a'])).toBe(true);
    });

    it('should accept audio/m4a for checkins folder', () => {
      expect(service.validateContentType('audio/m4a', ['audio/mp3', 'audio/wav', 'audio/m4a'])).toBe(true);
    });

    it('should reject video/mp4 for checkins folder', () => {
      expect(service.validateContentType('video/mp4', ['audio/mp3', 'audio/wav', 'audio/m4a'])).toBe(false);
    });

    it('should accept image/jpeg for visits folder', () => {
      expect(service.validateContentType('image/jpeg', ['image/jpeg', 'image/png', 'image/webp', 'image/heic'])).toBe(true);
    });

    it('should reject text/html for any folder', () => {
      expect(service.validateContentType('text/html', ['image/jpeg', 'image/png'])).toBe(false);
    });

    it('should reject empty content type', () => {
      expect(service.validateContentType('', ['audio/mp3'])).toBe(false);
    });
  });

  describe('getAllowedTypesForFolder', () => {
    it('should return audio types for checkins folder', () => {
      const types = service.getAllowedTypesForFolder('checkins');
      expect(types).toHaveLength(3);
      expect(types).toContain('audio/mp3');
      expect(types).toContain('audio/wav');
      expect(types).toContain('audio/m4a');
    });

    it('should return image types for visits folder', () => {
      const types = service.getAllowedTypesForFolder('visits');
      expect(types).toHaveLength(4);
      expect(types).toContain('image/jpeg');
      expect(types).toContain('image/png');
    });

    it('should return empty array for unknown folder', () => {
      const types = service.getAllowedTypesForFolder('nonexistent');
      expect(types).toEqual([]);
    });

    it('should return empty array for empty string folder', () => {
      const types = service.getAllowedTypesForFolder('');
      expect(types).toEqual([]);
    });
  });

  describe('generatePresignedUrl', () => {
    const OLD_ENV = process.env;

    beforeEach(() => {
      jest.resetModules();
      process.env = {
        ...OLD_ENV,
        S3_ENDPOINT: 'http://localhost:9000',
        S3_ACCESS_KEY: 'minioadmin',
        S3_SECRET_KEY: 'minioadmin',
        S3_BUCKET: 'care',
        S3_REGION: 'us-east-1',
      };
      (getSignedUrl as jest.Mock).mockResolvedValue('https://minio.example.com/care/checkins/uuid-file.mp3?signature=xxx');
    });

    afterAll(() => {
      process.env = OLD_ENV;
    });

    it('should generate presigned URL for valid checkins audio', async () => {
      const result = await service.generatePresignedUrl('recording.mp3', 'audio/mp3', 'checkins');
      expect(result.url).toContain('https://');
      expect(result.key).toContain('checkins/');
      expect(result.expiresIn).toBe(900);
    });

    it('should reject unsupported content type for checkins folder', async () => {
      await expect(
        service.generatePresignedUrl('bad.exe', 'application/x-msdownload', 'checkins'),
      ).rejects.toThrow('不支持的文件类型');
    });

    it('should generate presigned URL for valid visits image', async () => {
      (getSignedUrl as jest.Mock).mockResolvedValue('https://minio.example.com/care/visits/uuid-photo.jpg?signature=yyy');
      const result = await service.generatePresignedUrl('photo.jpg', 'image/jpeg', 'visits');
      expect(result.key).toContain('visits/');
    });
  });
});
