// apps/api/src/modules/ai/ai.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AiService } from './ai.service';

@ApiTags('AI')
@ApiBearerAuth()
@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ai/classify')
  @ApiOperation({ summary: 'AI 文本分类（工单类型识别）' })
  classify(@Body() body: { text: string }) {
    return this.aiService.classify(body.text);
  }

  @Post('ai/summarize')
  @ApiOperation({ summary: 'AI 工单摘要生成' })
  summarize(@Body() body: { workOrderId: string }) {
    return this.aiService.summarize(body.workOrderId);
  }
}
