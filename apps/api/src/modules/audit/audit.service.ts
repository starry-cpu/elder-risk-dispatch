import { Injectable, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface AuditLogInput {
  userId?: string;
  action: string;
  resourceType: string;
  resourceId?: string | null;
  detail?: Prisma.InputJsonValue | null;
  ip?: string;
}

interface AuditQueryInput {
  userId?: string;
  action?: string;
  resourceType?: string;
  resourceId?: string;
  startDate?: string;
  endDate?: string;
  page: number;
  limit: number;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(input: AuditLogInput): Promise<void> {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: input.userId ?? null,
          action: input.action,
          resourceType: input.resourceType,
          resourceId: input.resourceId ?? null,
          ...(input.detail != null ? { detail: input.detail } : {}),
          ip: input.ip ?? null,
        },
      });
    } catch (error) {
      this.logger.error(
        `Audit log write failed: ${input.action} on ${input.resourceType}`,
        error instanceof Error ? error.message : String(error),
      );
      // Audit write failures never throw — must not block business operations
    }
  }

  async findAll(query: AuditQueryInput) {
    const { page, limit, userId, action, resourceType, resourceId, startDate, endDate } = query;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (userId) where.userId = userId;
    if (action) where.action = action;
    if (resourceType) where.resourceType = resourceType;
    if (resourceId) where.resourceId = resourceId;
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, unknown>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, unknown>).lte = new Date(endDate);
    }

    const [items, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
