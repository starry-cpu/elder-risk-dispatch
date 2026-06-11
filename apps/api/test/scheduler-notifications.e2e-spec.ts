import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Role } from '@prisma/client';

describe('Scheduler & Notifications E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;

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

    // Clean up before tests
    await prisma.schedulerRun.deleteMany();
    await prisma.notification.deleteMany();

    // Seed test data
    await prisma.user.create({
      data: {
        id: 'admin-e2e',
        name: '管理员',
        role: Role.ADMIN,
        district: '东区',
      },
    });

    await prisma.elder.create({
      data: { id: 'elder-e2e-sched', name: '测试老人', district: '东区' },
    });
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
        .expect(201);

      expect(res.body.accepted).toBe(true);
      expect(res.body.jobName).toBe('missed-checkin-scan');
    });
  });

  describe('POST /scheduler/trigger/workorder-escalate', () => {
    it('should accept manual trigger and return 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/scheduler/trigger/workorder-escalate')
        .expect(201);

      expect(res.body.accepted).toBe(true);
    });
  });

  describe('GET /scheduler/runs', () => {
    it('should return paginated run history', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/scheduler/runs')
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
    });
  });

  describe('POST /notifications/send', () => {
    it('should send notification and return record', async () => {
      const res = await request(app.getHttpServer())
        .post('/api/v1/notifications/send')
        .send({
          targetType: 'ELDER',
          targetId: 'elder-e2e-sched',
          payload: { thing1: { value: '测试通知' } },
        })
        .expect(201);

      expect(res.body.id).toBeDefined();
      expect(res.body.status).toBe('PENDING');
    });

    it('should reject invalid payload', async () => {
      await request(app.getHttpServer())
        .post('/api/v1/notifications/send')
        .send({ targetType: 'INVALID', targetId: '', payload: 'not-an-object' })
        .expect(400);
    });
  });

  describe('GET /notifications', () => {
    it('should return paginated notifications', async () => {
      const res = await request(app.getHttpServer())
        .get('/api/v1/notifications')
        .expect(200);

      expect(res.body).toHaveProperty('items');
      expect(res.body).toHaveProperty('total');
    });
  });
});
