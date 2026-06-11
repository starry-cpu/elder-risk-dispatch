import { Test, TestingModule } from '@nestjs/testing';
import { DashboardAggregateProcessor } from './dashboard-aggregate.processor';
import { DashboardService } from '../dashboard.service';
import { PrismaService } from '../../../common/prisma/prisma.service';
import { Job } from 'bullmq';

describe('DashboardAggregateProcessor', () => {
  let processor: DashboardAggregateProcessor;

  const mockDashboardService = {
    getRiskOverview: jest.fn().mockResolvedValue({ total: 5 }),
    getWorkOrderEfficiency: jest.fn().mockResolvedValue({ total: 8 }),
    getElderCoverage: jest.fn().mockResolvedValue({ totalElders: 50 }),
    getGridWorkerPerformance: jest.fn().mockResolvedValue({ workers: [] }),
  };

  const mockPrisma = {
    schedulerRun: { create: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardAggregateProcessor,
        { provide: DashboardService, useValue: mockDashboardService },
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    processor = module.get<DashboardAggregateProcessor>(DashboardAggregateProcessor);
    jest.clearAllMocks();
  });

  it('should process dashboard-aggregate job', async () => {
    mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-1' });

    const job = { name: 'dashboard-aggregate', id: 'job-1' } as Job;
    await processor.process(job);

    expect(mockPrisma.schedulerRun.create).toHaveBeenCalled();
    expect(mockDashboardService.getRiskOverview).toHaveBeenCalled();
    expect(mockDashboardService.getWorkOrderEfficiency).toHaveBeenCalled();
    expect(mockPrisma.schedulerRun.update).toHaveBeenCalledWith({
      where: { id: 'run-1' },
      data: expect.objectContaining({ status: 'COMPLETED' }),
    });
  });

  it('should mark PARTIAL when some aggregation queries fail', async () => {
    mockPrisma.schedulerRun.create.mockResolvedValue({ id: 'run-2' });
    mockDashboardService.getRiskOverview.mockRejectedValue(new Error('DB error'));
    // the other three queries still resolve with their default mocks

    const job = { name: 'dashboard-aggregate', id: 'job-2' } as Job;
    await processor.process(job);

    expect(mockPrisma.schedulerRun.update).toHaveBeenCalledWith({
      where: { id: 'run-2' },
      data: expect.objectContaining({
        status: 'PARTIAL',
        error: expect.any(String),
        itemsProcessed: 3,
      }),
    });
  });
});
