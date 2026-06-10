import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

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
});
