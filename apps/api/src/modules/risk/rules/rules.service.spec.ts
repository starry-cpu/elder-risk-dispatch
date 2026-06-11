// apps/api/src/modules/risk/rules/rules.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RulesService } from './rules.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RiskLevel } from '@prisma/client';

describe('RulesService', () => {
  let service: RulesService;

  const mockRule = {
    id: 'rule-1', name: '连续未报平安', condition: { field: 'hoursSinceLastCheckIn', operator: 'gte', value: 24 },
    weight: 40, level: RiskLevel.MEDIUM, version: 1, enabled: true, createdById: null, updatedAt: new Date(),
  };

  const mockPrisma = {
    riskRule: {
      findMany: jest.fn(), findUnique: jest.fn(), findFirst: jest.fn(),
      create: jest.fn(), update: jest.fn(),
      count: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<RulesService>(RulesService);
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('应返回所有规则列表', async () => {
      mockPrisma.riskRule.findMany.mockResolvedValue([mockRule]);
      mockPrisma.riskRule.count.mockResolvedValue(1);
      const result = await service.findAll({ page: 1, limit: 20 });
      expect(result.items).toHaveLength(1);
    });
  });

  describe('create', () => {
    it('应创建新规则 version=1', async () => {
      mockPrisma.riskRule.create.mockResolvedValue(mockRule);
      const result = await service.create({
        name: '新规则', condition: { field: 'test', operator: 'eq', value: 1 },
        weight: 10, level: RiskLevel.LOW,
      }, 'admin-1');
      expect(result.version).toBe(1);
    });
  });

  describe('update', () => {
    it('应更新规则并自增 version', async () => {
      mockPrisma.riskRule.findUnique.mockResolvedValue(mockRule);
      mockPrisma.riskRule.update.mockResolvedValue({ ...mockRule, weight: 50, version: 2 });
      const result = await service.update('rule-1', { weight: 50 });
      expect(result.version).toBe(2);
      expect(result.weight).toBe(50);
    });

    it('更新不存在的规则应抛 NotFound', async () => {
      mockPrisma.riskRule.findUnique.mockResolvedValue(null);
      await expect(service.update('nonexistent', { weight: 50 })).rejects.toThrow('不存在');
    });
  });

  describe('disable', () => {
    it('应禁用规则（enabled=false）', async () => {
      mockPrisma.riskRule.findUnique.mockResolvedValue(mockRule);
      mockPrisma.riskRule.update.mockResolvedValue({ ...mockRule, enabled: false });
      const result = await service.disable('rule-1');
      expect(result.enabled).toBe(false);
    });
  });
});
