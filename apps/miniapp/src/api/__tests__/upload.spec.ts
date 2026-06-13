import { describe, it, expect, vi, beforeEach } from 'vitest';
import { uploadApi } from '../upload';

describe('uploadApi.uploadAudio', () => {
  beforeEach(() => {
    vi.stubGlobal('uni', {
      getStorageSync: vi.fn((key: string) =>
        key === 'token' ? 'fake-token' : '',
      ),
      uploadFile: vi.fn(),
    });
  });

  it('should call uni.uploadFile with correct params and resolve { url, key }', async () => {
    (uni.uploadFile as any).mockImplementation((opts: any) => {
      opts.success({
        data: JSON.stringify({
          code: 0,
          data: { url: 'http://x:9000/care/checkins/a.mp3', key: 'checkins/a.mp3' },
        }),
      });
    });

    const result = await uploadApi.uploadAudio('/tmp/rec.mp3');

    expect(uni.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({
        url: expect.stringContaining('/uploads/audio'),
        filePath: '/tmp/rec.mp3',
        name: 'file',
        header: { Authorization: 'Bearer fake-token' },
      }),
    );
    expect(result).toEqual({
      url: 'http://x:9000/care/checkins/a.mp3',
      key: 'checkins/a.mp3',
    });
  });

  it('should reject on business error (code !== 0)', async () => {
    (uni.uploadFile as any).mockImplementation((opts: any) => {
      opts.success({ data: JSON.stringify({ code: 1, message: '不支持的音频类型' }) });
    });

    await expect(uploadApi.uploadAudio('/tmp/bad.mp4')).rejects.toThrow('不支持的音频类型');
  });

  it('should reject when response body is not valid JSON', async () => {
    (uni.uploadFile as any).mockImplementation((opts: any) => {
      opts.success({ data: 'not-json' });
    });

    await expect(uploadApi.uploadAudio('/tmp/rec.mp3')).rejects.toThrow('上传响应解析失败');
  });

  it('should reject on uni.uploadFile fail', async () => {
    (uni.uploadFile as any).mockImplementation((opts: any) => {
      opts.fail({ errMsg: 'request:fail timeout' });
    });

    await expect(uploadApi.uploadAudio('/tmp/rec.mp3')).rejects.toThrow('request:fail timeout');
  });

  it('should omit Authorization header when no token', async () => {
    (uni.getStorageSync as any).mockReturnValue('');
    (uni.uploadFile as any).mockImplementation((opts: any) => {
      opts.success({
        data: JSON.stringify({ code: 0, data: { url: 'u', key: 'k' } }),
      });
    });

    await uploadApi.uploadAudio('/tmp/rec.mp3');

    expect(uni.uploadFile).toHaveBeenCalledWith(
      expect.objectContaining({ header: {} }),
    );
  });
});
