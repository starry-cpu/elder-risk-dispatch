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

  /**
   * 用 wx.login 拿到的 code 换 openid，再走 wechatLogin 完成 upsert + 签发 token。
   * 控制器应调用本方法，而非直接把 code 当作 openid 传入 wechatLogin。
   */
  async wechatLoginWithCode(code: string, nickname?: string) {
    const openid = await this.code2Session(code);
    return this.wechatLogin(openid, nickname);
  }

  /**
   * 调用微信 jscode2session 接口，用登录 code 换取稳定用户标识 openid。
   * 遵循 wechat.channel.ts 的约定：直接读 process.env，使用全局 fetch。
   */
  private async code2Session(code: string): Promise<string> {
    const appId = process.env.WECHAT_APPID;
    const secret = process.env.WECHAT_SECRET;
    if (!appId || !secret) {
      throw new UnauthorizedException('微信登录未配置（缺少 WECHAT_APPID/SECRET）');
    }

    const url =
      `https://api.weixin.qq.com/sns/jscode2session` +
      `?appid=${encodeURIComponent(appId)}` +
      `&secret=${encodeURIComponent(secret)}` +
      `&js_code=${encodeURIComponent(code)}` +
      `&grant_type=authorization_code`;

    let json: { openid?: string; errcode?: number; errmsg?: string };
    try {
      const response = await fetch(url);
      json = (await response.json()) as typeof json;
    } catch (error: any) {
      throw new UnauthorizedException(`微信登录服务不可达：${error?.message ?? error}`);
    }

    if (!json.openid) {
      const detail = json.errmsg ? `（errcode=${json.errcode}: ${json.errmsg}）` : '';
      throw new UnauthorizedException(`微信登录失败${detail}`);
    }
    return json.openid;
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
