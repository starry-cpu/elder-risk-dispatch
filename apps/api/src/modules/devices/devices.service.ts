import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class DevicesService {
  constructor(private readonly prisma: PrismaService) {}

  private authorizeAccess(elder: any, requester: Requester) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.FAMILY) {
      const isLinked = elder.familyLinks?.some(
        (fl: any) => fl.userId === requester.sub,
      );
      if (!isLinked) throw new ForbiddenException('无权限查看此老人的设备数据');
      return;
    }
    if (requester.district && elder.district !== requester.district) {
      throw new ForbiddenException('无权限查看其他片区的设备数据');
    }
  }

  async ingest(dto: {
    deviceId: string;
    elderId: string;
    deviceType: string;
    metricType: string;
    value?: string;
    alarm: boolean;
    timestamp: number;
  }) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: dto.elderId },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    return this.prisma.deviceData.create({
      data: {
        elderId: dto.elderId,
        deviceId: dto.deviceId,
        deviceType: dto.deviceType,
        metricType: dto.metricType,
        value: dto.value || null,
        alarm: dto.alarm,
        timestamp: new Date(dto.timestamp),
      },
    });
  }

  async findByElder(elderId: string, query: { page?: number; limit?: number }, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');
    this.authorizeAccess(elder, requester);

    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const [items, total] = await Promise.all([
      this.prisma.deviceData.findMany({
        where: { elderId },
        skip,
        take: limit,
        orderBy: { timestamp: 'desc' },
      }),
      this.prisma.deviceData.count({ where: { elderId } }),
    ]);

    return { items, total, page, limit };
  }
}
