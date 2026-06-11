// apps/api/src/modules/ai/ai.module.ts
import { Module } from '@nestjs/common';
import OpenAI from 'openai';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AiClient, OPENAI_CLIENT } from './ai-client.service';
import { AiService } from './ai.service';

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
    AiService,
    PrismaService,
  ],
  exports: [AiClient, AiService],
})
export class AiModule {}
