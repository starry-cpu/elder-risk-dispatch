import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

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

  async findAll(query: QueryInput, requester?: Requester) {
    const { page, limit } = query;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (requester && requester.role !== Role.ADMIN) {
      // 鉴权：非 ADMIN 只能看与本人/本片区相关的通知，避免水平越权读取他人私信。
      // - USER 类：仅 targetId === 本人 sub
      // - SYSTEM 类（片区/role 广播）：仅 targetId === 本人片区
      // 调用方传入的 targetType/targetId 不能用来突破此范围，故忽略之；
      // ADMIN 不受限，保留显式过滤。
      const visibleScopes: any[] = [{ targetType: 'USER', targetId: requester.sub }];
      if (requester.district) {
        visibleScopes.push({ targetType: 'SYSTEM', targetId: requester.district });
      }
      where.OR = visibleScopes;
    } else {
      // ADMIN：尊重显式过滤
      if (query.targetType) where.targetType = query.targetType;
      if (query.targetId) where.targetId = query.targetId;
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

  async emitAndPersist(input: EmitInput) {
    const { event, roomType, roomId, payload } = input;

    const notification = await this.prisma.notification.create({
      data: {
        targetType: roomType === 'user' ? 'USER' : 'SYSTEM',
        targetId: roomId,
        channel: 'websocket',
        templateId: null,
        payload: { ...payload, event } as Prisma.InputJsonValue,
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
    try {
      await this.prisma.notification.update({
        where: { id: notificationId, targetType: 'USER', targetId: userId },
        data: { readAt: new Date() },
      });
    } catch (error) {
      // Prisma throws P2025 when record not found (wrong id, wrong user, or already deleted)
      if (
        error instanceof Error &&
        'code' in error &&
        (error as Record<string, unknown>).code === 'P2025'
      ) {
        throw new NotFoundException(
          '通知不存在或无权访问',
        );
      }
      throw error;
    }
  }

  async getUnreadCount(userId: string): Promise<number> {
    return this.prisma.notification.count({
      where: { targetType: 'USER', targetId: userId, readAt: null },
    });
  }
}
