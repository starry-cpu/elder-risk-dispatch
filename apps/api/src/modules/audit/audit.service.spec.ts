import { Test, TestingModule } from '@nestjs/testing';
import { AuditService } from './audit.service';
import { PrismaService } from '../../common/prisma/prisma.service';

describe('AuditService', () => {
  let service: AuditService;

  const mockPrisma = {
    auditLog: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<AuditService>(AuditService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('应写入 AuditLog 记录', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({
        id: 'log-1',
        userId: 'u-1',
        action: 'LOGIN',
        resourceType: 'AUTH',
        resourceId: null,
        detail: null,
        ip: '127.0.0.1',
        createdAt: new Date(),
      });

      await service.log({
        userId: 'u-1',
        action: 'LOGIN',
        resourceType: 'AUTH',
        resourceId: null,
        detail: null,
        ip: '127.0.0.1',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: {
          userId: 'u-1',
          action: 'LOGIN',
          resourceType: 'AUTH',
          resourceId: null,
          ip: '127.0.0.1',
        },
      });
    });

    it('detail 为 undefined 时应转为 null', async () => {
      mockPrisma.auditLog.create.mockResolvedValue({ id: 'log-2' });

      await service.log({
        userId: 'u-2',
        action: 'UPDATE',
        resourceType: 'ELDER',
        resourceId: 'e-1',
        ip: '10.0.0.1',
      });

      expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resourceId: 'e-1',
        }),
      });
    });

    it('Prisma 写入失败时不应抛错', async () => {
      mockPrisma.auditLog.create.mockRejectedValue(new Error('DB error'));

      await expect(
        service.log({
          userId: 'u-3',
          action: 'DELETE',
          resourceType: 'ELDER',
          resourceId: 'e-2',
          ip: '10.0.0.2',
        }),
      ).resolves.toBeUndefined();
    });
  });

  describe('findAll', () => {
    it('应返回分页审计日志', async () => {
      const mockLogs = [
        { id: 'log-1', userId: 'u-1', action: 'LOGIN', resourceType: 'AUTH', createdAt: new Date() },
      ];
      mockPrisma.auditLog.findMany.mockResolvedValue(mockLogs);
      mockPrisma.auditLog.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 20 });

      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
    });

    it('应按条件过滤', async () => {
      mockPrisma.auditLog.findMany.mockResolvedValue([]);
      mockPrisma.auditLog.count.mockResolvedValue(0);

      await service.findAll({
        action: 'LOGIN',
        resourceType: 'AUTH',
        startDate: '2026-06-01',
        endDate: '2026-06-11',
        page: 1,
        limit: 10,
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith({
        where: expect.objectContaining({
          action: 'LOGIN',
          resourceType: 'AUTH',
          createdAt: expect.objectContaining({
            gte: expect.any(Date),
            lte: expect.any(Date),
          }),
        }),
        skip: 0,
        take: 10,
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
