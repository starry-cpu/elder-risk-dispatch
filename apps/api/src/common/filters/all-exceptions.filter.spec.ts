import { AllExceptionsFilter } from './all-exceptions.filter';
import { HttpException, HttpStatus, ArgumentsHost } from '@nestjs/common';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    filter = new AllExceptionsFilter();
  });

  function createMockHost(): { host: ArgumentsHost; responseBody: Record<string, unknown> } {
    const responseBody: Record<string, unknown> = {};
    const response = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockImplementation((body: Record<string, unknown>) => {
        Object.assign(responseBody, body);
      }),
    };
    const request = { url: '/test', method: 'GET' };
    const host = {
      switchToHttp: () => ({
        getResponse: () => response,
        getRequest: () => request,
      }),
    } as ArgumentsHost;
    return { host, responseBody };
  }

  it('should catch HttpException and return its status with message', () => {
    const { host, responseBody } = createMockHost();
    const exception = new HttpException('Forbidden', HttpStatus.FORBIDDEN);

    filter.catch(exception, host);

    expect(responseBody.code).toBe(403);
    expect(responseBody.data).toBeNull();
    expect(responseBody.message).toBe('Forbidden');
  });

  it('should catch unknown errors and return 500 with generic message', () => {
    const { host, responseBody } = createMockHost();
    const exception = new Error('Database connection failed');

    filter.catch(exception, host);

    expect(responseBody.code).toBe(500);
    expect(responseBody.data).toBeNull();
    expect(responseBody.message).toBe('Internal server error');
  });

  it('should handle HttpException with object response', () => {
    const { host, responseBody } = createMockHost();
    const exception = new HttpException(
      { message: ['name should not be empty', 'age must be positive'] },
      HttpStatus.BAD_REQUEST,
    );

    filter.catch(exception, host);
    expect(responseBody.code).toBe(400);
    expect(responseBody.data).toBeNull();
  });
});
