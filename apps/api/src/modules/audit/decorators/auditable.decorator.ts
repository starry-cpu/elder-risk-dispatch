import { SetMetadata } from '@nestjs/common';

export const AUDITABLE_KEY = 'auditable';

export interface AuditableOptions {
  resourceIdParam?: string;    // 默认 'id'
  sensitiveFields?: string[];   // 需脱敏字段
  logRequestBody?: boolean;     // 默认 false
}

export interface AuditableMetadata {
  resourceType: string;
  action: string;
  options: AuditableOptions;
}

export const Auditable = (
  resourceType: string,
  action: string,
  options: AuditableOptions = {},
) => SetMetadata(AUDITABLE_KEY, { resourceType, action, options });
