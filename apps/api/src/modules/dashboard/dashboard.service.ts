import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';
import { RiskOverviewDto } from './dto/risk-overview.dto';
import { WorkOrderEfficiencyDto } from './dto/work-order-efficiency.dto';
import { ElderCoverageDto } from './dto/elder-coverage.dto';
import { GridWorkerPerformanceDto } from './dto/grid-worker-performance.dto';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

interface QueryOptions {
  period?: string;
  district?: string;
}

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateRange(period: string | undefined): { gte: Date } {
    const days = period === '30d' ? 30 : 7;
    return { gte: new Date(Date.now() - days * 24 * 60 * 60 * 1000) };
  }

  private buildElderWhere(requester: Requester): Record<string, unknown> {
    if (requester.role === Role.ADMIN) return {};
    if (requester.role === Role.FAMILY || requester.role === Role.VOLUNTEER) {
      return {
        familyLinks: { some: { userId: requester.sub } },
      };
    }
    return { district: requester.district };
  }

  async getRiskOverview(
    query: QueryOptions,
    requester: Requester,
  ): Promise<RiskOverviewDto> {
    const createdAt = this.getDateRange(query.period);
    const elderWhere = this.buildElderWhere(requester);
    const hasDistrictFilter =
      requester.role !== Role.ADMIN &&
      requester.role !== Role.FAMILY &&
      requester.role !== Role.VOLUNTEER;

    const where: Record<string, unknown> = { createdAt };
    if (hasDistrictFilter) {
      where.elder = elderWhere;
    }

    const [byLevel, bySource, total] = await Promise.all([
      this.prisma.riskEvent.groupBy({
        by: ['level'],
        where,
        _count: { id: true },
      }),
      this.prisma.riskEvent.groupBy({
        by: ['source'],
        where,
        _count: { id: true },
      }),
      this.prisma.riskEvent.count({ where }),
    ]);

    const events = await this.prisma.riskEvent.findMany({
      where,
      select: { createdAt: true },
      orderBy: { createdAt: 'asc' },
    });
    const dateMap = new Map<string, number>();
    for (const e of events) {
      const d = e.createdAt.toISOString().slice(0, 10);
      dateMap.set(d, (dateMap.get(d) ?? 0) + 1);
    }
    const trend: Array<{ date: string; count: number }> = [];
    for (const [date, count] of dateMap) {
      trend.push({ date, count });
    }

    return {
      byLevel: byLevel.map((r) => ({ level: r.level, count: r._count.id })),
      bySource: bySource.map((r) => ({
        source: r.source,
        count: r._count.id,
      })),
      trend,
      total,
      periodDays: query.period === '30d' ? 30 : 7,
    };
  }

  async getWorkOrderEfficiency(
    query: QueryOptions,
    requester: Requester,
  ): Promise<WorkOrderEfficiencyDto> {
    const createdAt = this.getDateRange(query.period);
    const elderWhere = this.buildElderWhere(requester);
    const hasDistrictFilter =
      requester.role !== Role.ADMIN &&
      requester.role !== Role.FAMILY &&
      requester.role !== Role.VOLUNTEER;

    const where: Record<string, unknown> = { createdAt };
    if (hasDistrictFilter) {
      where.elder = elderWhere;
    }

    const [byStatus, byType, total, completedOrders] = await Promise.all([
      this.prisma.workOrder.groupBy({
        by: ['status'],
        where,
        _count: { id: true },
      }),
      this.prisma.workOrder.groupBy({
        by: ['type'],
        where,
        _count: { id: true },
      }),
      this.prisma.workOrder.count({ where }),
      this.prisma.workOrder.findMany({
        where: { ...where, status: 'COMPLETED' },
        select: { createdAt: true, completedAt: true },
      }),
    ]);

    let totalCompletionMs = 0;
    let completedCount = 0;
    for (const wo of completedOrders) {
      if (wo.completedAt) {
        totalCompletionMs += wo.completedAt.getTime() - wo.createdAt.getTime();
        completedCount++;
      }
    }

    const overdueCount = await this.prisma.workOrder.count({
      where: {
        ...where,
        deadline: { lt: new Date() },
        status: { notIn: ['COMPLETED', 'CANCELLED'] },
      },
    });

    return {
      byStatus: byStatus.map((r) => ({
        status: r.status,
        count: r._count.id,
      })),
      byType: byType.map((r) => ({ type: r.type, count: r._count.id })),
      avgCompletionHours:
        completedCount > 0
          ? Math.round((totalCompletionMs / completedCount / 3600000) * 100) /
            100
          : 0,
      overdueCount,
      total,
    };
  }

  async getElderCoverage(
    query: QueryOptions,
    requester: Requester,
  ): Promise<ElderCoverageDto> {
    const elderWhere = this.buildElderWhere(requester);

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    const [totalElders, todayCheckIns, weekCheckIns, abnormalCheckIns] =
      await Promise.all([
        this.prisma.elder.count({ where: elderWhere }),
        this.prisma.checkIn.count({
          where: { createdAt: { gte: todayStart }, elder: elderWhere },
        }),
        this.prisma.checkIn.count({
          where: { createdAt: { gte: sevenDaysAgo }, elder: elderWhere },
        }),
        this.prisma.checkIn.count({
          where: { status: 'ABNORMAL', elder: elderWhere },
        }),
      ]);

    const districtGroups = await this.prisma.elder.groupBy({
      by: ['district'],
      where: elderWhere,
      _count: { id: true },
    });

    const byDistrict = await Promise.all(
      districtGroups.map(async (d) => {
        const checkedIn = await this.prisma.checkIn.count({
          where: {
            createdAt: { gte: sevenDaysAgo },
            elder: { district: d.district },
          },
        });
        return {
          district: d.district,
          total: d._count.id,
          checkedIn,
          rate:
            d._count.id > 0
              ? Math.round((checkedIn / d._count.id) * 100)
              : 0,
        };
      }),
    );

    const highRiskElders = await this.prisma.elder.findMany({
      where: {
        ...elderWhere,
        serviceLevel: { in: ['HIGH', 'KEY'] },
      },
      include: {
        riskEvents: {
          where: { level: 'HIGH', createdAt: { gte: sevenDaysAgo } },
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        checkIns: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
      },
      take: 20,
    });

    return {
      byDistrict,
      todayCheckInRate:
        totalElders > 0
          ? Math.round((todayCheckIns / totalElders) * 100)
          : 0,
      weekCheckInRate:
        totalElders > 0
          ? Math.round((weekCheckIns / totalElders) * 100)
          : 0,
      abnormalRate:
        totalElders > 0
          ? Math.round((abnormalCheckIns / totalElders) * 100)
          : 0,
      highRiskElders: highRiskElders
        .filter((e) => e.riskEvents.length > 0)
        .map((e) => ({
          elderId: e.id,
          name: e.name,
          district: e.district,
          serviceLevel: e.serviceLevel,
          latestRiskLevel: e.riskEvents[0]?.level ?? null,
          lastCheckIn: e.checkIns[0]?.createdAt?.toISOString() ?? null,
        })),
    };
  }

  async getGridWorkerPerformance(
    _query: QueryOptions,
    requester: Requester,
  ): Promise<GridWorkerPerformanceDto> {
    const userWhere: Record<string, unknown> = {
      role: { in: ['GRID_WORKER', 'COMMUNITY_DOCTOR', 'PROPERTY'] },
    };
    if (requester.role === Role.ADMIN && requester.district) {
      userWhere.district = requester.district;
    } else if (requester.role !== Role.ADMIN) {
      userWhere.district = requester.district;
    }

    const workers = await this.prisma.user.findMany({
      where: userWhere,
      select: {
        id: true,
        name: true,
        role: true,
        district: true,
        dutyStatus: true,
      },
    });

    const result = await Promise.all(
      workers.map(async (w) => {
        const completedOrders = await this.prisma.workOrder.count({
          where: { assigneeId: w.id, status: 'COMPLETED' },
        });

        const completedList = await this.prisma.workOrder.findMany({
          where: { assigneeId: w.id, status: 'COMPLETED' },
          select: { createdAt: true, completedAt: true },
        });

        let totalResponseMs = 0;
        for (const wo of completedList) {
          if (wo.completedAt) {
            totalResponseMs +=
              wo.completedAt.getTime() - wo.createdAt.getTime();
          }
        }

        return {
          userId: w.id,
          name: w.name,
          role: w.role,
          district: w.district ?? '',
          dutyStatus: w.dutyStatus,
          completedOrders,
          avgResponseHours:
            completedList.length > 0
              ? Math.round(
                  (totalResponseMs / completedList.length / 3600000) * 100,
                ) / 100
              : 0,
        };
      }),
    );

    return { workers: result };
  }
}
