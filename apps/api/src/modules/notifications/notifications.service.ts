import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';

interface SendInput {
  targetType: 'USER' | 'ELDER';
  targetId: string;
  templateId?: string;
  payload: Record<string, unknown>;
}

interface QueryInput {
  targetType?: string;
  targetId?: string;
  page: number;
  limit: number;
}

@Injectable()
export class NotificationsService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  async send(input: SendInput) {
    const notification = await this.prisma.notification.create({
      data: {
        targetType: input.targetType,
        targetId: input.targetId,
        channel: process.env.NOTIFICATION_CHANNEL ?? 'console',
        templateId: input.templateId ?? null,
        payload: input.payload as Prisma.InputJsonValue,
        status: 'PENDING',
      },
    });

    await this.notificationsQueue.add(
      'send-notification',
      {
        notificationId: notification.id,
        targetType: input.targetType,
        targetId: input.targetId,
        templateId: input.templateId,
        payload: input.payload,
      },
      {
        attempts: 5,
        backoff: { type: 'exponential', delay: 60000 },
      },
    );

    return notification;
  }

  async findAll(query: QueryInput) {
    const { page, limit, targetType, targetId } = query;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (targetType) where.targetType = targetType;
    if (targetId) where.targetId = targetId;

    const [items, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
