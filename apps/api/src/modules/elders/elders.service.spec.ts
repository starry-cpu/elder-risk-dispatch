import { Test, TestingModule } from '@nestjs/testing';
import { EldersService } from './elders.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FieldEncryptionService } from '../../common/crypto/field-encryption.service';
import { Role } from '@prisma/client';

describe('EldersService', () => {
  let service: EldersService;
  let prisma: PrismaService;
  let crypto: FieldEncryptionService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const otherWorker = { sub: 'worker-2', role: Role.GRID_WORKER, district: '海淀区' };

  const encryptedIdCard = 'iv1:tag1:idcard-encrypted';
  const encryptedAddress = 'iv2:tag2:address-encrypted';
  const encryptedPhone = 'iv3:tag3:phone-encrypted';

  const mockPrisma = {
    elder: {
      create: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    emergencyContact: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    elderFamilyLink: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    checkIn: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    deviceData: {
      findMany: jest.fn(),
    },
    visitRecord: {
      count: jest.fn(),
      findMany: jest.fn(),
    },
    riskEvent: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    workOrder: {
      count: jest.fn(),
    },
  };

  const mockCrypto = {
    encrypt: jest.fn().mockImplementation((v: string) => {
      const map: Record<string, string> = {
        '110101199001011234': encryptedIdCard,
        '北京市朝阳区某某街道100号': encryptedAddress,
        '13800138000': encryptedPhone,
        '13900139000': 'iv4:tag4:contact-encrypted',
      };
      return map[v] || `encrypted:${v}`;
    }),
    decrypt: jest.fn().mockImplementation((v: string) => {
      const map: Record<string, string> = {
        [encryptedIdCard]: '110101199001011234',
        [encryptedAddress]: '北京市朝阳区某某街道100号',
        [encryptedPhone]: '13800138000',
        'iv4:tag4:contact-encrypted': '13900139000',
      };
      return map[v] || v;
    }),
    hashPhone: jest.fn().mockReturnValue('test-hash'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EldersService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: FieldEncryptionService, useValue: mockCrypto },
      ],
    }).compile();

    service = module.get<EldersService>(EldersService);
    prisma = module.get<PrismaService>(PrismaService);
    crypto = module.get<FieldEncryptionService>(FieldEncryptionService);
  });

  describe('create', () => {
    it('should create elder with encrypted fields', async () => {
      mockPrisma.elder.create.mockResolvedValue({
        id: 'elder-1',
        name: '张大爷',
        gender: 'M',
        birthDate: new Date('1945-03-10'),
        idCard: encryptedIdCard,
        address: encryptedAddress,
        district: '朝阳区',
        longitude: 116.4,
        latitude: 39.9,
        healthTags: ['慢病', '独居'],
        serviceLevel: 'KEY',
        livingStatus: '独居',
        createdAt: new Date(),
      });

      const result = await service.create(
        {
          name: '张大爷',
          gender: 'M',
          birthDate: '1945-03-10',
          idCard: '110101199001011234',
          address: '北京市朝阳区某某街道100号',
          district: '朝阳区',
          healthTags: ['慢病', '独居'],
          contacts: [{ name: '张小明', relation: '子女', phone: '13900139000' }],
        },
        admin,
      );

      expect(crypto.encrypt).toHaveBeenCalledWith('110101199001011234');
      expect(result.name).toBe('张大爷');
    });

    it('should reject worker creating elder in other district', async () => {
      await expect(
        service.create(
          { name: 'Test', district: '海淀区' },
          worker,
        ),
      ).rejects.toThrow();
    });
  });

  describe('findAll', () => {
    it('should force district filter for non-ADMIN user', async () => {
      mockPrisma.elder.findMany.mockResolvedValue([]);
      mockPrisma.elder.count.mockResolvedValue(0);

      await service.findAll({}, worker);
      expect(mockPrisma.elder.findMany).toHaveBeenCalled();
    });
  });

  describe('findById', () => {
    it('ADMIN sees all decrypted fields', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1',
        name: '张大爷',
        gender: 'M',
        birthDate: new Date('1945-03-10'),
        idCard: encryptedIdCard,
        address: encryptedAddress,
        district: '朝阳区',
        healthTags: ['慢病'],
        serviceLevel: 'KEY',
        contacts: [
          {
            id: 'c1', name: '张小明', relation: '子女',
            phone: 'iv4:tag4:contact-encrypted', isPrimary: true, elderId: 'elder-1',
          },
        ],
        familyLinks: [],
      });

      const result = await service.findById('elder-1', admin);
      expect(result.idCard).toBe('110101199001011234');
      expect(result.address).toBe('北京市朝阳区某某街道100号');
    });

    it('same-district worker sees null idCard and decrypted address', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', name: '张大爷', gender: 'M',
        birthDate: new Date('1945-03-10'), idCard: encryptedIdCard, address: encryptedAddress,
        district: '朝阳区', healthTags: ['慢病'], serviceLevel: 'KEY',
        contacts: [
          { id: 'c1', name: '张小明', relation: '子女', phone: 'iv4:tag4:contact-encrypted', isPrimary: true, elderId: 'elder-1' },
        ],
        familyLinks: [],
      });

      const result = await service.findById('elder-1', worker);
      expect(result.idCard).toBeNull();
      expect(result.address).toBe('北京市朝阳区某某街道100号');
    });

    it('different-district worker gets 403', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', name: '张大爷', district: '朝阳区',
        gender: 'M', birthDate: null, idCard: null, address: null,
        healthTags: [], serviceLevel: 'NORMAL', contacts: [], familyLinks: [],
      });

      await expect(service.findById('elder-1', otherWorker)).rejects.toThrow();
    });
  });

  describe('getRiskProfile', () => {
    it('should return aggregated risk profile', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', name: '张大爷', serviceLevel: 'KEY',
        district: '朝阳区', familyLinks: [],
      });
      mockPrisma.checkIn.count.mockResolvedValue(25);
      mockPrisma.checkIn.findMany.mockResolvedValue([]);
      mockPrisma.visitRecord.count.mockResolvedValue(8);
      mockPrisma.visitRecord.findMany.mockResolvedValue([]);
      mockPrisma.deviceData.findMany.mockResolvedValue([]);
      mockPrisma.riskEvent.findFirst.mockResolvedValue(null);
      mockPrisma.riskEvent.findMany.mockResolvedValue([]);
      mockPrisma.riskEvent.count.mockResolvedValue(0);
      mockPrisma.workOrder.count.mockResolvedValue(3);

      const result = await service.getRiskProfile('elder-1', admin);
      expect(result).toHaveProperty('elderId', 'elder-1');
      expect(result.stats.totalCheckIns).toBe(25);
      expect(result.stats.completedWorkOrders).toBe(3);
      expect(result).toHaveProperty('currentRisk');
      expect(result).toHaveProperty('recentRiskEvents');
    });

    it('should include recent check-ins, visits and device alarms with summary', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', name: '张大爷', serviceLevel: 'KEY',
        district: '朝阳区', familyLinks: [],
      });
      mockPrisma.checkIn.count.mockResolvedValue(25);
      mockPrisma.checkIn.findMany.mockResolvedValue([
        { id: 'ci-1', method: 'ONE_TAP', status: 'NORMAL', createdAt: new Date() },
      ]);
      mockPrisma.visitRecord.count.mockResolvedValue(8);
      mockPrisma.visitRecord.findMany.mockResolvedValue([
        { id: 'v-1', observation: '正常', visitTime: new Date() },
      ]);
      mockPrisma.deviceData.findMany.mockResolvedValue([
        { id: 'dd-1', deviceType: 'FALL_DETECTOR', metricType: 'FALL', alarm: true, timestamp: new Date() },
      ]);
      mockPrisma.riskEvent.findFirst.mockResolvedValue(null);
      mockPrisma.riskEvent.findMany.mockResolvedValue([]);
      mockPrisma.riskEvent.count.mockResolvedValue(0);
      mockPrisma.workOrder.count.mockResolvedValue(3);

      const result = await service.getRiskProfile('elder-1', admin);

      expect(result).toHaveProperty('recentCheckIns');
      expect(result.recentCheckIns).toHaveLength(1);
      expect(result).toHaveProperty('recentVisits');
      expect(result.recentVisits).toHaveLength(1);
      expect(result).toHaveProperty('recentDeviceAlarms');
      expect(result.recentDeviceAlarms).toHaveLength(1);
      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('checkInStreak');
      expect(result.summary).toHaveProperty('missedToday');
      expect(result.summary).toHaveProperty('activeAlarms');
    });
  });

  describe('update', () => {
    it('should check district authorization before updating', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', district: '朝阳区', familyLinks: [],
      });
      mockPrisma.elder.update.mockResolvedValue({
        id: 'elder-1', name: 'Updated', district: '朝阳区', contacts: [],
      });

      const result = await service.update('elder-1', { name: 'Updated' }, admin);
      expect(result.name).toBe('Updated');
    });
  });

  describe('addContact', () => {
    it('should check authorization before adding contact', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', district: '朝阳区', familyLinks: [],
      });
      mockPrisma.emergencyContact.create.mockResolvedValue({
        id: 'c1', elderId: 'elder-1', name: '张小明', relation: '子女',
        phone: 'iv4:tag4:contact-encrypted', isPrimary: true,
      });

      const result = await service.addContact('elder-1', {
        name: '张小明', relation: '子女', phone: '13900139000',
      }, admin);
      expect(result.name).toBe('张小明');
    });
  });

  describe('getContacts', () => {
    it('should check authorization before listing contacts', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({
        id: 'elder-1', district: '朝阳区', familyLinks: [],
      });
      mockPrisma.emergencyContact.findMany.mockResolvedValue([
        { id: 'c1', elderId: 'elder-1', name: '张小明', relation: '子女', phone: 'iv4:tag4:contact-encrypted', isPrimary: true },
      ]);

      const result = await service.getContacts('elder-1', admin);
      expect(result).toHaveLength(1);
    });
  });

  describe('findMine', () => {
    it('should return elders linked to the requesting FAMILY user', async () => {
      mockPrisma.elderFamilyLink.findMany.mockResolvedValue([
        { elderId: 'e-1', elder: { id: 'e-1', name: '张大爷', serviceLevel: 'HIGH', district: '朝阳区' } },
        { elderId: 'e-2', elder: { id: 'e-2', name: '李奶奶', serviceLevel: 'NORMAL', district: '朝阳区' } },
      ]);

      const result = await service.findMine({ sub: 'user-1', role: Role.FAMILY });

      expect(mockPrisma.elderFamilyLink.findMany).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        include: { elder: { select: { id: true, name: true, serviceLevel: true, district: true } } },
      });
      expect(result.items).toHaveLength(2);
      expect(result.items[0]).toEqual({ id: 'e-1', name: '张大爷', serviceLevel: 'HIGH', district: '朝阳区' });
    });

    it('should return empty items when user has no family links', async () => {
      mockPrisma.elderFamilyLink.findMany.mockResolvedValue([]);

      const result = await service.findMine({ sub: 'orphan-user', role: Role.FAMILY });

      expect(result.items).toEqual([]);
    });
  });
});
