// Must be set before any NestJS module import (HmacService requires it in constructor)
process.env.DEVICE_HMAC_SECRET = 'e2e-test-hmac-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FieldEncryptionService } from '../src/common/crypto/field-encryption.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Role } from '@prisma/client';

const HMAC_SECRET = 'e2e-test-hmac-secret';

function signPayload(payload: Record<string, unknown>): { signature: string; timestamp: string } {
  const timestamp = Date.now();
  const normalized = JSON.stringify(payload, Object.keys(payload).sort());
  const message = `${timestamp}.${normalized}`;
  const signature = crypto.createHmac('sha256', HMAC_SECRET).update(message).digest('hex');
  return { signature, timestamp: String(timestamp) };
}

describe('Devices E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let elderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
    const cryptoService = app.get(FieldEncryptionService);

    // Seed admin user
    const passwordHash = await bcrypt.hash('admin123', 10);
    const phone = '13800000002';
    const encryptedPhone = cryptoService.encrypt(phone);
    const phoneHash = cryptoService.hashPhone(phone);

    await prisma.user.upsert({
      where: { phoneHash },
      update: {},
      create: {
        phone: encryptedPhone,
        phoneHash,
        name: 'E2E Devices Admin',
        role: Role.ADMIN,
        passwordHash,
        district: '朝阳区',
      },
    });

    // Login
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/admin-login')
      .send({ phone, password: 'admin123' })
      .expect(201);
    adminToken = loginRes.body.data.token;

    // Create test elder
    const elderRes = await request(app.getHttpServer())
      .post('/api/v1/elders')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({
        name: 'E2E设备测试老人',
        gender: 'M',
        birthDate: '1945-06-15',
        idCard: '110101194506151234',
        address: '朝阳区某某路200号',
        district: '朝阳区',
        healthTags: ['独居'],
        serviceLevel: 'KEY',
      })
      .expect(201);
    elderId = elderRes.body.data.id;
  });

  afterAll(async () => {
    if (elderId) {
      await prisma.deviceData.deleteMany({ where: { elderId } }).catch(() => {});
      await prisma.elder.delete({ where: { id: elderId } }).catch(() => {});
    }
    await app.close();
  });

  describe('POST /api/v1/devices/data', () => {
    it('should accept valid HMAC-signed device data', async () => {
      const payload = {
        deviceId: 'dev-fall-e2e-001',
        elderId,
        deviceType: 'FALL_DETECTOR',
        metricType: 'FALL',
        value: 'fall_event',
        alarm: true,
        timestamp: Date.now(),
      };
      const { signature, timestamp } = signPayload(payload);

      const res = await request(app.getHttpServer())
        .post('/api/v1/devices/data')
        .set('X-HMAC-Signature', signature)
        .set('X-HMAC-Timestamp', timestamp)
        .set('X-Device-Id', 'dev-fall-e2e-001')
        .send(payload)
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data.alarm).toBe(true);
      expect(res.body.data.deviceType).toBe('FALL_DETECTOR');
    });

    it('should accept non-alarm device data', async () => {
      const payload = {
        deviceId: 'dev-bp-e2e-001',
        elderId,
        deviceType: 'BLOOD_PRESSURE',
        metricType: 'BLOOD_PRESSURE',
        value: '120/80',
        alarm: false,
        timestamp: Date.now(),
      };
      const { signature, timestamp } = signPayload(payload);

      const res = await request(app.getHttpServer())
        .post('/api/v1/devices/data')
        .set('X-HMAC-Signature', signature)
        .set('X-HMAC-Timestamp', timestamp)
        .set('X-Device-Id', 'dev-bp-e2e-001')
        .send(payload)
        .expect(201);

      expect(res.body.data.alarm).toBe(false);
    });

    it('should reject missing HMAC signature', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/devices/data')
        .send({
          deviceId: 'dev-smoke-e2e',
          elderId,
          deviceType: 'SMOKE',
          metricType: 'SMOKE',
          alarm: false,
          timestamp: Date.now(),
        })
        .expect(401);
    });

    it('should reject invalid HMAC signature', async () => {
      const payload = {
        deviceId: 'dev-fall-e2e-002',
        elderId,
        deviceType: 'FALL_DETECTOR',
        metricType: 'FALL',
        alarm: false,
        timestamp: Date.now(),
      };
      const { timestamp } = signPayload(payload);

      await request(app.getHttpServer())
        .post('/api/v1/devices/data')
        .set('X-HMAC-Signature', 'invalid-signature-deadbeef')
        .set('X-HMAC-Timestamp', timestamp)
        .set('X-Device-Id', 'dev-fall-e2e-002')
        .send(payload)
        .expect(401);
    });

    it('should reject expired timestamp', async () => {
      const oldTimestamp = Date.now() - 10 * 60 * 1000; // 10 minutes ago
      const payload = {
        deviceId: 'dev-old-e2e',
        elderId,
        deviceType: 'HEART_RATE',
        metricType: 'BPM',
        value: '72',
        alarm: false,
        timestamp: oldTimestamp,
      };
      const { signature } = signPayload(payload);

      await request(app.getHttpServer())
        .post('/api/v1/devices/data')
        .set('X-HMAC-Signature', signature)
        .set('X-HMAC-Timestamp', String(oldTimestamp))
        .set('X-Device-Id', 'dev-old-e2e')
        .send(payload)
        .expect(401);
    });
  });

  describe('GET /api/v1/elders/:id/devices', () => {
    it('should list devices data for elder', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/elders/${elderId}/devices`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
      expect(Array.isArray(res.body.data.items)).toBe(true);
    });

    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/elders/${elderId}/devices`)
        .expect(401);
    });
  });
});
