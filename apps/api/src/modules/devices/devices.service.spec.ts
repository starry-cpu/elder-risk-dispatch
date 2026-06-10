import { Test, TestingModule } from '@nestjs/testing';
import { DevicesService } from './devices.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

describe('DevicesService', () => {
  let service: DevicesService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const otherWorker = { sub: 'worker-2', role: Role.GRID_WORKER, district: '海淀区' };

  const mockPrisma = {
    elder: { findUnique: jest.fn() },
    deviceData: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DevicesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<DevicesService>(DevicesService);
    jest.clearAllMocks();
  });

  describe('ingest', () => {
    const validDto = {
      deviceId: 'dev-fall-001',
      elderId: 'elder-1',
      deviceType: 'FALL_DETECTOR',
      metricType: 'FALL',
      value: 'fall_detected',
      alarm: true,
      timestamp: Date.now(),
    };

    it('should ingest device data with alarm', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ id: 'elder-1' });
      mockPrisma.deviceData.create.mockResolvedValue({
        id: 'dd-1', elderId: 'elder-1', deviceType: 'FALL_DETECTOR',
        metricType: 'FALL', value: 'fall_detected', alarm: true,
        status: null, timestamp: new Date(),
      });

      const result = await service.ingest(validDto);
      expect(result.alarm).toBe(true);
      expect(result.metricType).toBe('FALL');
    });

    it('should ingest non-alarm device data', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ id: 'elder-1' });
      mockPrisma.deviceData.create.mockResolvedValue({
        id: 'dd-2', elderId: 'elder-1', deviceType: 'BLOOD_PRESSURE',
        metricType: 'BLOOD_PRESSURE', value: '120/80', alarm: false,
        status: null, timestamp: new Date(),
      });

      const result = await service.ingest({
        ...validDto, deviceType: 'BLOOD_PRESSURE', metricType: 'BLOOD_PRESSURE',
        value: '120/80', alarm: false,
      });
      expect(result.alarm).toBe(false);
    });

    it('should throw NotFoundException for non-existent elder', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(service.ingest(validDto)).rejects.toThrow('老人不存在');
    });
  });

  describe('findByElder', () => {
    it('should return paginated device data for same-district worker', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ id: 'elder-1', district: '朝阳区', familyLinks: [] });
      mockPrisma.deviceData.findMany.mockResolvedValue([]);
      mockPrisma.deviceData.count.mockResolvedValue(0);

      const result = await service.findByElder('elder-1', { page: 1, limit: 20 }, worker);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should reject cross-district access', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ id: 'elder-1', district: '朝阳区', familyLinks: [] });
      await expect(
        service.findByElder('elder-1', { page: 1, limit: 20 }, otherWorker),
      ).rejects.toThrow('无权限');
    });
  });
});
