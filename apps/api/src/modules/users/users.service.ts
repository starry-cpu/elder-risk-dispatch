import { Injectable, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role, DutyStatus } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

interface Requester { sub: string; role: Role; district?: string; }

@Injectable()
export class UsersService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async create(dto: { phone: string; name: string; role: Role; password?: string; skills?: string[]; district?: string }, requester: Requester) {
    if (dto.role === Role.FAMILY && dto.password) {
      throw new BadRequestException('家属角色不允许设置后台密码');
    }
    if (dto.role !== Role.FAMILY && !dto.password) {
      throw new BadRequestException('非家属角色必须设置密码');
    }
    const passwordHash = dto.password ? await bcrypt.hash(dto.password, 10) : undefined;
    const encryptedPhone = this.crypto.encrypt(dto.phone);
    const phoneHash = this.crypto.hashPhone(dto.phone);
    const user = await this.prisma.user.create({
      data: { phone: encryptedPhone, phoneHash, name: dto.name, role: dto.role, passwordHash, skills: dto.skills ?? [], district: dto.district ?? null },
    });
    return this.sanitizeUser(user, requester);
  }

  async findAll(query: { page?: number; limit?: number; role?: Role; district?: string }) {
    const page = query.page ?? 1; const limit = query.limit ?? 20; const skip = (page - 1) * limit;
    const where: any = {};
    if (query.role) where.role = query.role;
    if (query.district) where.district = query.district;
    const [items, total] = await Promise.all([
      this.prisma.user.findMany({ where, skip, take: limit, orderBy: { createdAt: 'desc' } }),
      this.prisma.user.count({ where }),
    ]);
    return {
      items: items.map((u) => ({
        id: u.id,
        name: u.name,
        phone: null,
        role: u.role,
        skills: u.skills,
        district: u.district,
        dutyStatus: u.dutyStatus,
        avgResponseMin: u.avgResponseMin,
        createdAt: u.createdAt,
      })),
      total,
      page,
      limit,
    };
  }

  async findById(id: string, requester: Requester) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('用户不存在');
    return this.sanitizeUser(user, requester);
  }

  async update(id: string, dto: { name?: string; skills?: string[]; district?: string; dutyStatus?: DutyStatus }) {
    const user = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.skills !== undefined && { skills: dto.skills }),
        ...(dto.district !== undefined && { district: dto.district }),
        ...(dto.dutyStatus !== undefined && { dutyStatus: dto.dutyStatus }),
      },
    });
    return this.stripInternal(user);
  }

  async updateDutyStatus(id: string, status: DutyStatus, requester: Requester) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new BadRequestException('用户不存在');
    if (requester.role !== Role.ADMIN && requester.sub !== id) throw new ForbiddenException('无权限修改他人状态');
    return this.prisma.user.update({ where: { id }, data: { dutyStatus: status }, select: { id: true, dutyStatus: true } });
  }

  private sanitizeUser(user: any, requester: Requester) {
    const isAdmin = requester.role === Role.ADMIN;
    const isSelf = requester.sub === user.id;
    return {
      id: user.id, name: user.name,
      phone: (isAdmin || isSelf) ? this.tryDecrypt(user.phone) : null,
      role: user.role, skills: user.skills, district: user.district,
      dutyStatus: user.dutyStatus, avgResponseMin: user.avgResponseMin, createdAt: user.createdAt,
    };
  }

  private stripInternal(user: any) {
    // 剥离敏感字段（前缀 _ 标记为有意丢弃），并屏蔽手机号
    const { passwordHash: _ph, openid: _op, ...safe } = user;
    return { ...safe, phone: null };
  }

  private tryDecrypt(value: string | null): string | null {
    if (!value) return null;
    try { return this.crypto.decrypt(value); } catch { return value; }
  }
}
