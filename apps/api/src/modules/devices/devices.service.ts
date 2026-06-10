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

    if (requester.role !== Role.ADMIN) {
      if (requester.district && elder.district !== requester.district) {
        throw new ForbiddenException('无权限查看其他片区的设备数据');
      }
    }

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
