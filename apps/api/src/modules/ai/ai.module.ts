// apps/api/src/modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { AiClient, OPENAI_CLIENT } from './ai-client.service';
import { AiController } from './ai.controller';
import { AiService } from './ai.service';

@Module({
  controllers: [AiController],
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: () => {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error('OPENAI_API_KEY environment variable is required for AiModule');
        }
        return new OpenAI({
          apiKey,
          baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.deepseek.com',
        });
      },
    },
    AiClient,
    AiService,
  ],
  exports: [AiClient, AiService],
})
export class AiModule {}
