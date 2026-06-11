import { defineStore } from 'pinia';
import { ref } from 'vue';
import { riskApi } from '@/api';
import type { RiskEventRecord, RiskListParams } from '@/api/risk';

export const useRiskStore = defineStore('risk', () => {
  const items = ref<RiskEventRecord[]>([]);
  const total = ref(0);
  const loading = ref(false);

  async function fetchList(params: RiskListParams) {
    loading.value = true;
    try {
      const res = await riskApi.list(params);
      items.value = res.data.data.items;
      total.value = res.data.data.total;
    } finally { loading.value = false; }
  }

  async function review(id: string, status: string, note?: string) {
    await riskApi.review(id, { status, note });
    const idx = items.value.findIndex(i => i.id === id);
    if (idx >= 0) { items.value[idx] = { ...items.value[idx], status }; }
  }

  function addNewEvent(event: RiskEventRecord) {
    items.value.unshift(event);
    total.value++;
  }

  return { items, total, loading, fetchList, review, addNewEvent };
});
