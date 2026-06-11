import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcryptjs';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/common/prisma/prisma.service';
import { AllExceptionsFilter } from '../src/common/filters/all-exceptions.filter';
import { ResponseInterceptor } from '../src/common/interceptors/response.interceptor';
import { Role, WorkOrderType, DutyStatus } from '@prisma/client';

describe('WorkOrders E2E', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let workerToken: string;
  let elderId: string;
  let workerId: string;

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

    // Clean up any leftover test data
    await prisma.serviceEvaluation.deleteMany();
    await prisma.workOrderTimeline.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.riskEvent.deleteMany();
    await prisma.elder.deleteMany();
    await prisma.user.deleteMany();

    // Seed an elder
    const elder = await prisma.elder.create({
      data: {
        id: 'elder-e2e',
        name: '测试老人',
        district: '东区',
      },
    });
    elderId = elder.id;

    // Seed a grid worker
    const passwordHash = await bcrypt.hash('worker123', 10);
    const worker = await prisma.user.create({
      data: {
        id: 'worker-e2e',
        phone: '13900000001',
        name: '测试网格员',
        role: Role.GRID_WORKER,
        passwordHash,
        district: '东区',
        dutyStatus: DutyStatus.ON_DUTY,
        skills: ['HEALTH'],
      },
    });
    workerId = worker.id;

    // Seed an admin
    const adminHash = await bcrypt.hash('admin123', 10);
    await prisma.user.create({
      data: {
        id: 'admin-e2e',
        phone: '13900000000',
        name: '测试管理员',
        role: Role.ADMIN,
        passwordHash: adminHash,
        district: '东区',
      },
    });

    // Get tokens
    const adminLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/admin-login')
      .send({ phone: '13900000000', password: 'admin123' })
      .expect(201);
    adminToken = adminLogin.body.data.token;

    const workerLogin = await request(app.getHttpServer())
      .post('/api/v1/auth/admin-login')
      .send({ phone: '13900000001', password: 'worker123' })
      .expect(201);
    workerToken = workerLogin.body.data.token;
  });

  afterAll(async () => {
    await prisma.serviceEvaluation.deleteMany();
    await prisma.workOrderTimeline.deleteMany();
    await prisma.workOrder.deleteMany();
    await prisma.riskEvent.deleteMany();
    await prisma.elder.deleteMany();
    await prisma.user.deleteMany();
    await app.close();
  });

  let workOrderId: string;

  describe('POST /work-orders', () => {
    it('should create a work order', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          elderId,
          type: WorkOrderType.HEALTH,
          dispatchReason: 'E2E 测试创建工单',
        })
        .expect(201);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('workOrder');
      expect(response.body.data.workOrder.status).toBe('PENDING');
      expect(response.body.data.workOrder.elderId).toBe(elderId);

      workOrderId = response.body.data.workOrder.id;
    });

    it('should return 400 for non-existent elder', async () => {
      const response = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({
          elderId: 'non-existent',
          type: WorkOrderType.HEALTH,
        })
        .expect(404);

      expect(response.body.code).toBe(404);
    });
  });

  describe('GET /work-orders', () => {
    it('should return paginated list', async () => {
      const response = await request(app.getHttpServer())
        .get('/api/v1/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.code).toBe(0);
      expect(response.body.data).toHaveProperty('items');
      expect(response.body.data).toHaveProperty('total');
    });
  });

  describe('GET /work-orders/:id', () => {
    it('should return work order detail with timeline', async () => {
      const response = await request(app.getHttpServer())
        .get(`/api/v1/work-orders/${workOrderId}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(response.body.data.id).toBe(workOrderId);
      expect(response.body.data).toHaveProperty('timeline');
      expect(response.body.data.timeline).toHaveLength(1); // CREATED
    });
  });

  describe('POST /work-orders/:id/assign', () => {
    it('should assign work order to worker', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${workOrderId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assigneeId: workerId })
        .expect(201);

      expect(response.body.data.status).toBe('ASSIGNED');
      expect(response.body.data.assigneeId).toBe(workerId);
    });

    it('should reject assigning to non-assignable role', async () => {
      // Create a family user
      const famHash = await bcrypt.hash('fam123', 10);
      const fam = await prisma.user.create({
        data: {
          phone: '13900000002',
          name: '测试家属',
          role: Role.FAMILY,
          passwordHash: famHash,
        },
      });

      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${workOrderId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assigneeId: fam.id })
        .expect(400);
    });

    it('should reject illegal transition (already ASSIGNED → assign again to different user)', async () => {
      // Create another worker
      const otherHash = await bcrypt.hash('other123', 10);
      const other = await prisma.user.create({
        data: {
          phone: '13900000003',
          name: '其他网格员',
          role: Role.GRID_WORKER,
          passwordHash: otherHash,
          district: '东区',
          dutyStatus: DutyStatus.ON_DUTY,
        },
      });

      // Trying to assign an already-assigned work order should trigger state machine error
      // (use reassign instead)
      const response = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${workOrderId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assigneeId: other.id })
        .expect(500); // State machine throws plain Error → 500

      expect(response.body.code).toBe(500);
    });
  });

  describe('POST /work-orders/:id/start', () => {
    it('should start work order processing', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${workOrderId}/start`)
        .set('Authorization', `Bearer ${workerToken}`)
        .expect(201);

      expect(response.body.data.status).toBe('IN_PROGRESS');
    });

    it('should reject non-assignee starting', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${workOrderId}/start`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(500); // State machine throws plain Error
    });
  });

  describe('POST /work-orders/:id/complete', () => {
    it('should complete work order with result', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${workOrderId}/complete`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ result: '已完成处理，老人情况良好' })
        .expect(201);

      expect(response.body.data.status).toBe('COMPLETED');
      expect(response.body.data.result).toBe('已完成处理，老人情况良好');
    });

    it('should reject completing without result', async () => {
      // Create a new work order for this test
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, type: WorkOrderType.HEALTH });
      const wo2 = createRes.body.data.workOrder.id;

      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${wo2}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assigneeId: workerId });

      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${wo2}/start`)
        .set('Authorization', `Bearer ${workerToken}`);

      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${wo2}/complete`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({ result: '' })
        .expect(400);
    });
  });

  describe('POST /work-orders/:id/evaluation', () => {
    it('should submit evaluation for completed work order', async () => {
      const response = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${workOrderId}/evaluation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 5, comment: '非常满意', tags: ['及时', '专业'] })
        .expect(201);

      expect(response.body.data.rating).toBe(5);
      expect(response.body.data.comment).toBe('非常满意');
    });

    it('should reject evaluation for non-completed work order', async () => {
      // Create a new PENDING work order
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, type: WorkOrderType.LIFE });
      const wo3 = createRes.body.data.workOrder.id;

      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${wo3}/evaluation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 5 })
        .expect(400);
    });

    it('should reject duplicate evaluation', async () => {
      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${workOrderId}/evaluation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 4, comment: '再次评价' })
        .expect(400);
    });
  });

  describe('Full lifecycle: create → assign → reassign → start → complete → evaluate', () => {
    it('should complete full happy path including reassign', async () => {
      // Create another worker for reassign
      const hash2 = await bcrypt.hash('worker456', 10);
      const worker2 = await prisma.user.create({
        data: {
          phone: '13900000004',
          name: '第二网格员',
          role: Role.GRID_WORKER,
          passwordHash: hash2,
          district: '东区',
          dutyStatus: DutyStatus.ON_DUTY,
        },
      });
      // Login as worker2
      const login2 = await request(app.getHttpServer())
        .post('/api/v1/auth/admin-login')
        .send({ phone: '13900000004', password: 'worker456' })
        .expect(201);
      const worker2Token = login2.body.data.token;

      // 1. Create
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, type: WorkOrderType.REPAIR, dispatchReason: '水管坏了' })
        .expect(201);
      const woId = createRes.body.data.workOrder.id;
      expect(createRes.body.data.workOrder.status).toBe('PENDING');

      // 2. Assign to worker1
      const assignRes = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assigneeId: workerId })
        .expect(201);
      expect(assignRes.body.data.status).toBe('ASSIGNED');

      // 3. Reassign to worker2
      const reassignRes = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/reassign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ newAssigneeId: worker2.id, reason: '原接单者请假' })
        .expect(201);
      expect(reassignRes.body.data.status).toBe('ASSIGNED');
      expect(reassignRes.body.data.assigneeId).toBe(worker2.id);

      // 4. Accept / start by worker2
      const startRes = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/start`)
        .set('Authorization', `Bearer ${worker2Token}`)
        .expect(201);
      expect(startRes.body.data.status).toBe('IN_PROGRESS');

      // 5. Complete
      const completeRes = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/complete`)
        .set('Authorization', `Bearer ${worker2Token}`)
        .send({ result: '水管已修好' })
        .expect(201);
      expect(completeRes.body.data.status).toBe('COMPLETED');

      // 6. Evaluate
      const evalRes = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/evaluation`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ rating: 4, comment: '处理及时', tags: ['及时'] })
        .expect(201);
      expect(evalRes.body.data.rating).toBe(4);

      // 7. Verify timeline
      const timelineRes = await request(app.getHttpServer())
        .get(`/api/v1/work-orders/${woId}/timeline`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);
      expect(timelineRes.body.data).toHaveLength(5); // CREATED, ASSIGNED, REASSIGNED, IN_PROGRESS, COMPLETED
    });
  });

  describe('Cancel path', () => {
    it('should cancel from PENDING without reason', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, type: WorkOrderType.LIFE })
        .expect(201);
      const woId = createRes.body.data.workOrder.id;

      const response = await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/cancel`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({})
        .expect(201);

      expect(response.body.data.status).toBe('CANCELLED');
    });

    it('should reject cancel from IN_PROGRESS without reason', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, type: WorkOrderType.LIFE })
        .expect(201);
      const woId = createRes.body.data.workOrder.id;

      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/assign`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ assigneeId: workerId });

      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/start`)
        .set('Authorization', `Bearer ${workerToken}`);

      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/cancel`)
        .set('Authorization', `Bearer ${workerToken}`)
        .send({})
        .expect(500); // State machine throws: 进行中的工单取消时必须填写原因
    });

    it('should reject transition PENDING → COMPLETED', async () => {
      const createRes = await request(app.getHttpServer())
        .post('/api/v1/work-orders')
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ elderId, type: WorkOrderType.LIFE })
        .expect(201);
      const woId = createRes.body.data.workOrder.id;

      await request(app.getHttpServer())
        .post(`/api/v1/work-orders/${woId}/complete`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ result: '跳过所有状态' })
        .expect(403); // ForbiddenException: 只有接单人员可以完成工单
    });
  });
});
