import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class VisitsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: {
    elderId: string;
    observation: string;
    photos?: string[];
    note?: string;
    longitude?: number;
    latitude?: number;
    visitTime?: string;
  }, requester: Requester) {
    if (requester.role !== Role.GRID_WORKER) {
      throw new ForbiddenException('仅网格员可提交巡访记录');
    }

    const elder = await this.prisma.elder.findUnique({
      where: { id: dto.elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    if (requester.district && elder.district !== requester.district) {
      throw new ForbiddenException('无权限操作其他片区的老人');
    }

    if (!dto.observation || dto.observation.trim().length === 0) {
      throw new BadRequestException('观察记录不能为空');
    }

    return this.prisma.visitRecord.create({
      data: {
        elderId: dto.elderId,
        gridWorkerId: requester.sub,
        observation: dto.observation,
        photos: dto.photos || [],
        note: dto.note || null,
        visitTime: dto.visitTime ? new Date(dto.visitTime) : new Date(),
      },
    });
  }

  async findAll(query: {
    elderId?: string;
    from?: string;
    to?: string;
    page: number;
    limit: number;
  }, requester: Requester) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.elderId) {
      where.elderId = query.elderId;
    }

    if (query.from || query.to) {
      where.visitTime = {};
      if (query.from) where.visitTime.gte = new Date(query.from);
      if (query.to) where.visitTime.lte = new Date(query.to);
    }

    if (requester.role !== Role.ADMIN && requester.district) {
      where.elder = { district: requester.district };
    }

    const [items, total] = await Promise.all([
      this.prisma.visitRecord.findMany({
        where,
        skip,
        take: limit,
        orderBy: { visitTime: 'desc' },
        include: {
          elder: { select: { id: true, name: true, district: true } },
        },
      }),
      this.prisma.visitRecord.count({ where }),
    ]);

    return { items, total, page, limit };
  }
}
