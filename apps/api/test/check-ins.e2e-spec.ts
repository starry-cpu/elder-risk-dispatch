// Must be set before AppModule import (HmacService requires it)
process.env.DEVICE_HMAC_SECRET = 'e2e-test-hmac-secret';

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FieldEncryptionService } from '../src/common/crypto/field-encryption.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Role } from '@prisma/client';

describe('CheckIns E2E', () => {
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
    const phone = '13800000001';
    const encryptedPhone = cryptoService.encrypt(phone);
    const phoneHash = cryptoService.hashPhone(phone);

    await prisma.user.upsert({
      where: { phoneHash },
      update: {},
      create: {
        phone: encryptedPhone,
        phoneHash,
        name: 'E2E CheckIn Admin',
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
        name: 'E2E报平安测试老人',
        gender: 'M',
        birthDate: '1945-03-10',
        idCard: '110101194503101234',
        address: '朝阳区某某路100号',
        district: '朝阳区',
        healthTags: ['慢病'],
        serviceLevel: 'KEY',
      })
      .expect(201);
    elderId = elderRes.body.data.id;
  });

  afterAll(async () => {
    if (elderId) {
      await prisma.checkIn.deleteMany({ where: { elderId } }).catch(() => {});
      await prisma.elder.delete({ where: { id: elderId } }).catch(() => {});
    }
    await app.close();
  });

  describe('POST /api/v1/check-ins', () => {
    it('should create ONE_TAP check-in', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, method: 'ONE_TAP' })
        .expect(201);

      expect(res.body.code).toBe(0);
      expect(res.body.data.method).toBe('ONE_TAP');
      expect(res.body.data.status).toBe('NORMAL');
    });

    it('should create TEXT check-in with content', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, method: 'TEXT', content: '今天一切正常' })
        .expect(201);

      expect(res.body.data.content).toBe('今天一切正常');
    });

    it('should reject TEXT without content', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, method: 'TEXT' })
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('should reject VOICE without voiceUrl', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, method: 'VOICE' })
        .expect(400);

      expect(res.body.code).toBe(400);
    });

    it('should reject non-existent elder', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId: '00000000-0000-0000-0000-000000000000', method: 'ONE_TAP' })
        .expect(404);

      expect(res.body.code).toBe(404);
    });

    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/check-ins')
        .send({ elderId, method: 'ONE_TAP' })
        .expect(401);
    });
  });

  describe('GET /api/v1/elders/:id/check-ins', () => {
    it('should list check-ins for elder', async () => {
      const res = await request(app.getHttpServer())
        .get(`/api/v1/elders/${elderId}/check-ins`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.code).toBe(0);
      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
      expect(Array.isArray(res.body.data.items)).toBe(true);
      expect(res.body.data.total).toBeGreaterThanOrEqual(0);
    });

    it('should reject unauthenticated request', async () => {
      await request(app.getHttpServer())
        .get(`/api/v1/elders/${elderId}/check-ins`)
        .expect(401);
    });
  });
});
