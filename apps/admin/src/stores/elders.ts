import { defineStore } from 'pinia';
import { ref } from 'vue';
import { eldersApi } from '@/api';
import type { ElderRecord, ElderDetail, ElderListParams } from '@/api/elders';

export const useElderStore = defineStore('elders', () => {
  const items = ref<ElderRecord[]>([]);
  const total = ref(0);
  const loading = ref(false);
  const currentElder = ref<ElderDetail | null>(null);

  async function fetchList(params: ElderListParams) {
    loading.value = true;
    try {
      const res = await eldersApi.list(params);
      items.value = res.data.data.items;
      total.value = res.data.data.total;
    } finally {
      loading.value = false;
    }
  }

  async function fetchDetail(id: string) {
    const res = await eldersApi.getById(id);
    currentElder.value = res.data.data;
  }

  async function fetchRiskProfile(id: string) {
    const res = await eldersApi.getRiskProfile(id);
    return res.data.data;
  }

  return { items, total, loading, currentElder, fetchList, fetchDetail, fetchRiskProfile };
});
