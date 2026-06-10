import { Test, TestingModule } from '@nestjs/testing';
import { VisitsService } from './visits.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('VisitsService', () => {
  let service: VisitsService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const otherWorker = { sub: 'worker-2', role: Role.GRID_WORKER, district: '海淀区' };
  const familyUser = { sub: 'family-1', role: Role.FAMILY, district: undefined };

  const mockElder = {
    id: 'elder-1', name: '张大爷', district: '朝阳区', familyLinks: [],
  };

  const mockPrisma = {
    elder: { findUnique: jest.fn() },
    visitRecord: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VisitsService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<VisitsService>(VisitsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    const validDto = {
      elderId: 'elder-1',
      observation: '老人精神状态良好，家中水电正常',
      photos: ['https://minio/care/visits/photo1.jpg'],
      longitude: 116.4,
      latitude: 39.9,
    };

    it('should create visit for GRID_WORKER in same district', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.visitRecord.create.mockResolvedValue({
        id: 'v-1', elderId: 'elder-1', gridWorkerId: 'worker-1',
        observation: validDto.observation, photos: validDto.photos,
        note: null, visitTime: new Date(),
      });

      const result = await service.create(validDto, worker);
      expect(result.observation).toBe(validDto.observation);
      expect(result.photos).toEqual(validDto.photos);
    });

    it('should save visit with empty photos array', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.visitRecord.create.mockResolvedValue({
        id: 'v-2', elderId: 'elder-1', gridWorkerId: 'worker-1',
        observation: '例行巡访', photos: [], note: null, visitTime: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', observation: '例行巡访' },
        worker,
      );
      expect(result.photos).toEqual([]);
    });

    it('should reject non GRID_WORKER (FAMILY)', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create(validDto, familyUser),
      ).rejects.toThrow('仅网格员');
    });

    it('should reject non GRID_WORKER (ADMIN)', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create(validDto, admin),
      ).rejects.toThrow('仅网格员');
    });

    it('should reject cross-district GRID_WORKER', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create(validDto, otherWorker),
      ).rejects.toThrow('无权限');
    });

    it('should reject empty observation', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ ...validDto, observation: '' }, worker),
      ).rejects.toThrow('观察记录');
    });

    it('should throw NotFoundException when elder not found', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(
        service.create(validDto, worker),
      ).rejects.toThrow('老人不存在');
    });
  });

  describe('findAll', () => {
    it('should filter by elderId for authorized user', async () => {
      mockPrisma.visitRecord.findMany.mockResolvedValue([
        { id: 'v-1', elderId: 'elder-1', gridWorkerId: 'worker-1', observation: '一切正常', photos: [], note: null, visitTime: new Date() },
      ]);
      mockPrisma.visitRecord.count.mockResolvedValue(1);

      const result = await service.findAll({ elderId: 'elder-1', page: 1, limit: 20 }, worker);
      expect(result.items).toHaveLength(1);
    });

    it('should filter by date range', async () => {
      mockPrisma.visitRecord.findMany.mockResolvedValue([]);
      mockPrisma.visitRecord.count.mockResolvedValue(0);

      await service.findAll(
        { from: '2026-01-01', to: '2026-01-31', page: 1, limit: 20 },
        admin,
      );
      expect(mockPrisma.visitRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            visitTime: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('should restrict non-ADMIN to own district', async () => {
      mockPrisma.visitRecord.findMany.mockResolvedValue([]);
      mockPrisma.visitRecord.count.mockResolvedValue(0);

      await service.findAll({ page: 1, limit: 20 }, worker);
      expect(mockPrisma.visitRecord.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            elder: { district: '朝阳区' },
          }),
        }),
      );
    });
  });
});
