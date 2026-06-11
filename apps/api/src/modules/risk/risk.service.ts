// apps/api/src/modules/risk/risk.service.ts
import {
  Injectable, NotFoundException, BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskScoringService } from './risk-scoring.service';
import { RiskLevel, RiskStatus, RiskSource, Role } from '@prisma/client';

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

  async evaluateAndCreateEvent(input: {
    elderId: string;
    hoursSinceLastCheckIn?: number;
    deviceAlarms?: string[];
    abnormalText?: boolean;
    age?: number;
    hasChronicDisease?: boolean;
    recentHighRisk?: boolean;
  }) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: input.elderId },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    const age = input.age ?? this.calculateAge(elder.birthDate);
    const hasChronic = input.hasChronicDisease ?? (elder.healthTags?.length > 0);

    // Check recent high risk (last 7 days)
    let recentHighRisk = input.recentHighRisk ?? false;
    if (!input.recentHighRisk) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const recent = await this.prisma.riskEvent.findFirst({
        where: { elderId: input.elderId, level: RiskLevel.HIGH, createdAt: { gte: sevenDaysAgo } },
      });
      recentHighRisk = !!recent;
    }

    const result = await this.scoring.evaluate({
      hoursSinceLastCheckIn: input.hoursSinceLastCheckIn ?? 0,
      deviceAlarms: input.deviceAlarms ?? [],
      abnormalText: input.abnormalText ?? false,
      age,
      hasChronicDisease: hasChronic,
      recentHighRisk,
    });

    if (result.score === 0) return null;

    // Determine source
    let source: RiskSource = RiskSource.MANUAL;
    if (input.hoursSinceLastCheckIn && input.hoursSinceLastCheckIn >= 24) source = RiskSource.MISSED_CHECKIN;
    if (input.deviceAlarms && input.deviceAlarms.length > 0) source = RiskSource.DEVICE;
    if (input.abnormalText) source = RiskSource.ABNORMAL_TEXT;

    return this.prisma.riskEvent.create({
      data: {
        elderId: input.elderId,
        level: result.level,
        source,
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

  private calculateAge(birthDate: Date | null): number {
    if (!birthDate) return 0;
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) age--;
    return age;
  }
}
