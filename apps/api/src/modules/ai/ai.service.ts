// apps/api/src/modules/ai/ai.service.ts
import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { AiClient } from './ai-client.service';
import { PrismaService } from '../../common/prisma/prisma.service';

const MEDICAL_KEYWORDS = [
  '诊断', '治疗', '用药', '处方', '手术', '病理', '复查医嘱',
  '血压控制', '血糖调节', '服用', '剂量', '临床', '预后',
  '心电图', 'CT', 'B超', '化验', '检查结果提示',
];

@Injectable()
export class AiService {
  constructor(
    private readonly aiClient: AiClient,
    private readonly prisma: PrismaService,
  ) {}

  async classify(text: string): Promise<{ type: string; confidence: number; needsHumanReview: boolean }> {
    this.validateNoMedicalAdvice(text);

    const response = await this.aiClient.chat([
      {
        role: 'system',
        content: `你是一个社区服务分类助手。将用户描述分类为以下类型之一：HEALTH（健康）、LIFE（生活）、REPAIR（维修）、ESCORT（陪诊）、COMPANION（陪伴）、ERRAND（代购代办事）。仅返回JSON格式：{"type":"...","confidence":0.0-1.0}。不要包含诊断或治疗建议。`,
      },
      { role: 'user', content: text },
    ]);

    let parsed: { type: string; confidence: number; advice?: string };
    try {
      parsed = JSON.parse(response);
    } catch {
      parsed = { type: 'LIFE', confidence: 0.3 };
    }

    // Compliance check on output
    const outputStr = JSON.stringify(parsed);
    this.validateNoMedicalAdvice(outputStr);

    await this.prisma.aiInferenceLog.create({
      data: {
        type: 'CLASSIFY',
        model: process.env.AI_MODEL ?? 'deepseek-chat',
        input: { text },
        output: parsed,
      },
    });

    return {
      type: parsed.type ?? 'LIFE',
      confidence: parsed.confidence ?? 0.5,
      needsHumanReview: (parsed.confidence ?? 0.5) < 0.6,
    };
  }

  async summarize(workOrderId: string): Promise<{ summary: string }> {
    const wo = await this.prisma.workOrder.findUnique({
      where: { id: workOrderId },
      include: {
        elder: { select: { name: true } },
        timeline: { select: { action: true, note: true, createdAt: true }, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!wo) throw new NotFoundException('工单不存在');

    const context = `老人: ${wo.elder.name}, 类型: ${wo.type}, 级别: ${wo.level}, 时间线: ${JSON.stringify(wo.timeline)}`;

    const response = await this.aiClient.chat([
      {
        role: 'system',
        content: '你是一个社区服务记录助手。根据工单信息生成简洁、客观的服务摘要（不超过100字）。不要包含诊断、治疗或用药建议。',
      },
      { role: 'user', content: context },
    ]);

    this.validateNoMedicalAdvice(response);

    await this.prisma.aiInferenceLog.create({
      data: {
        type: 'SUMMARY',
        model: process.env.AI_MODEL ?? 'deepseek-chat',
        input: { workOrderId, context },
        output: { summary: response },
      },
    });

    return { summary: response };
  }

  private validateNoMedicalAdvice(text: string): void {
    for (const keyword of MEDICAL_KEYWORDS) {
      if (text.includes(keyword)) {
        throw new BadRequestException(`内容包含医疗诊断相关词汇"${keyword}"，系统不允许输出医疗建议`);
      }
    }
  }
}

/**
 * Determines whether an AI classification result represents "abnormal text".
 * Pure function — no external dependencies, easy to unit test and reuse.
 *
 * Abnormal detection rules:
 * - HEALTH type + confidence ≥ 0.7 → elder actively expressing health concerns
 * - needsHumanReview === true (confidence < 0.6) → text is ambiguous, possible cognitive anomaly
 */
export function isAbnormalTextResult(result: {
  type: string;
  confidence: number;
  needsHumanReview: boolean;
}): boolean {
  if (result.type === 'HEALTH' && result.confidence >= 0.7) return true;
  if (result.needsHumanReview) return true;
  return false;
}
