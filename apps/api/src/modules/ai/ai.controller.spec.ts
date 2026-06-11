// apps/api/src/modules/ai/ai.controller.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

describe('AiController', () => {
  let controller: AiController;

  const mockAiService = {
    classify: jest.fn().mockResolvedValue({ type: 'HEALTH', confidence: 0.9, needsHumanReview: false }),
    summarize: jest.fn().mockResolvedValue({ summary: '测试摘要' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AiController],
      providers: [{ provide: AiService, useValue: mockAiService }],
    }).compile();
    controller = module.get<AiController>(AiController);
    jest.clearAllMocks();
  });

  it('POST /ai/classify 应返回分类结果', async () => {
    const result = await controller.classify({ text: '需要维修水管' });
    expect(result).toBeDefined();
    expect(mockAiService.classify).toHaveBeenCalledWith('需要维修水管');
  });

  it('POST /ai/summarize 应返回摘要', async () => {
    const result = await controller.summarize({ workOrderId: 'wo-1' });
    expect(result.summary).toBe('测试摘要');
    expect(mockAiService.summarize).toHaveBeenCalledWith('wo-1');
  });
});
