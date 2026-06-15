import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Role } from '@prisma/client';

/**
 * JWT 载荷结构，同时也是经 Passport 校验后挂在 request.user 上的对象形状。
 * role 用 Prisma 的 Role 枚举而非裸 string，让下游 service 的 Requester 类型
 * 可以直接复用，避免 controller 里 `user: any` 的常见反模式。
 */
export interface JwtPayload {
  sub: string;
  loginType: 'wechat' | 'admin' | 'worker';
  role: Role;
  district?: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(
    configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {
    const secret = configService.get<string>('JWT_SECRET');
    if (!secret) {
      throw new UnauthorizedException('JWT_SECRET is not configured');
    }
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: secret,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: { id: true, role: true, district: true },
    });
    if (!user) {
      throw new UnauthorizedException('用户不存在或已被删除');
    }
    return {
      sub: user.id,
      loginType: payload.loginType,
      role: user.role,
      district: user.district ?? undefined,
    };
  }
}
