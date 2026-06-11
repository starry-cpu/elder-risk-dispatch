import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { SendNotificationDto } from './send-notification.dto';

describe('SendNotificationDto', () => {
  it('should pass validation with valid data', async () => {
    const dto = plainToInstance(SendNotificationDto, {
      targetType: 'USER',
      targetId: 'u-1',
      templateId: 'tmpl-001',
      payload: { thing1: { value: 'hello' } },
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail if targetType is not USER or ELDER', async () => {
    const dto = plainToInstance(SendNotificationDto, {
      targetType: 'INVALID',
      targetId: 'u-1',
      payload: {},
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe('targetType');
  });

  it('should fail if targetId is empty', async () => {
    const dto = plainToInstance(SendNotificationDto, {
      targetType: 'USER',
      targetId: '',
      payload: {},
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].property).toBe('targetId');
  });

  it('should fail if payload is not an object', async () => {
    const dto = plainToInstance(SendNotificationDto, {
      targetType: 'USER',
      targetId: 'u-1',
      payload: 'not-an-object',
    });

    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('should allow optional templateId', async () => {
    const dto = plainToInstance(SendNotificationDto, {
      targetType: 'ELDER',
      targetId: 'e-1',
      payload: { key: 'val' },
      // templateId omitted
    });

    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
