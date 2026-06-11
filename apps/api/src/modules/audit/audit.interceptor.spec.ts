import { Test, TestingModule } from '@nestjs/testing';
import { AuditInterceptor } from './audit.interceptor';
import { AuditService } from './audit.service';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, CallHandler } from '@nestjs/common';
import { of } from 'rxjs';
import { AUDITABLE_KEY } from './decorators/auditable.decorator';

describe('AuditInterceptor', () => {
  let interceptor: AuditInterceptor;
  let auditService: { log: jest.Mock };
  let reflector: { get: jest.Mock };

  beforeEach(async () => {
    auditService = { log: jest.fn().mockResolvedValue(undefined) };
    reflector = { get: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuditInterceptor,
        { provide: AuditService, useValue: auditService },
        { provide: Reflector, useValue: reflector },
      ],
    }).compile();

    interceptor = module.get<AuditInterceptor>(AuditInterceptor);
  });

  function mockContext(
    metadata: unknown,
    params: Record<string, string>,
    user: unknown,
    ip: string,
  ) {
    const handler = {};
    reflector.get.mockReturnValue(metadata);
    return {
      getHandler: () => handler,
      switchToHttp: () => ({
        getRequest: () => ({ params, user, ip }),
      }),
    } as unknown as ExecutionContext;
  }

  it('无 @Auditable 装饰器时不写审计', (done) => {
    const ctx = mockContext(
      undefined,
      { id: 'r-1' },
      { sub: 'u-1', role: 'ADMIN' },
      '127.0.0.1',
    );
    const next: CallHandler = { handle: () => of({ id: 'r-1' }) };

    interceptor.intercept(ctx, next).subscribe((result: unknown) => {
      const data = result as Record<string, unknown>;
      expect(auditService.log).not.toHaveBeenCalled();
      expect(data['id']).toBe('r-1');
      done();
    });
  });

  it('有 @Auditable 装饰器时写入审计日志', (done) => {
    const metadata = {
      resourceType: 'RISK',
      action: 'CONFIRM',
      options: { resourceIdParam: 'id' },
    };
    const ctx = mockContext(
      metadata,
      { id: 'r-1' },
      { sub: 'u-1', role: 'ADMIN' },
      '10.0.0.1',
    );
    const next: CallHandler = { handle: () => of({ id: 'r-1' }) };

    interceptor.intercept(ctx, next).subscribe((result: unknown) => {
      const data = result as Record<string, unknown>;
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u-1',
          action: 'CONFIRM',
          resourceType: 'RISK',
          resourceId: 'r-1',
          ip: '10.0.0.1',
        }),
      );
      expect(data['id']).toBe('r-1');
      done();
    });
  });

  it('敏感字段应脱敏后再写入 audit detail', (done) => {
    const metadata = {
      resourceType: 'ELDER',
      action: 'UPDATE',
      options: {
        resourceIdParam: 'id',
        sensitiveFields: ['phone', 'idCard'],
        logRequestBody: true,
      },
    };
    const body = {
      name: '张大爷',
      phone: '13800001111',
      idCard: '110101199001011234',
    };
    const ctx = {
      getHandler: () => ({}),
      switchToHttp: () => ({
        getRequest: () => ({
          params: { id: 'e-1' },
          user: { sub: 'u-1', role: 'ADMIN' },
          ip: '10.0.0.2',
          body,
        }),
      }),
    } as unknown as ExecutionContext;
    reflector.get.mockReturnValue(metadata);
    const next: CallHandler = { handle: () => of({ id: 'e-1' }) };

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          detail: expect.objectContaining({
            name: '张大爷',
            phone: '1*********1',
            idCard: '**************1234',
          }),
        }),
      );
      done();
    });
  });

  it('未认证用户的 userId 应为 null', (done) => {
    const metadata = { resourceType: 'ELDER', action: 'CREATE', options: {} };
    const ctx = mockContext(metadata, { id: 'e-3' }, undefined, '10.0.0.3');
    const next: CallHandler = { handle: () => of({ id: 'e-3' }) };

    interceptor.intercept(ctx, next).subscribe(() => {
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ userId: null }),
      );
      done();
    });
  });

  it('审计写入失败不应影响响应', (done) => {
    const metadata = { resourceType: 'AUTH', action: 'LOGIN', options: {} };
    auditService.log.mockRejectedValue(new Error('DB error'));
    const ctx = mockContext(
      metadata,
      {},
      { sub: 'u-1', role: 'ADMIN' },
      '127.0.0.1',
    );
    const next: CallHandler = { handle: () => of({ token: 'jwt' }) };

    interceptor.intercept(ctx, next).subscribe((result: unknown) => {
      const data = result as Record<string, unknown>;
      expect(data['token']).toBe('jwt');
      expect(auditService.log).toHaveBeenCalled();
      done();
    });
  });
});
