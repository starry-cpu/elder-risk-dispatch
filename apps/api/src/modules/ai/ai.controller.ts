// apps/api/src/modules/ai/ai.controller.ts
import { Controller, Post, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Role } from '@prisma/client';
import { AiService } from './ai.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClassifyDto } from './dto/classify.dto';
import { SummarizeDto } from './dto/summarize.dto';

@ApiTags('AI')
@ApiBearerAuth()
@Roles(Role.ADMIN, Role.GRID_WORKER)
@Controller()
export class AiController {
  constructor(private readonly aiService: AiService) {}

  @Post('ai/classify')
  @ApiOperation({ summary: 'AI 文本分类（工单类型识别）' })
  classify(@Body() dto: ClassifyDto) {
    return this.aiService.classify(dto.text);
  }

  @Post('ai/summarize')
  @ApiOperation({ summary: 'AI 工单摘要生成' })
  summarize(@Body() dto: SummarizeDto) {
    return this.aiService.summarize(dto.workOrderId);
  }
}
