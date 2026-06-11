// apps/api/src/modules/ai/ai.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { AiService, isAbnormalTextResult } from './ai.service';
import { AiClient } from './ai-client.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { WorkOrderType } from '@prisma/client';

describe('AiService', () => {
  let service: AiService;

  const mockAiClient = { chat: jest.fn() };

  const mockPrisma = {
    aiInferenceLog: { create: jest.fn() },
    workOrder: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AiService,
        { provide: AiClient, useValue: mockAiClient },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();
    service = module.get<AiService>(AiService);
    jest.clearAllMocks();
  });

  describe('classify', () => {
    it('应返回分类结果和置信度', async () => {
      mockAiClient.chat.mockResolvedValue('{"type":"HEALTH","confidence":0.92}');
      mockPrisma.aiInferenceLog.create.mockResolvedValue({ id: 'log-1' });

      const result = await service.classify('老人需要健康咨询');
      expect(result.type).toBe('HEALTH');
      expect(result.confidence).toBe(0.92);
      expect(mockPrisma.aiInferenceLog.create).toHaveBeenCalled();
    });

    it('低置信度应标记需要人工判断', async () => {
      mockAiClient.chat.mockResolvedValue('{"type":"LIFE","confidence":0.45}');
      mockPrisma.aiInferenceLog.create.mockResolvedValue({ id: 'log-2' });

      const result = await service.classify('不太清楚的问题');
      expect(result.confidence).toBe(0.45);
      expect(result.needsHumanReview).toBe(true);
    });

    it('应拦截诊断/治疗类请求', async () => {
      await expect(service.classify('建议服用降压药')).rejects.toThrow('医疗诊断');
    });

    it('应拦截诊断/治疗类 AI 输出', async () => {
      mockAiClient.chat.mockResolvedValue('{"type":"HEALTH","confidence":0.9,"advice":"建议进行心电图检查"}');
      mockPrisma.aiInferenceLog.create.mockResolvedValue({ id: 'log-3' });

      await expect(service.classify('老人身体不适')).rejects.toThrow('医疗诊断');
    });
  });

  describe('summarize', () => {
    it('应生成工单摘要', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue({
        id: 'wo-1', type: 'HEALTH', level: 'HIGH',
        elder: { name: '张大爷' },
        timeline: [
          { action: '创建工单', note: '老人报告身体不适', createdAt: new Date() },
        ],
      });
      mockAiClient.chat.mockResolvedValue('老人报告身体不适，已生成健康类工单');
      mockPrisma.aiInferenceLog.create.mockResolvedValue({ id: 'log-4' });

      const result = await service.summarize('wo-1');
      expect(result.summary).toContain('健康');
    });

    it('工单不存在应抛 NotFound', async () => {
      mockPrisma.workOrder.findUnique.mockResolvedValue(null);
      await expect(service.summarize('nonexistent')).rejects.toThrow('不存在');
    });
  });
});

describe('isAbnormalTextResult', () => {
  it('HEALTH + confidence >= 0.7 should be abnormal', () => {
    const result = isAbnormalTextResult({ type: 'HEALTH', confidence: 0.85, needsHumanReview: false });
    expect(result).toBe(true);
  });

  it('HEALTH + confidence = 0.7 (boundary) should be abnormal', () => {
    const result = isAbnormalTextResult({ type: 'HEALTH', confidence: 0.7, needsHumanReview: false });
    expect(result).toBe(true);
  });

  it('HEALTH + confidence < 0.7 and needsHumanReview=false should NOT be abnormal', () => {
    const result = isAbnormalTextResult({ type: 'HEALTH', confidence: 0.69, needsHumanReview: false });
    expect(result).toBe(false);
  });

  it('non-HEALTH type + high confidence should NOT be abnormal', () => {
    const result = isAbnormalTextResult({ type: 'ERRAND', confidence: 0.95, needsHumanReview: false });
    expect(result).toBe(false);
  });

  it('needsHumanReview=true should be abnormal (low confidence)', () => {
    const result = isAbnormalTextResult({ type: 'LIFE', confidence: 0.45, needsHumanReview: true });
    expect(result).toBe(true);
  });

  it('needsHumanReview=false + non-HEALTH + high confidence should NOT be abnormal', () => {
    const result = isAbnormalTextResult({ type: 'COMPANION', confidence: 0.88, needsHumanReview: false });
    expect(result).toBe(false);
  });
});
