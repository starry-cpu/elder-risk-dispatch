import { ResponseInterceptor, WrappedResponse } from './response.interceptor';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('ResponseInterceptor', () => {
  let interceptor: ResponseInterceptor<unknown>;

  beforeEach(() => {
    interceptor = new ResponseInterceptor<unknown>();
  });

  function createMockContext(statusCode = 200): ExecutionContext {
    return {
      switchToHttp: () => ({
        getResponse: () => ({ statusCode }),
        getRequest: () => ({}),
      }),
    } as ExecutionContext;
  }

  function createCallHandler<T>(data: T): CallHandler {
    return { handle: () => of(data) };
  }

  it('should wrap plain response data in ApiResponse format', (done) => {
    const context = createMockContext(200);
    const handler = createCallHandler({ name: 'test', id: 1 });

    interceptor.intercept(context, handler).subscribe((result: WrappedResponse<unknown>) => {
      expect(result).toEqual({
        code: 0,
        data: { name: 'test', id: 1 },
        message: 'ok',
      });
      done();
    });
  });

  it('should pass through already-wrapped responses', (done) => {
    const context = createMockContext(200);
    const handler = createCallHandler({ code: 0, data: { a: 1 }, message: 'ok' });

    interceptor.intercept(context, handler).subscribe((result: WrappedResponse<unknown>) => {
      expect(result).toEqual({ code: 0, data: { a: 1 }, message: 'ok' });
      done();
    });
  });

  it('should handle null data', (done) => {
    const context = createMockContext(200);
    const handler = createCallHandler(null);

    interceptor.intercept(context, handler).subscribe((result: WrappedResponse<unknown>) => {
      expect(result).toEqual({ code: 0, data: null, message: 'ok' });
      done();
    });
  });
});
