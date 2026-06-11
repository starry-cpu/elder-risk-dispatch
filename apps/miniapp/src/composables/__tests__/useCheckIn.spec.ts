import { describe, it, expect } from 'vitest';
import { useCheckIn } from '../useCheckIn';

describe('useCheckIn', () => {
  it('validates elderId is required', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: '', method: 'ONE_TAP' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('老人ID');
  });
  it('validates method is required', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: '' });
    expect(result.valid).toBe(false);
  });
  it('passes valid ONE_TAP check-in', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'ONE_TAP' });
    expect(result.valid).toBe(true);
  });
  it('passes valid TEXT check-in with content', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'TEXT', content: '一切正常' });
    expect(result.valid).toBe(true);
  });
  it('rejects TEXT method without content', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'TEXT', content: '' });
    expect(result.valid).toBe(false);
    expect(result.message).toContain('内容');
  });
  it('accepts VOICE method with voiceUrl', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'VOICE', voiceUrl: 'https://example.com/audio.mp3' });
    expect(result.valid).toBe(true);
  });
  it('rejects VOICE method without voiceUrl', () => {
    const { validate } = useCheckIn();
    const result = validate({ elderId: 'e1', method: 'VOICE', voiceUrl: '' });
    expect(result.valid).toBe(false);
  });
  it('generates method labels', () => {
    const { methodLabels } = useCheckIn();
    expect(methodLabels.ONE_TAP).toBe('一键报平安');
    expect(methodLabels.VOICE).toBe('语音报平安');
    expect(methodLabels.TEXT).toBe('文字报平安');
  });
});
