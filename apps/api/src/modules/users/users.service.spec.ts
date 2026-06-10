import { Test, TestingModule } from '@nestjs/testing';
import { UsersService } from './users.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role, DutyStatus } from '@prisma/client';
import { ForbiddenException, BadRequestException } from '@nestjs/common';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: PrismaService;
  let crypto: FieldEncryptionService;

  const encryptedPhone = 'ab:cd:ef123456';

  const mockPrisma = {
    user: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockCrypto = {
    encrypt: jest.fn().mockReturnValue(encryptedPhone),
    decrypt: jest.fn().mockImplementation((val: string) => {
      if (val === encryptedPhone) return '13800138000';
      return val;
    }),
  };

  const adminUser = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区', loginType: 'admin' };
  const workerUser = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区', loginType: 'admin' };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FieldEncryptionService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    prisma = module.get<PrismaService>(PrismaService);
    crypto = module.get<FieldEncryptionService>(FieldEncryptionService);

    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create a user with encrypted phone', async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: 'user-1', phone: encryptedPhone, name: '网格员A',
        role: Role.GRID_WORKER, skills: [], district: '朝阳区',
        dutyStatus: 'OFF_DUTY', createdAt: new Date(),
      });

      const result = await service.create({
        phone: '13800138000', name: '网格员A', role: Role.GRID_WORKER,
        password: 'pass123', district: '朝阳区',
      }, adminUser);

      expect(crypto.encrypt).toHaveBeenCalledWith('13800138000');
      expect(mockPrisma.user.create).toHaveBeenCalled();
      expect(result.name).toBe('网格员A');
    });

    it('should throw if non-FAMILY user has no password', async () => {
      await expect(
        service.create({ phone: '13800138000', name: 'NoPass', role: Role.ADMIN }, adminUser),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow FAMILY user without password', async () => {
      mockPrisma.user.create.mockResolvedValue({
        id: 'fam-1', phone: encryptedPhone, name: '家属A',
        role: Role.FAMILY, skills: [], district: null,
        dutyStatus: 'OFF_DUTY', createdAt: new Date(),
      });

      const result = await service.create({
        phone: '13900139000', name: '家属A', role: Role.FAMILY,
      }, adminUser);

      expect(result.role).toBe(Role.FAMILY);
    });
  });

  describe('findAll', () => {
    it('should return paginated user list (ADMIN)', async () => {
      mockPrisma.user.findMany.mockResolvedValue([]);
      mockPrisma.user.count.mockResolvedValue(0);

      const result = await service.findAll({ page: 1, limit: 10 });
      expect(result).toHaveProperty('items');
      expect(result).toHaveProperty('total');
      expect(result).toHaveProperty('page', 1);
    });
  });

  describe('findById', () => {
    it('ADMIN sees decrypted phone', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-1', phone: encryptedPhone, name: 'Test',
        role: Role.GRID_WORKER, district: '朝阳区', skills: [],
        dutyStatus: 'OFF_DUTY', createdAt: new Date(),
      });

      const result = await service.findById('user-1', adminUser);
      expect(result.phone).toBe('13800138000');
    });

    it('non-ADMIN/non-self user sees null phone', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: 'user-2', phone: encryptedPhone, name: 'Other',
        role: Role.GRID_WORKER, district: '朝阳区', skills: [],
        dutyStatus: 'OFF_DUTY', createdAt: new Date(),
      });

      const result = await service.findById('user-2', { ...workerUser, sub: 'user-3' });
      expect(result.phone).toBeNull();
    });
  });

  describe('updateDutyStatus', () => {
    it('should allow user to toggle their own status', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.GRID_WORKER });
      mockPrisma.user.update.mockResolvedValue({ id: 'user-1', dutyStatus: 'ON_DUTY' });

      const result = await service.updateDutyStatus('user-1', DutyStatus.ON_DUTY, { sub: 'user-1', role: Role.GRID_WORKER });
      expect(result).toEqual({ id: 'user-1', dutyStatus: 'ON_DUTY' });
    });

    it('should throw ForbiddenException when others try to toggle', async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: 'user-1', role: Role.GRID_WORKER });
      await expect(
        service.updateDutyStatus('user-1', DutyStatus.ON_DUTY, { sub: 'user-2', role: Role.GRID_WORKER }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
