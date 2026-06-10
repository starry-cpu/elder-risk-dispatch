// apps/api/src/common/crypto/field-encryption.service.spec.ts
import { FieldEncryptionService } from './field-encryption.service';

describe('FieldEncryptionService', () => {
  let service: FieldEncryptionService;
  let originalKey: string | undefined;

  beforeAll(() => {
    originalKey = process.env.FIELD_ENCRYPTION_KEY;
  });

  beforeEach(() => {
    process.env.FIELD_ENCRYPTION_KEY = 'MTIzNDU2Nzg5MDEyMzQ1Njc4OTAxMjM0NTY3ODkwMTI='; // 32 bytes base64
    service = new FieldEncryptionService();
  });

  afterAll(() => {
    if (originalKey === undefined) {
      delete process.env.FIELD_ENCRYPTION_KEY;
    } else {
      process.env.FIELD_ENCRYPTION_KEY = originalKey;
    }
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

  it('should produce deterministic hash for the same phone', () => {
    const hash1 = service.hashPhone('13800138000');
    const hash2 = service.hashPhone('13800138000');
    expect(hash1).toBe(hash2);
    expect(typeof hash1).toBe('string');
    expect(hash1.length).toBe(64); // SHA-256 hex
  });

  it('should produce different hashes for different phones', () => {
    const hash1 = service.hashPhone('13800138000');
    const hash2 = service.hashPhone('13900139000');
    expect(hash1).not.toBe(hash2);
  });

  it('should throw if FIELD_ENCRYPTION_KEY is not set', () => {
    delete process.env.FIELD_ENCRYPTION_KEY;
    expect(() => new FieldEncryptionService()).toThrow();
  });
});
