import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from '@nestjs/common';
import { Request } from 'express';
import { HmacService } from './hmac.service';

@Injectable()
export class HmacGuard implements CanActivate {
  constructor(private readonly hmacService: HmacService) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const signature = request.headers['x-hmac-signature'] as string;
    const timestamp = request.headers['x-hmac-timestamp'] as string;

    if (!signature) {
      throw new UnauthorizedException('缺少 HMAC 签名 (X-HMAC-Signature)');
    }
    if (!timestamp) {
      throw new UnauthorizedException('缺少 HMAC 时间戳 (X-HMAC-Timestamp)');
    }

    const ts = parseInt(timestamp, 10);
    if (isNaN(ts)) {
      throw new UnauthorizedException('HMAC 时间戳格式无效');
    }

    const deviceId = (request.headers['x-device-id'] as string) || 'unknown';
    const payload = request.body;

    if (!this.hmacService.verify(deviceId, payload, signature, ts)) {
      throw new UnauthorizedException('HMAC 签名校验失败');
    }

    return true;
  }
}
