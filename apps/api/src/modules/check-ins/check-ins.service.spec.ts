import { Test, TestingModule } from '@nestjs/testing';
import { CheckInsService } from './check-ins.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Role, CheckInMethod } from '@prisma/client';
import { AiService } from '../ai/ai.service';
import { RiskService } from '../risk/risk.service';

describe('CheckInsService', () => {
  let service: CheckInsService;

  const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区' };
  const familyUser = { sub: 'family-1', role: Role.FAMILY, district: undefined };
  const worker = { sub: 'worker-1', role: Role.GRID_WORKER, district: '朝阳区' };
  const otherWorker = { sub: 'worker-2', role: Role.GRID_WORKER, district: '海淀区' };

  const mockElder = {
    id: 'elder-1',
    name: '张大爷',
    district: '朝阳区',
    familyLinks: [{ userId: 'family-1', elderId: 'elder-1', relation: '子女' }],
  };

  const mockPrisma = {
    elder: {
      findUnique: jest.fn(),
    },
    checkIn: {
      create: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
  };

  const mockAiService = {
    classify: jest.fn(),
  };

  const mockRiskService = {
    evaluateAndCreateEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CheckInsService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: AiService, useValue: mockAiService },
        { provide: RiskService, useValue: mockRiskService },
      ],
    }).compile();
    service = module.get<CheckInsService>(CheckInsService);
    jest.clearAllMocks();
  });

  describe('create', () => {
    it('should create ONE_TAP check-in for linked family member', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-1', elderId: 'elder-1', method: 'ONE_TAP',
        content: null, voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.ONE_TAP },
        familyUser,
      );
      expect(result.method).toBe('ONE_TAP');
      expect(result.status).toBe('NORMAL');
    });

    it('should allow ADMIN to create ONE_TAP check-in for any elder', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-admin', elderId: 'elder-1', method: 'ONE_TAP',
        content: null, voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.ONE_TAP },
        admin,
      );
      expect(result.method).toBe('ONE_TAP');
    });

    it('should create VOICE check-in with voiceUrl', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-2', elderId: 'elder-1', method: 'VOICE',
        content: null, voiceUrl: 'https://s3/care/checkins/abc.wav', status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.VOICE, voiceUrl: 'https://s3/care/checkins/abc.wav' },
        familyUser,
      );
      expect(result.voiceUrl).toBe('https://s3/care/checkins/abc.wav');
    });

    it('should create TEXT check-in with content', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-3', elderId: 'elder-1', method: 'TEXT',
        content: '今天一切正常', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '今天一切正常' },
        familyUser,
      );
      expect(result.content).toBe('今天一切正常');
    });

    it('should allow GRID_WORKER in same district to create PROXY check-in', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-4', elderId: 'elder-1', method: 'PROXY',
        content: '网格员代报', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.PROXY, content: '网格员代报' },
        worker,
      );
      expect(result.method).toBe('PROXY');
    });

    it('should reject FAMILY user without ElderFamilyLink binding', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue({ ...mockElder, familyLinks: [] });
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.ONE_TAP }, familyUser),
      ).rejects.toThrow('无权限');
    });

    it('should reject cross-district GRID_WORKER', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.ONE_TAP }, otherWorker),
      ).rejects.toThrow('无权限');
    });

    it('should throw 404 when elder not found', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(null);
      await expect(
        service.create({ elderId: 'nonexistent', method: CheckInMethod.ONE_TAP }, admin),
      ).rejects.toThrow('老人不存在');
    });

    it('should reject VOICE without voiceUrl', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.VOICE }, familyUser),
      ).rejects.toThrow('语音文件 URL');
    });

    it('should reject TEXT without content', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.TEXT }, familyUser),
      ).rejects.toThrow('文本内容');
    });

    it('should reject PROXY without content from GRID_WORKER', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.create({ elderId: 'elder-1', method: CheckInMethod.PROXY }, worker),
      ).rejects.toThrow('备注说明');
    });

    // ========== AI abnormal text detection integration tests ==========

    // Helper: flush pending microtasks for fire-and-forget detection
    const flushPromises = () => new Promise(resolve => setImmediate(resolve));

    it('normal text (ERRAND high confidence) should NOT trigger risk event', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-ai-1', elderId: 'elder-1', method: 'TEXT',
        content: '需要买米', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });
      mockAiService.classify.mockResolvedValue({
        type: 'ERRAND', confidence: 0.92, needsHumanReview: false,
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '需要买米' },
        familyUser,
      );
      await flushPromises();

      expect(result).toBeDefined();
      expect(mockAiService.classify).toHaveBeenCalledWith('需要买米');
      expect(mockRiskService.evaluateAndCreateEvent).not.toHaveBeenCalled();
    });

    it('HEALTH high confidence text should trigger ABNORMAL_TEXT risk event', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-ai-2', elderId: 'elder-1', method: 'TEXT',
        content: '我头晕需要帮助', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });
      mockAiService.classify.mockResolvedValue({
        type: 'HEALTH', confidence: 0.88, needsHumanReview: false,
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '我头晕需要帮助' },
        familyUser,
      );
      await flushPromises();

      expect(result).toBeDefined();
      expect(mockAiService.classify).toHaveBeenCalledWith('我头晕需要帮助');
      expect(mockRiskService.evaluateAndCreateEvent).toHaveBeenCalledWith({
        elderId: 'elder-1',
        abnormalText: true,
      });
    });

    it('low confidence (needsHumanReview=true) should trigger risk event', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-ai-3', elderId: 'elder-1', method: 'TEXT',
        content: '不太清楚...嗯...那个...', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });
      mockAiService.classify.mockResolvedValue({
        type: 'LIFE', confidence: 0.35, needsHumanReview: true,
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '不太清楚...嗯...那个...' },
        familyUser,
      );
      await flushPromises();

      expect(result).toBeDefined();
      expect(mockRiskService.evaluateAndCreateEvent).toHaveBeenCalledWith({
        elderId: 'elder-1',
        abnormalText: true,
      });
    });

    it('AI classification failure should silently degrade, not block CheckIn creation', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-ai-4', elderId: 'elder-1', method: 'TEXT',
        content: '需要帮助', voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });
      mockAiService.classify.mockRejectedValue(new Error('AI service unavailable'));

      // should NOT throw
      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.TEXT, content: '需要帮助' },
        familyUser,
      );
      await flushPromises();

      expect(result).toBeDefined();
      expect(result.method).toBe('TEXT');
      // AI unavailable should NOT trigger risk event
      expect(mockRiskService.evaluateAndCreateEvent).not.toHaveBeenCalled();
    });

    it('ONE_TAP method (no text content) should NOT call AI classification', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.create.mockResolvedValue({
        id: 'ci-ai-5', elderId: 'elder-1', method: 'ONE_TAP',
        content: null, voiceUrl: null, status: 'NORMAL', createdAt: new Date(),
      });

      const result = await service.create(
        { elderId: 'elder-1', method: CheckInMethod.ONE_TAP },
        familyUser,
      );
      await flushPromises();

      expect(result).toBeDefined();
      expect(mockAiService.classify).not.toHaveBeenCalled();
      expect(mockRiskService.evaluateAndCreateEvent).not.toHaveBeenCalled();
    });
  });

  describe('findByElder', () => {
    it('should return paginated check-ins for authorized user', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.findMany.mockResolvedValue([
        { id: 'ci-1', elderId: 'elder-1', method: 'ONE_TAP', content: null, voiceUrl: null, status: 'NORMAL', createdAt: new Date() },
      ]);
      mockPrisma.checkIn.count.mockResolvedValue(1);

      const result = await service.findByElder('elder-1', { page: 1, limit: 20 }, worker);
      expect(result.items).toHaveLength(1);
      expect(result.total).toBe(1);
    });

    it('should allow ADMIN to query any elder check-ins', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      mockPrisma.checkIn.findMany.mockResolvedValue([]);
      mockPrisma.checkIn.count.mockResolvedValue(0);

      const result = await service.findByElder('elder-1', { page: 1, limit: 20 }, admin);
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('should reject cross-district access', async () => {
      mockPrisma.elder.findUnique.mockResolvedValue(mockElder);
      await expect(
        service.findByElder('elder-1', { page: 1, limit: 20 }, otherWorker),
      ).rejects.toThrow('无权限');
    });
  });
});
