// apps/api/src/modules/ai/ai-client.service.ts
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import OpenAI from 'openai';

export const OPENAI_CLIENT = 'OPENAI_CLIENT';

@Injectable()
export class AiClient {
  private model: string;

  constructor(@Inject(OPENAI_CLIENT) private client: OpenAI) {
    this.model = process.env.AI_MODEL ?? 'deepseek-chat';
  }

  async chat(messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>): Promise<string> {
    if (!process.env.OPENAI_API_KEY) {
      throw new InternalServerErrorException('OPENAI_API_KEY 未配置，无法调用 AI 服务');
    }

    const maxRetries = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await this.client.chat.completions.create({
          model: this.model,
          messages,
          temperature: 0.1,
          max_tokens: 500,
        });

        const content = response.choices[0]?.message?.content;
        if (!content) throw new InternalServerErrorException('AI 返回空响应');

        return content;
      } catch (err: any) {
        lastError = err;
        if (attempt < maxRetries) {
          await this.sleep(Math.pow(2, attempt) * 500);
        }
      }
    }

    throw new InternalServerErrorException(`AI 调用失败: ${lastError?.message}`);
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
