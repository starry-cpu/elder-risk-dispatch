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

interface EmitInput {
  event: string;
  roomType: 'user' | 'role' | 'district';
  roomId: string;
  payload: Record<string, unknown>;
}

@Injectable()
export class NotificationsService {
  private gateway: { emitToUser: Function; emitToRole: Function; emitToDistrict: Function } | null = null;

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('notifications') private readonly notificationsQueue: Queue,
  ) {}

  setGateway(gateway: { emitToUser: Function; emitToRole: Function; emitToDistrict: Function }): void {
    this.gateway = gateway;
  }

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
        channel: notification.channel,
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

  async emitAndPersist(input: EmitInput) {
    const { event, roomType, roomId, payload } = input;

    const notification = await this.prisma.notification.create({
      data: {
        targetType: roomType === 'user' ? 'USER' : 'SYSTEM',
        targetId: roomId,
        channel: 'websocket',
        templateId: null,
        payload: { event, ...payload } as any,
        status: 'SENT',
        sentAt: new Date(),
      },
    });

    try {
      if (this.gateway) {
        switch (roomType) {
          case 'user':
            this.gateway.emitToUser(roomId, event, payload);
            break;
          case 'role':
            this.gateway.emitToRole(roomId, event, payload);
            break;
          case 'district':
            this.gateway.emitToDistrict(roomId, event, payload);
            break;
        }
      }
    } catch {
      // WS 推送失败不影响落盘
    }

    return notification;
  }

  async getInbox(input: { userId: string; page: number; limit: number; includeRead?: boolean }) {
    const { userId, page, limit, includeRead } = input;
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {
      targetType: 'USER',
      targetId: userId,
    };
    if (!includeRead) {
      where.readAt = null;
    }

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

  async markAsRead(notificationId: string, userId: string): Promise<void> {
    await this.prisma.notification.update({
      where: { id: notificationId, targetType: 'USER', targetId: userId },
      data: { readAt: new Date() },
    });
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { targetType: 'USER', targetId: userId, readAt: null },
    });
  }
}
