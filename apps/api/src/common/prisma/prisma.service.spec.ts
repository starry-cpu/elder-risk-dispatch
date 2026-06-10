import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from './prisma.service';

describe('PrismaService', () => {
  let service: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PrismaService],
    }).compile();
    service = module.get<PrismaService>(PrismaService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should have a $connect method', () => {
    expect(typeof (service as any).$connect).toBe('function');
  });

  it('should have a $disconnect method', () => {
    expect(typeof (service as any).$disconnect).toBe('function');
  });

  it('should have an onModuleInit method', () => {
    expect(typeof (service as any).onModuleInit).toBe('function');
  });
});
