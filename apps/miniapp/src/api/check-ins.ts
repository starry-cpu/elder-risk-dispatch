import http, { wrap } from './client';
export interface FamilyRequestResult {
  checkIn: { id: string };
  workOrder: { id: string; type: string; status: string } | null;
  aiClassification: { type: string; confidence: number } | null;
  dispatched: boolean;
  reason: string;
}
export const checkInsApi = {
  create: (data: { elderId: string; method: string; content?: string; voiceUrl?: string }) =>
    wrap(http.post('/check-ins', data)),
  /** 家属请求帮助：文字描述需求 → AI 分类 → 自动派单 */
  createFamilyRequest: (data: { elderId: string; text: string }) =>
    http.post('/check-ins/family-request', data),
  listByElder: (elderId: string, params?: { page?: number; limit?: number }) =>
    wrap(http.get(`/elders/${elderId}/check-ins`, { params })),
};
