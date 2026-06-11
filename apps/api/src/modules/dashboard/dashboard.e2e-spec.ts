import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../../app.module';
import { AllExceptionsFilter } from '../../common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../../common/interceptors/response.interceptor';

describe('Dashboard E2E', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api/v1');
    app.useGlobalFilters(new AllExceptionsFilter());
    app.useGlobalInterceptors(new ResponseInterceptor());
    await app.init();
  });

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
