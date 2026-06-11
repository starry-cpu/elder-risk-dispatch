import { Test, TestingModule } from '@nestjs/testing';
import { MissedCheckinProcessor } from './missed-checkin.processor';
import { SchedulerService } from '../scheduler.service';
import { Job } from 'bullmq';

describe('MissedCheckinProcessor', () => {
  let processor: MissedCheckinProcessor;

  const mockSchedulerService = {
    scanMissedCheckIns: jest.fn(),
  };

  const mockJob = (overrides = {}) =>
    ({
      id: 'job-1',
      name: 'missed-checkin-scan',
      data: {},
      ...overrides,
    }) as unknown as Job;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MissedCheckinProcessor,
        { provide: SchedulerService, useValue: mockSchedulerService },
      ],
    }).compile();

    processor = module.get<MissedCheckinProcessor>(MissedCheckinProcessor);
    jest.clearAllMocks();
  });

  it('should call SchedulerService.scanMissedCheckIns', async () => {
    mockSchedulerService.scanMissedCheckIns.mockResolvedValue({ processed: 3, eventsCreated: 2 });

    const result = await processor.handleMissedCheckinScan(mockJob());

    expect(mockSchedulerService.scanMissedCheckIns).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ processed: 3, eventsCreated: 2 });
  });

  it('should propagate errors from SchedulerService', async () => {
    mockSchedulerService.scanMissedCheckIns.mockRejectedValue(new Error('DB down'));

    await expect(processor.handleMissedCheckinScan(mockJob())).rejects.toThrow('DB down');
  });
});
