import { Test, TestingModule } from '@nestjs/testing';
import { WorkorderTimeoutProcessor } from './workorder-timeout.processor';
import { SchedulerService } from '../scheduler.service';
import { Job } from 'bullmq';

describe('WorkorderTimeoutProcessor', () => {
  let processor: WorkorderTimeoutProcessor;

  const mockSchedulerService = {
    escalateTimeouts: jest.fn(),
  };

  const mockJob = () =>
    ({ id: 'job-1', name: 'workorder-timeout-escalate', data: {} }) as unknown as Job;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkorderTimeoutProcessor,
        { provide: SchedulerService, useValue: mockSchedulerService },
      ],
    }).compile();

    processor = module.get<WorkorderTimeoutProcessor>(WorkorderTimeoutProcessor);
    jest.clearAllMocks();
  });

  it('should call SchedulerService.escalateTimeouts', async () => {
    mockSchedulerService.escalateTimeouts.mockResolvedValue({
      processed: 5,
      escalated: 2,
    });

    const result = await processor.handleWorkorderTimeoutEscalate(mockJob());

    expect(mockSchedulerService.escalateTimeouts).toHaveBeenCalledTimes(1);
    expect(result).toEqual({ processed: 5, escalated: 2 });
  });

  it('should propagate errors from SchedulerService', async () => {
    mockSchedulerService.escalateTimeouts.mockRejectedValue(new Error('DB down'));

    await expect(
      processor.handleWorkorderTimeoutEscalate(mockJob()),
    ).rejects.toThrow('DB down');
  });
});
