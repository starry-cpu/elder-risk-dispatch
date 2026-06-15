// apps/api/src/modules/risk/rules/rules.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { RulesController } from './rules.controller';
import { RulesService } from './rules.service';
import { RiskLevel, Role } from '@prisma/client';

describe('RulesController', () => {
  let controller: RulesController;

  const mockRulesService = {
    findAll: jest.fn(), findById: jest.fn(), create: jest.fn(), update: jest.fn(), disable: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [RulesController],
      providers: [{ provide: RulesService, useValue: mockRulesService }],
    }).compile();
    controller = module.get<RulesController>(RulesController);
    jest.clearAllMocks();
  });

  it('findAll 应返回规则列表', async () => {
    mockRulesService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
    const result = await controller.findAll(1, 20);
    expect(result.total).toBe(0);
  });

  it('create 应创建新规则', async () => {
    mockRulesService.create.mockResolvedValue({ id: 'r1', name: '新规则', version: 1 });
    const result = await controller.create({ name: '新规则', condition: {}, weight: 10, level: RiskLevel.LOW }, { sub: 'u1', role: Role.ADMIN, loginType: 'admin' });
    expect(result.version).toBe(1);
  });

  it('update 应更新规则', async () => {
    mockRulesService.update.mockResolvedValue({ id: 'r1', name: '更新', version: 2 });
    const result = await controller.update('r1', { name: '更新' });
    expect(result.version).toBe(2);
  });

  it('disable 应禁用规则', async () => {
    mockRulesService.disable.mockResolvedValue({ id: 'r1', enabled: false });
    const result = await controller.disable('r1');
    expect(result.enabled).toBe(false);
  });
});
