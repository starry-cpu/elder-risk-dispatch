import { Logger } from '@nestjs/common';
import { ConsoleChannel } from './console.channel';

describe('ConsoleChannel', () => {
  let channel: ConsoleChannel;

  beforeEach(() => {
    channel = new ConsoleChannel();
    jest.spyOn(Logger.prototype, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('should return success true for any valid input', async () => {
    const result = await channel.send({
      targetType: 'USER',
      targetId: 'u-1',
      payload: { title: '测试通知', content: '您的工单已超时' },
    });

    expect(result.success).toBe(true);
    expect(result.error).toBeUndefined();
  });

  it('should log the notification payload', async () => {
    const input = {
      targetType: 'USER' as const,
      targetId: 'u-2',
      templateId: 'tmpl-001',
      payload: { thing1: { value: '张三' }, thing2: { value: '已完成' } },
    };

    await channel.send(input);

    expect(Logger.prototype.log).toHaveBeenCalledTimes(1);
    const logMessage = (Logger.prototype.log as jest.Mock).mock.calls[0][0];
    expect(logMessage).toContain('u-2');
    expect(logMessage).toContain('tmpl-001');
  });

  it('should always succeed even with empty payload', async () => {
    const result = await channel.send({
      targetType: 'ELDER',
      targetId: 'e-1',
      payload: {},
    });

    expect(result.success).toBe(true);
  });
});
