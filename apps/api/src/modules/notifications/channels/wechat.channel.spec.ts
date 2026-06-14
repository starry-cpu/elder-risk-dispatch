import { WeChatChannel } from './wechat.channel';

// Mock global fetch
const mockFetch = jest.fn();
(global as any).fetch = mockFetch;

// WeChatChannel 现在注入 PrismaService 用于 userId->openid 解析。
// 测试里提供一个 mock prisma：对任意 userId 查询返回一个合法形态的 openid。
const validOpenid = 'o_abcdefghij0123456789XY'; // 满足 ^o[A-Za-z0-9_-]{20,}$
const mockPrisma = {
  user: {
    findUnique: jest.fn().mockResolvedValue({ openid: validOpenid }),
  },
};

describe('WeChatChannel', () => {
  let channel: WeChatChannel;

  beforeEach(() => {
    mockFetch.mockReset();
    mockPrisma.user.findUnique.mockResolvedValue({ openid: validOpenid });
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

    channel = new WeChatChannel(mockPrisma as any);

    const result = await channel.send({
      targetType: 'USER',
      targetId: 'openid-xxx', // 非 openid 形态 -> 当 userId 查 -> 拿到 validOpenid
      templateId: 'tmpl-001',
      payload: { thing1: { value: '测试' } },
    });

    expect(result.success).toBe(true);
    expect(mockFetch).toHaveBeenCalledTimes(2); // token + send
  });

  it('should cache access_token and reuse it', async () => {
    process.env.WECHAT_APPID = 'wx-test-appid';
    process.env.WECHAT_SECRET = 'test-secret';

    channel = new WeChatChannel(mockPrisma as any);

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

    channel = new WeChatChannel(mockPrisma as any);

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

    channel = new WeChatChannel(mockPrisma as any);

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

    channel = new WeChatChannel(mockPrisma as any);

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

    channel = new WeChatChannel(mockPrisma as any);

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

  describe('userId -> openid 解析', () => {
    it('targetId 是合法 openid 形态时直接使用，不查库', async () => {
      process.env.WECHAT_APPID = 'wx-test-appid';
      process.env.WECHAT_SECRET = 'test-secret';
      channel = new WeChatChannel(mockPrisma as any);
      const realOpenid = 'o_ABCDEFGHIJ0123456789XY';

      await channel.send({
        targetType: 'USER',
        targetId: realOpenid,
        templateId: 't1',
        payload: {},
      });

      // 直接走 openid，不应查 user
      expect(mockPrisma.user.findUnique).not.toHaveBeenCalled();
      // 发往 WeChat 的 touser 即为该 openid
      const sendCall = mockFetch.mock.calls.find((c) =>
        String(c[0]).includes('message/subscribe/send'),
      );
      const sentBody = JSON.parse((sendCall![1] as any).body);
      expect(sentBody.touser).toBe(realOpenid);
    });

    it('targetId 是 userId（非 openid 形态）时查 user.openid 后发送', async () => {
      process.env.WECHAT_APPID = 'wx-test-appid';
      process.env.WECHAT_SECRET = 'test-secret';
      channel = new WeChatChannel(mockPrisma as any);

      await channel.send({
        targetType: 'USER',
        targetId: 'user-123', // 不像 openid
        templateId: 't1',
        payload: {},
      });

      expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: 'user-123' },
        select: { openid: true },
      });
      const sendCall = mockFetch.mock.calls.find((c) =>
        String(c[0]).includes('message/subscribe/send'),
      );
      const sentBody = JSON.parse((sendCall![1] as any).body);
      expect(sentBody.touser).toBe(validOpenid);
    });

    it('用户无 openid（未绑微信）时返回失败，不调 WeChat API', async () => {
      process.env.WECHAT_APPID = 'wx-test-appid';
      process.env.WECHAT_SECRET = 'test-secret';
      mockPrisma.user.findUnique.mockResolvedValueOnce({ openid: null });
      channel = new WeChatChannel(mockPrisma as any);

      const result = await channel.send({
        targetType: 'USER',
        targetId: 'user-nobind',
        templateId: 't1',
        payload: {},
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('No openid');
      // 不应实际请求 WeChat
      expect(mockFetch).not.toHaveBeenCalled();
    });
  });
});
