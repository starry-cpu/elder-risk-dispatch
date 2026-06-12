import { describe, it, expect } from 'vitest';
import { useVisitForm } from '../useVisitForm';

describe('useVisitForm', () => {
  it('rejects empty form submission', () => {
    const { validate } = useVisitForm();
    const result = validate({ elderId: '', observation: '' });
    expect(result.valid).toBe(false);
  });
  it('requires elderId', () => {
    const { validate } = useVisitForm();
    const result = validate({ elderId: '', observation: '观察内容' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('老人');
  });
  it('requires observation', () => {
    const { validate } = useVisitForm();
    const result = validate({ elderId: 'e1', observation: '' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('观察记录');
  });
  it('passes valid form', () => {
    const { validate } = useVisitForm();
    const result = validate({ elderId: 'e1', observation: '老人状态良好' });
    expect(result.valid).toBe(true);
  });
  it('passes form with optional photos and note', () => {
    const { validate } = useVisitForm();
    const result = validate({ elderId: 'e1', observation: '巡访记录', photos: ['url1', 'url2'], note: '备注信息' });
    expect(result.valid).toBe(true);
  });
  it('manages photo list', () => {
    const { photos, addPhoto, removePhoto, MAX_PHOTOS } = useVisitForm();
    expect(photos.value).toHaveLength(0);
    addPhoto('url1');
    addPhoto('url2');
    expect(photos.value).toHaveLength(2);
    removePhoto('url1');
    expect(photos.value).toHaveLength(1);
    expect(photos.value[0]).toBe('url2');
  });
  it('enforces max photo count', () => {
    const { addPhoto, MAX_PHOTOS } = useVisitForm();
    for (let i = 0; i < MAX_PHOTOS; i++) addPhoto(`url${i}`);
    expect(addPhoto('overflow')).toBe(false);
  });
});
