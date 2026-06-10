import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import * as bcrypt from 'bcryptjs';
import { Role } from '@prisma/client';
import { JwtPayload } from './strategies/jwt.strategy';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly crypto: FieldEncryptionService,
  ) {}

  async adminLogin(dto: { phone: string; password: string }) {
    const phoneHash = this.crypto.hashPhone(dto.phone);
    const user = await this.prisma.user.findUnique({ where: { phoneHash } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('手机号或密码错误');
    }
    if (user.role === Role.FAMILY) {
      throw new UnauthorizedException('家属账号不支持后台登录');
    }
    const passwordValid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!passwordValid) {
      throw new UnauthorizedException('手机号或密码错误');
    }
    const payload: JwtPayload = {
      sub: user.id,
      loginType: 'admin',
      role: user.role,
      district: user.district ?? undefined,
    };
    const token = this.jwtService.sign(payload);
    return { token, user: this.sanitizeUser(user) };
  }

  async wechatLogin(openid: string, nickname?: string) {
    const user = await this.prisma.user.upsert({
      where: { openid },
      update: {},
      create: { openid, name: nickname || '微信用户', role: Role.FAMILY },
    });
    const payload: JwtPayload = {
      sub: user.id,
      loginType: 'wechat',
      role: user.role,
      district: user.district ?? undefined,
    };
    const token = this.jwtService.sign(payload);
    return { token, user: this.sanitizeUser(user) };
  }

  async validateUser(userId: string): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException('用户不存在');
    return {
      sub: user.id,
      loginType: 'admin',
      role: user.role,
      district: user.district ?? undefined,
    };
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      name: user.name,
      phone: user.phone,
      role: user.role,
      district: user.district,
      skills: user.skills,
      dutyStatus: user.dutyStatus,
      createdAt: user.createdAt,
    };
  }
}
