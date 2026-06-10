import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, CheckInMethod } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

@Injectable()
export class CheckInsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(dto: { elderId: string; method: CheckInMethod; content?: string; voiceUrl?: string }, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: dto.elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new NotFoundException('老人不存在');

    this.authorizeAccess(elder, requester);

    if (dto.method === CheckInMethod.VOICE && !dto.voiceUrl) {
      throw new BadRequestException('VOICE 模式必须提供语音文件 URL');
    }
    if (dto.method === CheckInMethod.TEXT && !dto.content) {
      throw new BadRequestException('TEXT 模式必须提供文本内容');
    }
    if (dto.method === CheckInMethod.PROXY && !dto.content) {
      throw new BadRequestException('PROXY 模式必须提供备注说明');
    }

    if (dto.voiceUrl) {
      const allowedExtensions = ['.mp3', '.wav', '.m4a', '.aac'];
      const lower = dto.voiceUrl.toLowerCase();
      const valid = allowedExtensions.some((ext) => lower.endsWith(ext));
      if (!valid) {
        throw new BadRequestException(`不支持的语音文件类型，允许: ${allowedExtensions.join(', ')}`);
      }
    }

    return this.prisma.checkIn.create({
      data: {
        elderId: dto.elderId,
        method: dto.method,
        content: dto.content || null,
        voiceUrl: dto.voiceUrl || null,
        status: 'NORMAL',
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
      this.prisma.checkIn.findMany({
        where: { elderId },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.checkIn.count({ where: { elderId } }),
    ]);

    return { items, total, page, limit };
  }

  private authorizeAccess(elder: any, requester: Requester) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.FAMILY) {
      const isLinked = elder.familyLinks?.some(
        (fl: any) => fl.userId === requester.sub,
      );
      if (!isLinked) throw new ForbiddenException('无权限为此老人报平安');
      return;
    }
    if (requester.district && elder.district !== requester.district) {
      throw new ForbiddenException('无权限操作其他片区的老人');
    }
  }
}
