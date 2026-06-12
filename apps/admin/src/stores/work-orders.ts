import { defineStore } from 'pinia';
import { ref } from 'vue';
import { workOrdersApi } from '@/api';
import type { WorkOrderRecord, WorkOrderListParams, DispatchRecommendation } from '@/api/work-orders';

export const useWorkOrderStore = defineStore('workOrders', () => {
  const items = ref<WorkOrderRecord[]>([]);
  const total = ref(0);
  const loading = ref(false);

  async function fetchList(params: WorkOrderListParams) {
    loading.value = true;
    try { const res = await workOrdersApi.list(params); items.value = res.data.data.items; total.value = res.data.data.total; }
    finally { loading.value = false; }
  }

  async function assign(id: string, assigneeId: string) { await workOrdersApi.assign(id, { assigneeId }); }
  async function reassign(id: string, assigneeId: string, reason: string) { await workOrdersApi.reassign(id, { assigneeId, reason }); }
  async function fetchRecommendations(id: string): Promise<DispatchRecommendation[]> { const res = await workOrdersApi.getRecommendations(id); return res.data.data; }
  async function fetchTimeline(id: string) { const res = await workOrdersApi.getTimeline(id); return res.data.data; }

  return { items, total, loading, fetchList, assign, reassign, fetchRecommendations, fetchTimeline };
});
