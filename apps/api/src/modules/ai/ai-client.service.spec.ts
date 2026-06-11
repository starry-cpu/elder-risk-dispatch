// apps/api/src/modules/ai/ai-client.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AiClient, OPENAI_CLIENT } from './ai-client.service';

describe('AiClient', () => {
  let service: AiClient;
  let mockCreate: jest.Mock;

  beforeEach(async () => {
    process.env.AI_MODEL = 'deepseek-chat';

    mockCreate = jest.fn();

    const mockClient = {
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiClient,
        {
          provide: OPENAI_CLIENT,
          useValue: mockClient,
        },
      ],
    }).compile();

    service = module.get<AiClient>(AiClient);
    jest.clearAllMocks();
  });

  describe('chat', () => {
    it('应返回 LLM 响应内容', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '{"type":"HEALTH","confidence":0.9}' } }],
      });

      const result = await service.chat([{ role: 'user', content: 'test' }]);
      expect(result).toContain('HEALTH');
    });

    it('LLM 返回空时应抛错', async () => {
      mockCreate.mockResolvedValue({ choices: [] });
      await expect(service.chat([{ role: 'user', content: 'test' }])).rejects.toThrow('空响应');
    });

    it('API 调用失败应重试', async () => {
      mockCreate
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValue({ choices: [{ message: { content: 'ok' } }] });

      const result = await service.chat([{ role: 'user', content: 'test' }]);
      expect(result).toBe('ok');
      expect(mockCreate).toHaveBeenCalledTimes(3);
    });
  });
});
