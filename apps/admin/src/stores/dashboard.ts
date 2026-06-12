import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { dashboardApi } from '@/api';
import type { RiskOverview, WorkOrderEfficiency, ElderCoverage, GridWorkerPerformance } from '@/api/dashboard';

export const useDashboardStore = defineStore('dashboard', () => {
  const riskOverview = ref<RiskOverview | null>(null);
  const workOrderEfficiency = ref<WorkOrderEfficiency | null>(null);
  const elderCoverage = ref<ElderCoverage | null>(null);
  const gridWorkerPerformance = ref<GridWorkerPerformance | null>(null);
  const loading = ref(false);

  // Derived stat card values
  const keyElderCount = computed(() => elderCoverage.value?.highRiskElders?.length ?? 0);
  const pendingRiskCount = computed(() => riskOverview.value?.total ?? 0);
  const todayCompletionRate = computed(() => {
    if (!workOrderEfficiency.value) return 0;
    const { byStatus, total } = workOrderEfficiency.value;
    if (total === 0) return 0;
    const completed = byStatus.find(s => s.status === 'COMPLETED')?.count ?? 0;
    return Math.round((completed / total) * 100);
  });
  const poorReviewCount = computed(() => workOrderEfficiency.value?.overdueCount ?? 0);

  async function fetchAll() {
    loading.value = true;
    try {
      const [ro, wo, ec, gp] = await Promise.all([
        dashboardApi.getRiskOverview(),
        dashboardApi.getWorkOrderEfficiency(),
        dashboardApi.getElderCoverage(),
        dashboardApi.getGridWorkerPerformance(),
      ]);
      riskOverview.value = ro.data.data;
      workOrderEfficiency.value = wo.data.data;
      elderCoverage.value = ec.data.data;
      gridWorkerPerformance.value = gp.data.data;
    } finally {
      loading.value = false;
    }
  }

  return {
    riskOverview,
    workOrderEfficiency,
    elderCoverage,
    gridWorkerPerformance,
    loading,
    keyElderCount,
    pendingRiskCount,
    todayCompletionRate,
    poorReviewCount,
    fetchAll,
  };
});
