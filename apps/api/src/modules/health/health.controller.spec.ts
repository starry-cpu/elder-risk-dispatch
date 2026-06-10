import { Test, TestingModule } from '@nestjs/testing';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
    }).compile();
    controller = module.get<HealthController>(HealthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should have a check method', () => {
    expect(typeof (controller as any).check).toBe('function');
  });

  it('check() should return status ok and db true', async () => {
    const result = await (controller as any).check();
    expect(result).toHaveProperty('status', 'ok');
    expect(result.db).toBe(true);
  });
});
