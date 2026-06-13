import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { Role } from '@prisma/client';

describe('AuthController', () => {
  let controller: AuthController;
  let service: AuthService;

  const mockAuthService = {
    wechatLogin: jest.fn(),
    wechatLoginWithCode: jest.fn(),
    adminLogin: jest.fn(),
    validateUser: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [{ provide: AuthService, useValue: mockAuthService }],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    service = module.get<AuthService>(AuthService);
  });

  describe('POST /auth/wechat-login', () => {
    it('should return token and user', async () => {
      mockAuthService.wechatLoginWithCode.mockResolvedValue({
        token: 'jwt-token',
        user: { id: '1', name: 'Test', role: Role.FAMILY },
      });
      const result = await controller.wechatLogin({ code: 'test-code' });
      // 控制器应委托给 wechatLoginWithCode（用 code 换 openid 再签发）
      expect(mockAuthService.wechatLoginWithCode).toHaveBeenCalledWith('test-code', undefined);
      expect(result).toHaveProperty('token');
    });
  });

  describe('POST /auth/admin-login', () => {
    it('should return token and user', async () => {
      mockAuthService.adminLogin.mockResolvedValue({
        token: 'jwt-token',
        user: { id: '2', name: 'Admin', role: Role.ADMIN },
      });
      const result = await controller.adminLogin({ phone: '13800138000', password: 'pass' });
      expect(result).toHaveProperty('token');
    });
  });

  describe('GET /auth/me', () => {
    it('should return current user info', async () => {
      const user = { sub: '1', role: Role.ADMIN, district: '朝阳区', loginType: 'admin' as const };
      const result = await controller.getMe(user);
      expect(result).toEqual(user);
    });
  });
});
