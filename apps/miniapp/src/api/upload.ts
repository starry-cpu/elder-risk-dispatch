import http, { wrap } from './client';
export const uploadApi = {
  getPresignedUrl: (data: { fileName: string; contentType: string }) =>
    wrap(http.post('/uploads/presigned-url', data)),
};
