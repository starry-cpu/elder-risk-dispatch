import { INotificationChannel, SendNotificationInput } from './notification-channel.interface';

describe('INotificationChannel (interface contract)', () => {
  it('should enforce send() returning { success, error? }', async () => {
    const stub: INotificationChannel = {
      send: async (input: SendNotificationInput) => ({ success: true }),
    };

    const result = await stub.send({
      targetType: 'USER',
      targetId: 'u-1',
      payload: { key: 'value' },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should allow error field on failure', async () => {
    const stub: INotificationChannel = {
      send: async () => ({ success: false, error: 'API unreachable' }),
    };

    const result = await stub.send({
      targetType: 'ELDER',
      targetId: 'e-1',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toBe('API unreachable');
  });
});
