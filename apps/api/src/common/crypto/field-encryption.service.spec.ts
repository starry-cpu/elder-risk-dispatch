// apps/api/src/common/crypto/field-encryption.service.spec.ts
import { FieldEncryptionService } from './field-encryption.service';

describe('FieldEncryptionService', () => {
  let service: FieldEncryptionService;

  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = 'dGVzdC1rZXktMzItYnl0ZXMtbG9uZyEhIQ=='; // 32 bytes base64
    service = new FieldEncryptionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should encrypt plaintext and return a different string', () => {
    const plaintext = '110101199001011234';
    const encrypted = service.encrypt(plaintext);
    expect(encrypted).not.toBe(plaintext);
    expect(typeof encrypted).toBe('string');
  });

  it('should decrypt(encrypt(x)) to return x', () => {
    const plaintexts = [
      '110101199001011234',
      '北京市朝阳区某某街道100号',
      '13800138000',
      'Hello World',
      '包含中文和English的文本',
    ];
    for (const plaintext of plaintexts) {
      const encrypted = service.encrypt(plaintext);
      const decrypted = service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    }
  });

  it('should produce different ciphertexts for the same plaintext (random IV)', () => {
    const plaintext = 'sensitive data';
    const encrypted1 = service.encrypt(plaintext);
    const encrypted2 = service.encrypt(plaintext);
    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should throw when decrypting tampered ciphertext', () => {
    const plaintext = '13800138000';
    const encrypted = service.encrypt(plaintext);
    const tampered = encrypted.slice(0, -4) + 'ffff';
    expect(() => service.decrypt(tampered)).toThrow();
  });

  it('should throw when decrypting garbage data', () => {
    expect(() => service.decrypt('not-valid-hex:data')).toThrow();
  });

  it('should handle empty string', () => {
    const encrypted = service.encrypt('');
    expect(service.decrypt(encrypted)).toBe('');
  });

  it('should handle very long strings', () => {
    const longText = 'A'.repeat(10000);
    const encrypted = service.encrypt(longText);
    expect(service.decrypt(encrypted)).toBe(longText);
  });

  it('should throw if FIELD_ENCRYPTION_KEY is not set', () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => new FieldEncryptionService()).toThrow();
  });
});
