import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Role } from '@prisma/client';
import { ROLES_KEY } from '../../../common/decorators/roles.decorator';

@Injectable()
export class WsRolesGuard implements CanActivate {
  private readonly logger = new Logger(WsRolesGuard.name);

  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<Role[]>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (!requiredRoles || requiredRoles.length === 0) return true;

    const client = context.switchToWs().getClient();
    const user = (client as unknown as Record<string, unknown>).user as {
      role?: Role;
    } | undefined;

    if (!user?.role || !requiredRoles.includes(user.role)) {
      this.logger.warn(`WS room access denied: required ${requiredRoles.join(',')}`);
      return false;
    }

    return true;
  }
}
