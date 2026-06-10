import { Injectable } from '@nestjs/common';

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
  validateContentType(contentType: string, allowed: string[]): boolean {
    if (!contentType) return false;
    return allowed.includes(contentType);
  }

  getAllowedTypesForFolder(folder: string): string[] {
    return FOLDER_ALLOWED_TYPES[folder] || [];
  }
}
