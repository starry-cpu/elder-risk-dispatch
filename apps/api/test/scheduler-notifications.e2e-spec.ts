import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { FieldEncryptionService } from '../src/common/crypto/field-encryption.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Role } from '@prisma/client';

describe('Scheduler & Notifications E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cryptoService: FieldEncryptionService;
  let adminToken: string;
  let elderId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();

    prisma = app.get(PrismaService);
    cryptoService = app.get(FieldEncryptionService);

    // Clean up all related tables before seeding
    await prisma.schedulerRun.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.serviceEvaluation.deleteMany();
    await prisma.workOrderTimeline.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.riskEvent.deleteMany();
    await prisma.elder.deleteMany();
    await prisma.user.deleteMany();

    // Seed admin user with proper credentials
    const adminPhone = '13800000000';
    const adminPhoneEncrypted = cryptoService.encrypt(adminPhone);
    const adminPhoneHash = cryptoService.hashPhone(adminPhone);
    const adminPasswordHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        id: 'admin-e2e',
        name: '管理员',
        role: Role.ADMIN,
        phone: adminPhoneEncrypted,
        phoneHash: adminPhoneHash,
        passwordHash: adminPasswordHash,
        district: '东区',
      },
    });

    // Seed an elder
    const elder = await prisma.elder.create({
      data: { id: 'elder-e2e-sched', name: '测试老人', district: '东区' },
    });
    elderId = elder.id;

    // Login to get admin token
    const loginRes = await request(app.getHttpServer())
      .post('/api/v1/auth/admin-login')
      .send({ phone: adminPhone, password: 'admin123' });
    adminToken = loginRes.body.data?.token ?? loginRes.body.token;
  });

  afterAll(async () => {
    await prisma.schedulerRun.deleteMany();
    await prisma.notification.deleteMany();
    await prisma.workOrderTimeline.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.riskEvent.deleteMany();
    await prisma.elder.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  describe('POST /scheduler/trigger/missed-checkin', () => {
    it('should accept manual trigger and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/scheduler/trigger/missed-checkin')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.data.accepted).toBe(true);
      expect(res.body.data.jobName).toBe('missed-checkin-scan');
    });

    it('should reject unauthenticated requests', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/scheduler/trigger/missed-checkin')
        .expect(401);

      expect(res.status).toBe(401);
    });
  });

  describe('POST /scheduler/trigger/workorder-escalate', () => {
    it('should accept manual trigger and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/scheduler/trigger/workorder-escalate')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(201);

      expect(res.body.data.accepted).toBe(true);
      expect(res.body.data.jobName).toBe('workorder-timeout-escalate');
    });
  });

  describe('GET /scheduler/runs', () => {
    it('should return paginated run history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/scheduler/runs')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });
  });

  describe('POST /notifications/send', () => {
    it('should send notification and return record', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          targetType: 'ELDER',
          targetId: elderId,
          payload: { thing1: { value: '测试通知' } },
        })
        .expect(201);

      expect(res.body.data.id).toBeDefined();
      expect(res.body.data.status).toBe('PENDING');
    });

    it('should reject invalid payload', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/send')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ targetType: 'INVALID', targetId: '', payload: 'not-an-object' })
        .expect(400);

      expect(res.status).toBe(400);
    });
  });

  describe('GET /notifications', () => {
    it('should return paginated notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(res.body.data).toHaveProperty('items');
      expect(res.body.data).toHaveProperty('total');
    });
  });
});
