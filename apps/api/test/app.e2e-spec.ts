import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';

describe('App E2E', () => {
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

  it('GET /api/v1/health should return 200 with status ok', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toHaveProperty('code', 0);
    expect(response.body.data).toHaveProperty('status', 'ok');
    expect(response.body.data).toHaveProperty('db');
    expect(response.body.message).toBe('ok');
  });

  it('GET /api/v1/health returns wrapped response format', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/health').expect(200);

    expect(response.body).toHaveProperty('code');
    expect(response.body).toHaveProperty('data');
    expect(response.body).toHaveProperty('message');
  });

  it('GET /api/v1/nonexistent returns 404 in error format', async () => {
    const response = await request(app.getHttpServer()).get('/api/v1/nonexistent').expect(404);

    expect(response.body).toHaveProperty('code', 404);
    expect(response.body.data).toBeNull();
    expect(response.body).toHaveProperty('message');
  });
});
