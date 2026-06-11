// apps/api/src/modules/risk/risk.service.ts
import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskScoringService } from './risk-scoring.service';
import { RiskLevel, RiskStatus, RiskSource, Role } from '@prisma/client';

interface EvaluateInput {
  elderId: string;
  hoursSinceLastCheckIn: number;
  deviceAlarms: string[];
  abnormalText: boolean;
  age: number;
  hasChronicDisease: boolean;
  recentHighRisk: boolean;
}

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class RiskService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: RiskScoringService,
  ) {}

  async evaluateAndCreateEvent(input: EvaluateInput) {
    const result = this.scoring.evaluate(input);

    if (result.score === 0) return null;

    return this.prisma.riskEvent.create({
      data: {
        elderId: input.elderId,
        level: result.level,
        source: RiskSource.MANUAL,
        score: result.score,
        reason: result.reason.join(','),
        status: RiskStatus.PENDING_REVIEW,
        ruleVersion: String(result.ruleVersion),
      },
    });
  }

  async findAll(
    query: { page: number; limit: number; level?: RiskLevel; status?: RiskStatus; district?: string },
    requester: Requester,
  ) {
    const { page, limit, level, status, district } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (level) where.level = level;
    if (status) where.status = status;

    // District isolation: non-ADMIN limited to own district
    if (requester.role !== Role.ADMIN) {
      where.elder = { district: requester.district ?? '' };
    } else if (district) {
      where.elder = { district };
    }

    const [items, total] = await Promise.all([
      this.prisma.riskEvent.findMany({
        where,
        include: { elder: { select: { id: true, name: true, district: true } } },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.riskEvent.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async findById(id: string) {
    const event = await this.prisma.riskEvent.findUnique({
      where: { id },
      include: {
        elder: true,
        workOrder: true,
      },
    });
    if (!event) throw new NotFoundException('风险事件不存在');
    return event;
  }

  async reviewEvent(
    id: string,
    decision: typeof RiskStatus.CONFIRMED | typeof RiskStatus.IGNORED,
    reviewerId: string,
    note?: string,
  ) {
    const event = await this.prisma.riskEvent.findUnique({ where: { id } });
    if (!event) throw new NotFoundException('风险事件不存在');

    if (event.status !== RiskStatus.PENDING_REVIEW) {
      throw new BadRequestException('该事件已复核，不可重复操作');
    }

    if (event.level === RiskLevel.HIGH && decision === RiskStatus.IGNORED) {
      throw new BadRequestException('HIGH 级别风险不允许直接忽略，必须人工确认或转派工单');
    }

    return this.prisma.riskEvent.update({
      where: { id },
      data: {
        status: decision,
        reviewedBy: reviewerId,
        reason: note ? `${event.reason} | 复核备注: ${note}` : event.reason,
      },
    });
  }
}
