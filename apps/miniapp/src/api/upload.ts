import { API_BASE } from './client';

export const uploadApi = {
  // 小程序录音临时路径 → POST /uploads/audio (multipart) → { url, key }
  // 唯一绕过统一 luch-request 客户端的接口：multipart 文件上传必须用 uni.uploadFile
  uploadAudio: (filePath: string) =>
    new Promise<{ url: string; key: string }>((resolve, reject) => {
      const token = uni.getStorageSync('token');
      const apiBase = uni.getStorageSync('apiBase') || API_BASE;
      uni.uploadFile({
        url: `${apiBase}/uploads/audio`,
        filePath,
        name: 'file',
        header: token ? { Authorization: `Bearer ${token}` } : {},
        success: (res) => {
          try {
            const body = JSON.parse(res.data);
            if (body.code !== 0) return reject(new Error(body.message || '上传失败'));
            resolve(body.data);
          } catch {
            reject(new Error('上传响应解析失败'));
          }
        },
        fail: (err) => reject(new Error(err?.errMsg || '上传失败')),
      });
    }),
};
