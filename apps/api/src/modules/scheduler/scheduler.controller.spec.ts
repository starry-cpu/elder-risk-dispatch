import { Test, TestingModule } from '@nestjs/testing';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { getQueueToken } from '@nestjs/bullmq';

describe('SchedulerController', () => {
  let controller: SchedulerController;

  const mockService = {
    scanMissedCheckIns: jest.fn(),
    escalateTimeouts: jest.fn(),
    getRuns: jest.fn(),
  };
  const mockQueue = { add: jest.fn() };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [SchedulerController],
      providers: [
        { provide: SchedulerService, useValue: mockService },
        { provide: getQueueToken('scheduler'), useValue: mockQueue },
      ],
    }).compile();

    controller = module.get<SchedulerController>(SchedulerController);
    jest.clearAllMocks();
  });

  describe('POST /scheduler/trigger/missed-checkin', () => {
    it('should add job to scheduler queue and return accepted', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-1' });

      const result = await controller.triggerMissedCheckin();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'missed-checkin-scan',
        {},
        { jobId: expect.stringContaining('missed-checkin-manual') },
      );
      expect(result).toEqual({ accepted: true, jobName: 'missed-checkin-scan' });
    });
  });

  describe('POST /scheduler/trigger/workorder-escalate', () => {
    it('should add job to scheduler queue and return accepted', async () => {
      mockQueue.add.mockResolvedValue({ id: 'job-2' });

      const result = await controller.triggerWorkorderEscalate();

      expect(mockQueue.add).toHaveBeenCalledWith(
        'workorder-timeout-escalate',
        {},
        { jobId: expect.stringContaining('workorder-escalate-manual') },
      );
      expect(result).toEqual({ accepted: true, jobName: 'workorder-timeout-escalate' });
    });
  });

  describe('GET /scheduler/runs', () => {
    it('should return paginated runs', async () => {
      mockService.getRuns.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });

      const result = await controller.getRuns({ page: 1, limit: 20 });

      expect(result.items).toEqual([]);
      expect(mockService.getRuns).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
      );
    });
  });
});
