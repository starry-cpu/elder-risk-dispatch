// apps/api/src/modules/risk/risk.service.ts
import {
  Injectable, NotFoundException, BadRequestException, Logger,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { RiskScoringService } from './risk-scoring.service';
import { NotificationsService } from '../notifications/notifications.service';
import { RiskLevel, RiskStatus, RiskSource, Role } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class RiskService {
  private readonly logger = new Logger(RiskService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly scoring: RiskScoringService,
    private readonly notificationsService: NotificationsService,
  ) {}

  /**
   * 鉴权：HTTP 入口（POST /risk/evaluate）调用前先校验调用者对该老人有权限。
   * 仅做片区隔离——FAMILY 不允许手动评估，ADMIN 放行，worker 须同片区。
   *
   * 注意：evaluateAndCreateEvent 本身保持 requester-agnostic，因为调度器
   * (SchedulerService.scanMissedCheckIns) 会以系统身份循环调用它，那里没有
   * requester 概念。鉴权责任放在 controller，通过本方法显式执行。
   */
  async assertCanEvaluate(elderId: string, requester: Requester): Promise<void> {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      select: { district: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');
    if (requester.role === Role.ADMIN) return;
    // 非 ADMIN worker 必须有片区且与老人同片区；district 缺失同样拒绝
    if (!requester.district || elder.district !== requester.district) {
      throw new NotFoundException('老人不存在');
    }
  }

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
    if (input.recentHighRisk === undefined) {
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

    const event = await this.prisma.riskEvent.create({
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

    // Push WebSocket notification for HIGH risk events
    if (event.level === RiskLevel.HIGH) {
      // Notify ADMIN role
      this.notificationsService.emitAndPersist({
        event: 'risk:alert',
        roomType: 'role',
        roomId: 'ADMIN',
        payload: {
          riskEventId: event.id,
          elderId: event.elderId,
          level: event.level,
          source: event.source,
          reason: event.reason,
        },
      }).catch((err: unknown) => {
        this.logger.warn(`WS push failed (risk:alert): ${err instanceof Error ? err.message : String(err)}`);
      });

      // Also notify the elder's district
      if (elder.district) {
        this.notificationsService.emitAndPersist({
          event: 'risk:alert',
          roomType: 'district',
          roomId: elder.district,
          payload: {
            riskEventId: event.id,
            elderId: event.elderId,
            level: event.level,
            source: event.source,
            reason: event.reason,
          },
        }).catch((err: unknown) => {
        this.logger.warn(`WS push failed (risk:alert): ${err instanceof Error ? err.message : String(err)}`);
      });
      }
    }

    return event;
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

  async findById(id: string, requester?: Requester) {
    const event = await this.prisma.riskEvent.findUnique({
      where: { id },
      include: {
        // 仅取老人安全字段，避免把加密的 idCard/address 等敏感列直接外泄；
        // 同时带 familyLinks 以便校验 FAMILY 归属。
        elder: {
          select: {
            id: true,
            name: true,
            gender: true,
            district: true,
            serviceLevel: true,
            familyLinks: { select: { userId: true } },
          },
        },
        workOrder: { select: { id: true, status: true, type: true, level: true } },
      },
    });
    if (!event) throw new NotFoundException('风险事件不存在');

    if (requester && requester.role !== Role.ADMIN) {
      if (requester.role === Role.FAMILY) {
        // FAMILY 只能看自己关联老人员的风险事件（避免跨家属越权 + PII 泄露）
        const linked = event.elder.familyLinks?.some((fl: any) => fl.userId === requester.sub);
        if (!linked) throw new NotFoundException('风险事件不存在');
      } else {
        // worker 维持片区隔离；district 缺失同样拒绝
        if (!requester.district || event.elder.district !== requester.district) {
          throw new NotFoundException('风险事件不存在');
        }
      }
    }

    // familyLinks 仅用于鉴权，不外泄（前缀 _ 标记为有意剥离）
    const { familyLinks: _familyLinks, ...safeElder } = event.elder as any;
    return { ...event, elder: safeElder };
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
