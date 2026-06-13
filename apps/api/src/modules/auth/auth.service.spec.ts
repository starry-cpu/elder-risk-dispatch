import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

// Mock global fetch（复刻 wechat.channel.spec.ts 的写法）
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('AuthService', () => {
  let service: AuthService;
  let prisma: PrismaService;
  let jwt: JwtService;

  const phoneHash = 'sha256-hash-of-13800138000';

  const mockPrisma = {
    user: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      create: jest.fn(),
    },
  };

  const mockJwt = {
    sign: jest.fn().mockReturnValue('mock-jwt-token'),
  };

  const mockCrypto = {
    hashPhone: jest.fn().mockReturnValue(phoneHash),
    encrypt: jest.fn(),
    decrypt: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: JwtService, useValue: mockJwt },
        { provide: FieldEncryptionService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    prisma = module.get<PrismaService>(PrismaService);
    jwt = module.get<JwtService>(JwtService);
  });

  describe('adminLogin', () => {
    it('should return token and user for valid credentials', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        phoneHash,
        phone: 'encrypted-phone',
        name: '管理员',
        role: Role.ADMIN,
        passwordHash: hash,
        district: '朝阳区',
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });

      const result = await service.adminLogin({ phone: '13800138000', password: 'password123' });
      expect(mockCrypto.hashPhone).toHaveBeenCalledWith('13800138000');
      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({ where: { phoneHash } });
      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.user.role).toBe(Role.ADMIN);
    });

    it('should throw for invalid password', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        phoneHash,
        name: '管理员',
        role: Role.ADMIN,
        passwordHash: hash,
      });
      await expect(
        service.adminLogin({ phone: '13800138000', password: 'wrong' }),
      ).rejects.toThrow();
    });

    it('should throw when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(
        service.adminLogin({ phone: '13900000000', password: 'x' }),
      ).rejects.toThrow();
    });

    it('should reject FAMILY role from admin login', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2',
        phoneHash: 'fam-hash',
        name: '家属',
        role: Role.FAMILY,
        passwordHash: hash,
      });
      await expect(
        service.adminLogin({ phone: '13900139000', password: 'password123' }),
      ).rejects.toThrow();
    });

    it('should NOT expose openid in sanitized response', async () => {
      const hash = await bcrypt.hash('password123', 10);
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        phoneHash,
        phone: 'encrypted-phone',
        openid: 'secret-openid-should-not-leak',
        name: '管理员',
        role: Role.ADMIN,
        passwordHash: hash,
        district: '朝阳区',
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });

      const result = await service.adminLogin({ phone: '13800138000', password: 'password123' });
      expect(result.user).not.toHaveProperty('openid');
      expect(result.user).not.toHaveProperty('passwordHash');
    });
  });

  describe('wechatLogin', () => {
    it('should return token for wechat user', async () => {
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'user-3',
        openid: 'openid-abc',
        name: '微信用户',
        role: Role.FAMILY,
        district: null,
        phone: null,
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });
      const result = await service.wechatLogin('openid-abc', undefined);
      expect(result).toHaveProperty('token');
      expect(result.user.role).toBe(Role.FAMILY);
    });

    it('should create new user on first wechat login', async () => {
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'user-4',
        openid: 'openid-new',
        name: '新用户',
        role: Role.FAMILY,
        district: null,
        phone: null,
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });
      const result = await service.wechatLogin('openid-new', undefined);
      expect(mockPrisma.user.upsert).toHaveBeenCalled();
      expect(result.user).not.toHaveProperty('openid');
      expect(result.user.name).toBe('新用户');
    });
  });

  describe('validateUser', () => {
    it('should return user payload for valid token', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        name: '管理员',
        role: Role.ADMIN,
        district: '朝阳区',
        phone: null,
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });
      const result = await service.validateUser('user-1');
      expect(result).toHaveProperty('sub', 'user-1');
      expect(result).toHaveProperty('role', Role.ADMIN);
    });

    it('should throw when user not found', async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      await expect(service.validateUser('non-existent')).rejects.toThrow();
    });
  });

  describe('wechatLoginWithCode', () => {
    beforeEach(() => {
      mockFetch.mockReset();
    });

    afterEach(() => {
      delete process.env.WECHAT_APPID;
      delete process.env.WECHAT_SECRET;
    });

    it('should exchange code for openid and return token + user', async () => {
      process.env.WECHAT_APPID = 'wx-test-appid';
      process.env.WECHAT_SECRET = 'test-secret';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ openid: 'openid-from-wechat' }),
      });
      mockPrisma.user.upsert.mockResolvedValue({
        id: 'user-5',
        openid: 'openid-from-wechat',
        name: '微信用户',
        role: Role.FAMILY,
        district: null,
        phone: null,
        skills: [],
        dutyStatus: 'OFF_DUTY',
        createdAt: new Date(),
      });

      const result = await service.wechatLoginWithCode('wx-login-code', undefined);

      // 应调用 jscode2session 且带上 code
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('js_code=wx-login-code'),
      );
      // upsert 用换来的 openid，而非原始 code
      expect(mockPrisma.user.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { openid: 'openid-from-wechat' } }),
      );
      expect(result).toHaveProperty('token');
      expect(result.user.role).toBe(Role.FAMILY);
      expect(result.user).not.toHaveProperty('openid');
    });

    it('should throw UnauthorizedException when WECHAT_APPID/SECRET not configured', async () => {
      // 不设置凭据（afterEach 也会清理）
      await expect(service.wechatLoginWithCode('any-code')).rejects.toThrow(
        UnauthorizedException,
      );
      // 凭据缺失时不应发起外部请求
      expect(mockFetch).not.toHaveBeenCalled();
    });

    it('should throw with WeChat errmsg when jscode2session returns errcode', async () => {
      process.env.WECHAT_APPID = 'wx-test-appid';
      process.env.WECHAT_SECRET = 'test-secret';

      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ errcode: 40029, errmsg: 'invalid code' }),
      });

      await expect(service.wechatLoginWithCode('bad-code')).rejects.toThrow(
        /invalid code/,
      );
    });
  });
});
