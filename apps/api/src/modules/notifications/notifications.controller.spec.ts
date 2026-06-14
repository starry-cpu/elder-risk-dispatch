import { Test, TestingModule } from '@nestjs/testing';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { Role } from '@prisma/client';

describe('NotificationsController', () => {
  let controller: NotificationsController;

  const mockService = {
    send: jest.fn(),
    findAll: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        { provide: NotificationsService, useValue: mockService },
      ],
    }).compile();

    controller = module.get<NotificationsController>(NotificationsController);
    jest.clearAllMocks();
  });

  describe('POST /notifications/send', () => {
    it('should call service.send and return the notification', async () => {
      const notification = { id: 'n-1', targetType: 'USER', targetId: 'u-1', status: 'PENDING' };
      mockService.send.mockResolvedValue(notification);

      const result = await controller.send({
        targetType: 'USER',
        targetId: 'u-1',
        templateId: 'tmpl-001',
        payload: { thing1: { value: '测试' } },
      });

      expect(result).toEqual(notification);
      expect(mockService.send).toHaveBeenCalled();
    });
  });

  describe('GET /notifications', () => {
    it('should call service.findAll with query params and requester', async () => {
      mockService.findAll.mockResolvedValue({ items: [], total: 0, page: 1, limit: 20 });
      const admin = { sub: 'admin-1', role: Role.ADMIN, district: '朝阳区', loginType: 'admin' as const };

      const result = await controller.findAll({ page: 1, limit: 20 }, admin);

      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      // requester 一并透传给 service 做鉴权
      expect(mockService.findAll).toHaveBeenCalledWith(
        expect.objectContaining({ page: 1, limit: 20 }),
        admin,
      );
    });
  });
});
