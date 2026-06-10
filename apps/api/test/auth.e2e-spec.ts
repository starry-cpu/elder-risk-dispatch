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

describe('Auth E2E', () => {
  let app: INestApplication;
  let adminToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    // Seed test admin user — use the same encryption path as production
    const prisma = app.get(PrismaService);
    const cryptoService = app.get(FieldEncryptionService);
    const passwordHash = await bcrypt.hash('admin123', 10);
    const phone = '13800000000';
    const encryptedPhone = cryptoService.encrypt(phone);
    const phoneHash = cryptoService.hashPhone(phone);

    await prisma.user.upsert({
      where: { phoneHash },
      update: {},
      create: {
        phone: encryptedPhone,
        phoneHash,
        name: '系统管理员',
        role: Role.ADMIN,
        passwordHash,
        district: '朝阳区',
      },
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('POST /auth/admin-login', () => {
    it('should return token for valid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/admin-login')
        .send({ phone: '13800000000', password: 'admin123' })
        .expect(201);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('token');
      expect(response.body.data).toHaveProperty('user');
      expect(response.body.data.user.role).toBe('ADMIN');

      adminToken = response.body.data.token;
    });

    it('should return 401 for invalid credentials', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/auth/admin-login')
        .send({ phone: '13800000000', password: 'wrongpass' })
        .expect(401);

      expect(response.body.code).toBe(401);
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user with valid token', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('sub');
      expect(response.body.data).toHaveProperty('role', 'ADMIN');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/auth/me')
        .expect(401);
    });
  });

  describe('RBAC enforcement', () => {
    it('should reject unauthenticated request to /users', async () => {
      await request(app.getHttpServer())
        .get('/api/v1/users')
        .expect(401);
    });

    it('should allow ADMIN to access /users', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/users')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data).toHaveProperty('items');
    });
  });
});
