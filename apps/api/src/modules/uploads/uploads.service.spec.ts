import { Test, TestingModule } from '@nestjs/testing';
import { UploadsService } from './uploads.service';

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
});
