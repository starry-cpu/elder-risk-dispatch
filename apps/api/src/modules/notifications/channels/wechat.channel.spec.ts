import { WeChatChannel } from './wechat.channel';

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

describe('WeChatChannel', () => {
  let channel: WeChatChannel;

  beforeEach(() => {
    mockFetch.mockReset();
    // By default: mock successful token fetch + send
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('cgi-bin/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'test-access-token', expires_in: 7200 }),
        });
      }
      if (url.includes('message/subscribe/send')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ errcode: 0, errmsg: 'ok' }),
        });
      }
      return Promise.reject(new Error('Unknown URL'));
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should send successfully and return success true', async () => {
    process.env.WECHAT_APPID = 'wx-test-appid';
    process.env.WECHAT_SECRET = 'test-secret';

    channel = new WeChatChannel();

    const result = await channel.send({
      targetType: 'USER',
      targetId: 'openid-xxx',
      templateId: 'tmpl-001',
      payload: { thing1: { value: '测试' } },
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2); // token + send
  });

  it('should cache access_token and reuse it', async () => {
    process.env.WECHAT_APPID = 'wx-test-appid';
    process.env.WECHAT_SECRET = 'test-secret';

    channel = new WeChatChannel();

    // First send
    await channel.send({
      targetType: 'USER',
      targetId: 'openid-aaa',
      templateId: 't1',
      payload: {},
    });
    expect(mockFetch).toHaveBeenCalledTimes(2); // token + send

    // Second send — should reuse cached token, no new token call
    await channel.send({
      targetType: 'USER',
      targetId: 'openid-bbb',
      templateId: 't2',
      payload: {},
    });
    expect(mockFetch).toHaveBeenCalledTimes(3); // only one more (send), not 4
  });

  it('should return success false on WeChat API error', async () => {
    process.env.WECHAT_APPID = 'wx-test-appid';
    process.env.WECHAT_SECRET = 'test-secret';

    mockFetch.mockReset();
    mockFetch.mockImplementation((url: string) => {
      if (url.includes('cgi-bin/token')) {
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ access_token: 'test-access-token', expires_in: 7200 }),
        });
      }
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ errcode: 40003, errmsg: 'invalid openid' }),
      });
    });

    channel = new WeChatChannel();

    const result = await channel.send({
      targetType: 'USER',
      targetId: 'bad-openid',
      templateId: 't1',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('40003');
  });

  it('should return success false when APPID or SECRET is missing', async () => {
    delete process.env.WECHAT_APPID;
    delete process.env.WECHAT_SECRET;

    channel = new WeChatChannel();

    const result = await channel.send({
      targetType: 'USER',
      targetId: 'openid-xxx',
      templateId: 't1',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('WeChat APPID/SECRET not configured');
  });

  it('should return success false when templateId is missing', async () => {
    process.env.WECHAT_APPID = 'wx-test-appid';
    process.env.WECHAT_SECRET = 'test-secret';

    channel = new WeChatChannel();

    const result = await channel.send({
      targetType: 'USER',
      targetId: 'openid-xxx',
      payload: {},
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('templateId is required');
  });

  it('should re-fetch token if cached token is stale (>7000s)', async () => {
    process.env.WECHAT_APPID = 'wx-test-appid';
    process.env.WECHAT_SECRET = 'test-secret';

    channel = new WeChatChannel();

    // Force token to appear stale
    (channel as any).tokenExpiresAt = Date.now() - 1000;

    await channel.send({
      targetType: 'USER',
      targetId: 'openid-xxx',
      templateId: 't1',
      payload: {},
    });

    // Should have fetched new token + sent
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
