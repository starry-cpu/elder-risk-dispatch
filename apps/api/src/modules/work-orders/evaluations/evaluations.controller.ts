import { Controller, Get, Post, Param, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EvaluationsService } from './evaluations.service';
import { CreateEvaluationDto } from '../dto/create-evaluation.dto';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';

@ApiTags('Evaluations')
@ApiBearerAuth()
@Controller()
export class EvaluationsController {
  constructor(private readonly evaluationsService: EvaluationsService) {}

  @Post('work-orders/:id/evaluation')
  @ApiOperation({ summary: '提交服务评价' })
  create(
    @Param('id') workOrderId: string,
    @Body() dto: CreateEvaluationDto,
    @CurrentUser() user: any,
  ) {
    return this.evaluationsService.create(workOrderId, dto, user);
  }

  @Get('work-orders/:id/evaluation')
  @ApiOperation({ summary: '查看服务评价' })
  findByWorkOrderId(@Param('id') workOrderId: string, @CurrentUser() user: any) {
    return this.evaluationsService.findByWorkOrderId(workOrderId, user);
  }
}
