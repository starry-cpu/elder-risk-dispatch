import { Test, TestingModule } from '@nestjs/testing';
import { HmacService } from './hmac.service';

describe('HmacService', () => {
  let service: HmacService;

  const OLD_ENV = process.env;

  beforeAll(() => {
    process.env = { ...OLD_ENV, DEVICE_HMAC_SECRET: 'test-shared-secret' };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [HmacService],
    }).compile();
    service = module.get<HmacService>(HmacService);
  });

  describe('sign', () => {
    it('should produce deterministic signature for same inputs', () => {
      const payload = { deviceId: 'dev-1', elderId: 'elder-1', alarm: false };
      const timestamp = 1700000000000;
      const sig1 = service.sign(payload, timestamp);
      const sig2 = service.sign(payload, timestamp);
      expect(sig1).toBe(sig2);
    });

    it('should produce different signatures for different payloads', () => {
      const sig1 = service.sign({ a: 1 }, 1700000000000);
      const sig2 = service.sign({ a: 2 }, 1700000000000);
      expect(sig1).not.toBe(sig2);
    });

    it('should produce different signatures for different timestamps', () => {
      const sig1 = service.sign({ a: 1 }, 1700000000000);
      const sig2 = service.sign({ a: 1 }, 1700000000001);
      expect(sig1).not.toBe(sig2);
    });
  });

  describe('verify', () => {
    it('should verify a valid signature', () => {
      const payload = { deviceId: 'dev-1', elderId: 'elder-1', deviceType: 'FALL_DETECTOR', metricType: 'FALL', alarm: false };
      const timestamp = Date.now();
      const signature = service.sign(payload, timestamp);
      expect(service.verify('dev-1', payload, signature, timestamp)).toBe(true);
    });

    it('should reject tampered payload', () => {
      const payload = { alarm: false };
      const timestamp = Date.now();
      const signature = service.sign(payload, timestamp);
      const tamperedPayload = { alarm: true };
      expect(service.verify('dev-1', tamperedPayload, signature, timestamp)).toBe(false);
    });

    it('should reject expired timestamp (>5 minutes)', () => {
      const payload = { test: true };
      const expiredTimestamp = Date.now() - 6 * 60 * 1000;
      const signature = service.sign(payload, expiredTimestamp);
      expect(service.verify('dev-1', payload, signature, expiredTimestamp)).toBe(false);
    });

    it('should reject future timestamp (>5 minutes)', () => {
      const payload = { test: true };
      const futureTimestamp = Date.now() + 6 * 60 * 1000;
      const signature = service.sign(payload, futureTimestamp);
      expect(service.verify('dev-1', payload, signature, futureTimestamp)).toBe(false);
    });

    it('should accept timestamp exactly at boundary (+5 min)', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const payload = { test: true };
      const boundaryTimestamp = now + 5 * 60 * 1000;
      const signature = service.sign(payload, boundaryTimestamp);
      expect(service.verify('dev-1', payload, signature, boundaryTimestamp)).toBe(true);
    });

    it('should accept timestamp exactly at boundary (-5 min)', () => {
      const now = 1700000000000;
      jest.spyOn(Date, 'now').mockReturnValue(now);
      const payload = { test: true };
      const boundaryTimestamp = now - 5 * 60 * 1000;
      const signature = service.sign(payload, boundaryTimestamp);
      expect(service.verify('dev-1', payload, signature, boundaryTimestamp)).toBe(true);
    });

    it('should normalize JSON key order for consistent signatures', () => {
      const payload1 = { b: 2, a: 1 };
      const payload2 = { a: 1, b: 2 };
      const timestamp = 1700000000000;
      const sig1 = service.sign(payload1, timestamp);
      const sig2 = service.sign(payload2, timestamp);
      expect(sig1).toBe(sig2);
    });

    it('should throw when DEVICE_HMAC_SECRET is not set', () => {
      const oldSecret = process.env.DEVICE_HMAC_SECRET;
      delete process.env.DEVICE_HMAC_SECRET;
      expect(() => new HmacService()).toThrow('DEVICE_HMAC_SECRET');
      process.env.DEVICE_HMAC_SECRET = oldSecret;
    });
  });
});
