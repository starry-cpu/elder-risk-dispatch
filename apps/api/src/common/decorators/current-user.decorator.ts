import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { Role } from '@prisma/client';

/**
 * 经 JwtAuthGuard/Passport 校验后挂在 request.user 上的对象形状，
 * 与 JwtStrategy.validate 的返回值（JwtPayload）一致。
 * controller 中应使用 `@CurrentUser() user: AuthenticatedUser` 而非 `any`。
 *
 * 定义在装饰器旁的 common 层，使各 controller 无需跨模块 import auth 内部。
 */
export interface AuthenticatedUser {
  sub: string;
  loginType: 'wechat' | 'admin' | 'worker';
  role: Role;
  district?: string;
}

export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    const request = ctx.switchToHttp().getRequest();
    const user = request.user;
    return data ? user?.[data] : user;
  },
);
