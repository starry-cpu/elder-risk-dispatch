import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsAuthGuard implements CanActivate {
  private readonly logger = new Logger(WsAuthGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const client: Socket = context.switchToWs().getClient();
    const token = this.extractToken(client);

    if (!token) {
      this.logger.warn('WS connection rejected: no token');
      throw new WsException('Unauthorized: missing token');
    }

    try {
      const payload = this.jwtService.verify(token);
      (client as unknown as Record<string, unknown>).user = payload;
      return true;
    } catch {
      this.logger.warn('WS connection rejected: invalid token');
      throw new WsException('Unauthorized: invalid token');
    }
  }

  private extractToken(client: Socket): string | null {
    if (client.handshake.auth?.token) {
      return client.handshake.auth.token as string;
    }
    if (client.handshake.query?.token) {
      return Array.isArray(client.handshake.query.token)
        ? client.handshake.query.token[0]
        : client.handshake.query.token;
    }
    return null;
  }
}
