import { ref } from 'vue';

export interface VisitFormInput {
  elderId: string;
  observation: string;
  photos?: string[];
  note?: string;
}

export interface ValidationResult {
  valid: boolean;
  message?: string;
}

export function useVisitForm() {
  const photos = ref<string[]>([]);
  const submitting = ref(false);
  const MAX_PHOTOS = 9;

  function validate(input: VisitFormInput): ValidationResult {
    if (!input.elderId || input.elderId.trim().length === 0) {
      return { valid: false, message: '请选择老人' };
    }
    if (!input.observation || input.observation.trim().length === 0) {
      return { valid: false, message: '请填写观察记录' };
    }
    return { valid: true };
  }

  function addPhoto(url: string): boolean {
    if (photos.value.length >= MAX_PHOTOS) return false;
    photos.value = [...photos.value, url];
    return true;
  }

  function removePhoto(url: string) {
    photos.value = photos.value.filter(p => p !== url);
  }

  function clearPhotos() { photos.value = []; }

  return { photos, submitting, MAX_PHOTOS, validate, addPhoto, removePhoto, clearPhotos };
}
