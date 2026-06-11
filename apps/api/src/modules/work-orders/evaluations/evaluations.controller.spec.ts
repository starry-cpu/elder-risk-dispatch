import { Test, TestingModule } from '@nestjs/testing';
import { EvaluationsController } from './evaluations.controller';
import { EvaluationsService } from './evaluations.service';
import { Role } from '@prisma/client';

describe('EvaluationsController', () => {
  let controller: EvaluationsController;

  const mockService = {
    create: jest.fn(),
    findByWorkOrderId: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [EvaluationsController],
      providers: [{ provide: EvaluationsService, useValue: mockService }],
    }).compile();
    controller = module.get<EvaluationsController>(EvaluationsController);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('应调用 service.create', async () => {
      mockService.create.mockResolvedValue({ id: 'ev-1', rating: 5 });
      const result = await controller.create('wo-1',
        { rating: 5, comment: '好' },
        { sub: 'u1', role: Role.ADMIN },
      );
      expect(result!.rating).toBe(5);
    });
  });

  describe('findByWorkOrderId', () => {
    it('应返回评价', async () => {
      mockService.findByWorkOrderId.mockResolvedValue({ id: 'ev-1', rating: 5 });
      const result = await controller.findByWorkOrderId('wo-1', { sub: 'u1', role: Role.ADMIN });
      expect(result!.rating).toBe(5);
    });
  });
});
