import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';

describe('Dashboard E2E', () => {
  let app: INestApplication;

  // Mock Prisma to avoid real database dependency in E2E tests
  const mockPrisma = {
    riskEvent: { groupBy: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), findFirst: jest.fn().mockResolvedValue(null) },
    workOrder: { groupBy: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    elder: { count: jest.fn().mockResolvedValue(0), groupBy: jest.fn().mockResolvedValue([]), findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
    checkIn: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]), create: jest.fn() },
    user: { findMany: jest.fn().mockResolvedValue([]), findUnique: jest.fn().mockResolvedValue(null) },
    notification: { create: jest.fn(), findMany: jest.fn(), count: jest.fn().mockResolvedValue(0), update: jest.fn() },
    auditLog: { create: jest.fn(), findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) },
    schedulerRun: { create: jest.fn(), update: jest.fn() },
    workOrderTimeline: { create: jest.fn(), findMany: jest.fn() },
    riskRule: { findMany: jest.fn() },
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };

  beforeAll(async () => {
    // Use non-existent Redis to avoid real connection during tests
    process.env.REDIS_URL = 'redis://localhost:9999';
    process.env.NOTIFICATION_CHANNEL = 'console';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('未认证请求应返回 401 或 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/risk-overview')
      .expect((res) => {
        expect([401, 403]).toContain(res.status);
      });
  });

  it('未认证请求 work-order-efficiency 应返回 401 或 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/work-order-efficiency')
      .expect((res) => {
        expect([401, 403]).toContain(res.status);
      });
  });

  it('未认证请求 elder-coverage 应返回 401 或 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/elder-coverage')
      .expect((res) => {
        expect([401, 403]).toContain(res.status);
      });
  });

  it('未认证请求 grid-worker-performance 应返回 401 或 403', async () => {
    await request(app.getHttpServer())
      .get('/api/v1/dashboard/grid-worker-performance')
      .expect((res) => {
        expect([401, 403]).toContain(res.status);
      });
  });

  it('GET /api/v1/health should still return 200 (sanity)', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/v1/health')
      .expect(200);

    expect(response.body).toHaveProperty('code', 0);
    expect(response.body.data).toHaveProperty('status', 'ok');
  });
});
