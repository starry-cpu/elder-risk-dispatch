import { Injectable } from '@nestjs/common';
import * as crypto from 'crypto';

@Injectable()
export class HmacService {
  private readonly secret: Buffer;

  constructor() {
    const secretStr = process.env.DEVICE_HMAC_SECRET;
    if (!secretStr) {
      throw new Error('DEVICE_HMAC_SECRET environment variable is required');
    }
    this.secret = Buffer.from(secretStr, 'utf-8');
  }

  /**
   * Generate HMAC-SHA256 signature for a payload + timestamp.
   * Payload keys are sorted for determinism.
   * deviceId is accepted but currently unused (reserved for per-device key extension).
   */
  sign(payload: Record<string, unknown>, timestamp: number): string {
    const normalized = this.normalizePayload(payload);
    const message = `${timestamp}.${normalized}`;
    return crypto.createHmac('sha256', this.secret).update(message).digest('hex');
  }

  /**
   * Verify HMAC signature with replay protection (+-5 minutes window).
   */
  verify(deviceId: string, payload: Record<string, unknown>, signature: string, timestamp: number): boolean {
    const now = Date.now();
    const drift = Math.abs(now - timestamp);
    if (drift > 5 * 60 * 1000) {
      return false;
    }

    const expected = this.sign(payload, timestamp);
    const expectedBuf = Buffer.from(expected, 'hex');
    const signatureBuf = Buffer.from(signature, 'hex');

    // timingSafeEqual requires equal-length buffers; reject early on length mismatch
    if (expectedBuf.length !== signatureBuf.length) {
      return false;
    }

    return crypto.timingSafeEqual(expectedBuf, signatureBuf);
  }

  private normalizePayload(payload: Record<string, unknown>): string {
    return JSON.stringify(payload, Object.keys(payload).sort());
  }
}
