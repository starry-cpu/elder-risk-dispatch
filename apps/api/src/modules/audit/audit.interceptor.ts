import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Prisma } from '@prisma/client';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from './audit.service';
import {
  AUDITABLE_KEY,
  AuditableMetadata,
} from './decorators/auditable.decorator';
import { sanitizeAuditData } from './filters/audit-sensitive.filter';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const metadata = this.reflector.get<AuditableMetadata>(
      AUDITABLE_KEY,
      context.getHandler(),
    );

    if (!metadata) {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest();
    const userId = request.user?.sub ?? null;
    const ip = request.ip ?? null;
    const { resourceType, action, options } = metadata;
    const resourceIdParam = options.resourceIdParam ?? 'id';
    const resourceId = request.params[resourceIdParam] ?? null;

    let detail: Prisma.InputJsonValue | null = null;
    if (options.logRequestBody && request.body) {
      const rawDetail: Record<string, unknown> = { ...request.body };
      detail = options.sensitiveFields?.length
        ? (sanitizeAuditData(
            rawDetail,
            options.sensitiveFields,
          ) as unknown as Prisma.InputJsonValue)
        : (rawDetail as unknown as Prisma.InputJsonValue);
    }

    return next.handle().pipe(
      tap(() => {
        this.auditService
          .log({ userId, action, resourceType, resourceId, detail, ip })
          .catch((err) => {
            this.logger.error(
              `Audit log in tap failed: ${action} on ${resourceType}`,
              err instanceof Error ? err.message : String(err),
            );
          });
      }),
    );
  }
}
