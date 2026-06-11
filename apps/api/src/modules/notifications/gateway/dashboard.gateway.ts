import {
  WebSocketGateway,
  WebSocketServer,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@WebSocketGateway({
  namespace: '/dashboard',
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') ?? ['http://localhost:3000'],
    credentials: true,
  },
})
export class DashboardGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(DashboardGateway.name);

  constructor(
    private readonly jwtService: JwtService,
  ) {}

  handleConnection(client: Socket): void {
    const token = client.handshake.auth?.token as string | undefined;
    if (!token) {
      this.logger.warn(`WS client ${client.id} rejected: no token`);
      client.disconnect();
      return;
    }

    try {
      const user = this.jwtService.verify(token);
      (client as unknown as Record<string, unknown>).user = user;

      client.join(`user:${user.sub}`);
      client.join(`role:${user.role}`);
      if (user.district) {
        client.join(`district:${user.district}`);
      }

      this.logger.log(`WS client ${client.id} connected as ${user.role}:${user.sub}`);
    } catch {
      this.logger.warn(`WS client ${client.id} rejected: invalid token`);
      client.disconnect();
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`WS client ${client.id} disconnected`);
  }

  emitToUser(userId: string, event: string, data: unknown): void {
    this.server.to(`user:${userId}`).emit(event, data);
  }

  emitToRole(role: string, event: string, data: unknown): void {
    this.server.to(`role:${role}`).emit(event, data);
  }

  emitToDistrict(district: string, event: string, data: unknown): void {
    this.server.to(`district:${district}`).emit(event, data);
  }
}
