// apps/api/src/modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { AiClient, OPENAI_CLIENT } from './ai-client.service';

@Module({
  providers: [
    {
      provide: OPENAI_CLIENT,
      useFactory: () => {
        return new OpenAI({
          apiKey: process.env.OPENAI_API_KEY ?? '',
          baseURL: process.env.OPENAI_BASE_URL ?? 'https://api.deepseek.com',
        });
      },
    },
    AiClient,
  ],
  exports: [AiClient],
})
export class AiModule {}
