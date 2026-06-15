import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role, ServiceLevel, RiskLevel } from '@prisma/client';

interface Requester {
  sub: string;
  role: Role;
  district?: string;
}

const ENCRYPT_FIELDS = ['idCard', 'address'];

@Injectable()
export class EldersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async create(dto: any, requester: Requester) {
    const { contacts, ...elderData } = dto;
    // District isolation: non-ADMIN must create in own district
    if (requester.role !== Role.ADMIN && requester.district) {
      if (elderData.district && elderData.district !== requester.district) {
        throw new ForbiddenException('无权限在他人片区创建老人档案');
      }
      elderData.district = requester.district;
    }
    const encryptedData: any = { ...elderData };
    for (const field of ENCRYPT_FIELDS) {
      if (encryptedData[field]) {
        encryptedData[field] = this.crypto.encrypt(String(encryptedData[field]));
      }
    }
    if (encryptedData.birthDate) {
      encryptedData.birthDate = new Date(encryptedData.birthDate);
    }

    const elder = await this.prisma.elder.create({
      data: {
        ...encryptedData,
        contacts: contacts
          ? {
              create: contacts.map((c: any) => ({
                name: c.name,
                relation: c.relation,
                phone: this.crypto.encrypt(c.phone),
                isPrimary: c.isPrimary ?? false,
              })),
            }
          : undefined,
      },
      include: { contacts: true },
    });
    return this.sanitizeElder(elder, requester);
  }

  async findAll(query: {
    page?: number;
    limit?: number;
    district?: string;
    serviceLevel?: ServiceLevel;
  }, requester: Requester) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const skip = (page - 1) * limit;
    const where: any = {};
    // District isolation: non-ADMIN only see their own district
    if (requester.role !== Role.ADMIN) {
      if (requester.district) {
        where.district = requester.district;
      }
    } else if (query.district) {
      where.district = query.district;
    }
    if (query.serviceLevel) where.serviceLevel = query.serviceLevel;
    const [items, total] = await Promise.all([
      this.prisma.elder.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { contacts: true },
      }),
      this.prisma.elder.count({ where }),
    ]);
    return {
      items: items.map((e) => this.maskSensitive(e)),
      total,
      page,
      limit,
    };
  }

  // 查询当前家属关联的老人列表（咽喉接口：供小程序前端在登录后取回 elderId）
  async findMine(requester: Requester) {
    const links = await this.prisma.elderFamilyLink.findMany({
      where: { userId: requester.sub },
      include: { elder: { select: { id: true, name: true, serviceLevel: true, district: true } } },
    });
    return { items: links.map((l: any) => l.elder) };
  }

  async findById(id: string, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id },
      include: { contacts: true, familyLinks: true },
    });
    if (!elder) throw new BadRequestException('老人不存在');
    this.authorizeAccess(elder, requester);
    return this.sanitizeElder(elder, requester);
  }

  async update(id: string, dto: any, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id },
      include: { familyLinks: true },
    });
    if (!elder) throw new BadRequestException('老人不存在');
    this.authorizeAccess(elder, requester);

    const encryptedData: any = { ...dto };
    for (const field of ENCRYPT_FIELDS) {
      if (encryptedData[field]) {
        encryptedData[field] = this.crypto.encrypt(String(encryptedData[field]));
      }
    }
    if (encryptedData.birthDate) {
      encryptedData.birthDate = new Date(encryptedData.birthDate);
    }
    const updated = await this.prisma.elder.update({
      where: { id },
      data: encryptedData,
      include: { contacts: true },
    });
    return this.maskSensitive(updated);
  }

  async addContact(elderId: string, dto: {
    name: string;
    relation: string;
    phone: string;
    isPrimary?: boolean;
  }, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new BadRequestException('老人不存在');
    this.authorizeAccess(elder, requester);

    const contact = await this.prisma.emergencyContact.create({
      data: {
        elderId,
        name: dto.name,
        relation: dto.relation,
        phone: this.crypto.encrypt(dto.phone),
        isPrimary: dto.isPrimary ?? false,
      },
    });
    return { ...contact, phone: this.crypto.decrypt(contact.phone) };
  }

  async getContacts(elderId: string, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new BadRequestException('老人不存在');
    this.authorizeAccess(elder, requester);

    const contacts = await this.prisma.emergencyContact.findMany({
      where: { elderId },
    });
    return contacts.map((c) => ({ ...c, phone: this.tryDecrypt(c.phone) }));
  }

  async getRiskProfile(elderId: string, requester: Requester) {
    const elder = await this.prisma.elder.findUnique({
      where: { id: elderId },
      include: { familyLinks: true },
    });
    if (!elder) throw new BadRequestException('老人不存在');
    this.authorizeAccess(elder, requester);

    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayStart = new Date(todayStr);

    const [
      totalCheckIns,
      missedCheckIns,
      abnormalCheckIns,
      totalVisits,
      activeRiskEvents,
      completedWorkOrders,
      latestRiskEvent,
      recentRiskEvents,
      // ✨ 新增
      recentCheckIns,
      recentVisits,
      recentDeviceAlarms,
      todayCheckIns,
    ] = await Promise.all([
      this.prisma.checkIn.count({
        where: { elderId, createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.checkIn.count({
        where: { elderId, status: 'MISSED', createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.checkIn.count({
        where: { elderId, status: 'ABNORMAL', createdAt: { gte: thirtyDaysAgo } },
      }),
      this.prisma.visitRecord.count({
        where: { elderId, visitTime: { gte: thirtyDaysAgo } },
      }),
      this.prisma.riskEvent.count({
        where: { elderId, status: { in: ['PENDING_REVIEW', 'CONFIRMED'] } },
      }),
      this.prisma.workOrder.count({
        where: { elderId, status: 'COMPLETED' },
      }),
      this.prisma.riskEvent.findFirst({
        where: { elderId },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.riskEvent.findMany({
        where: { elderId },
        orderBy: { createdAt: 'desc' },
        take: 10,
      }),
      // ✨ Recent 7-day check-ins
      this.prisma.checkIn.findMany({
        where: { elderId, createdAt: { gte: sevenDaysAgo } },
        orderBy: { createdAt: 'desc' },
        take: 30,
      }),
      // ✨ Recent 30-day visits
      this.prisma.visitRecord.findMany({
        where: { elderId, visitTime: { gte: thirtyDaysAgo } },
        orderBy: { visitTime: 'desc' },
        take: 20,
      }),
      // ✨ Recent device alarms
      this.prisma.deviceData.findMany({
        where: { elderId, alarm: true },
        orderBy: { timestamp: 'desc' },
        take: 20,
      }),
      // ✨ Today's check-ins
      this.prisma.checkIn.count({
        where: { elderId, createdAt: { gte: todayStart } },
      }),
    ]);

    // Calculate check-in streak: count consecutive calendar days with at least one check-in,
    // starting from yesterday (today might not have a check-in yet)
    const daySet = new Set<string>();
    for (const d of recentCheckIns) {
      const dateStr = new Date(d.createdAt).toISOString().split('T')[0];
      daySet.add(dateStr);
    }
    let checkInStreak = 0;
    let checkDay = new Date();
    checkDay.setDate(checkDay.getDate() - 1); // start from yesterday
    while (true) {
      const dayKey = checkDay.toISOString().split('T')[0];
      if (daySet.has(dayKey)) {
        checkInStreak++;
        checkDay.setDate(checkDay.getDate() - 1);
      } else {
        break;
      }
    }

    return {
      elderId: elder.id,
      elderName: elder.name,
      serviceLevel: elder.serviceLevel,
      stats: {
        totalCheckIns,
        missedCheckIns,
        abnormalCheckIns,
        totalVisits,
        activeRiskEvents,
        completedWorkOrders,
      },
      currentRisk: {
        latestRiskEvent,
        level: latestRiskEvent?.level ?? RiskLevel.LOW,
        activeAlerts: activeRiskEvents,
      },
      recentRiskEvents,
      // ✨ 新增
      recentCheckIns,
      recentVisits,
      recentDeviceAlarms,
      summary: {
        checkInStreak,
        missedToday: todayCheckIns === 0,
        activeAlarms: recentDeviceAlarms.length,
      },
      generatedAt: new Date().toISOString(),
    };
  }

  async linkFamily(elderId: string, userId: string, relation: string) {
    return this.prisma.elderFamilyLink.create({
      data: { elderId, userId, relation },
    });
  }

  /** Shared authorization check: district isolation + family link */
  private authorizeAccess(elder: any, requester: Requester) {
    if (requester.role === Role.ADMIN) return;
    if (requester.role === Role.FAMILY) {
      const isLinked = elder.familyLinks?.some(
        (fl: any) => fl.userId === requester.sub,
      );
      if (!isLinked) throw new ForbiddenException('无权限查看此老人信息');
      return;
    }
    if (requester.district && elder.district !== requester.district) {
      throw new ForbiddenException('无权限查看其他片区的老人信息');
    }
  }

  private sanitizeElder(elder: any, requester: Requester) {
    const isAdmin = requester.role === Role.ADMIN;
    const isFamily = requester.role === Role.FAMILY;
    const isSameDistrict =
      requester.district && elder.district === requester.district;
    const canSeeSensitive = isAdmin || isSameDistrict || isFamily;
    return {
      id: elder.id,
      name: elder.name,
      gender: elder.gender,
      birthDate: elder.birthDate,
      idCard: isAdmin ? this.tryDecrypt(elder.idCard) : null,
      address: canSeeSensitive ? this.tryDecrypt(elder.address) : null,
      district: elder.district,
      longitude: elder.longitude,
      latitude: elder.latitude,
      healthTags: elder.healthTags,
      serviceLevel: elder.serviceLevel,
      livingStatus: elder.livingStatus,
      createdAt: elder.createdAt,
      contacts: elder.contacts?.map((c: any) => ({
        id: c.id,
        name: c.name,
        relation: c.relation,
        phone: canSeeSensitive ? this.tryDecrypt(c.phone) : null,
        isPrimary: c.isPrimary,
      })),
    };
  }

  private maskSensitive(elder: any) {
    return {
      ...elder,
      idCard: null,
      address: null,
      contacts: elder.contacts?.map((c: any) => ({ ...c, phone: null })),
    };
  }

  private tryDecrypt(value: string | null): string | null {
    if (!value) return null;
    try {
      return this.crypto.decrypt(value);
    } catch {
      return value;
    }
  }
}
