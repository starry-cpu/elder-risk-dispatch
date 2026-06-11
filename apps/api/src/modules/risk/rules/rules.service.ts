// apps/api/src/modules/risk/rules/rules.service.ts
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { RiskLevel } from '@prisma/client';

@Injectable()
export class RulesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: { page: number; limit: number; enabled?: boolean }) {
    const { page, limit, enabled } = query;
    const skip = (page - 1) * limit;
    const where: any = {};
    if (enabled !== undefined) where.enabled = enabled;

    const [items, total] = await Promise.all([
      this.prisma.riskRule.findMany({ where, skip, take: limit, orderBy: { updatedAt: 'desc' } }),
      this.prisma.riskRule.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async findById(id: string) {
    const rule = await this.prisma.riskRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('规则不存在');
    return rule;
  }

  async create(data: { name: string; condition: any; weight: number; level: RiskLevel }, createdById: string) {
    return this.prisma.riskRule.create({
      data: { ...data, version: 1, enabled: true, createdById },
    });
  }

  async update(id: string, data: { name?: string; condition?: any; weight?: number; level?: RiskLevel; enabled?: boolean }) {
    const rule = await this.prisma.riskRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('规则不存在');

    return this.prisma.riskRule.update({
      where: { id },
      data: { ...data, version: rule.version + 1 },
    });
  }

  async disable(id: string) {
    const rule = await this.prisma.riskRule.findUnique({ where: { id } });
    if (!rule) throw new NotFoundException('规则不存在');

    return this.prisma.riskRule.update({
      where: { id },
      data: { enabled: false, version: rule.version + 1 },
    });
  }
}
