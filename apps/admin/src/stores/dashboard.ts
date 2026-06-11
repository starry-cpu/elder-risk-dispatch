import { defineStore } from 'pinia';
import { ref } from 'vue';
import { dashboardApi } from '@/api';
import type { DashboardOverview, RiskDistribution, ResponseTimeTrend, Hotspot } from '@/api/dashboard';

export const useDashboardStore = defineStore('dashboard', () => {
  const overview = ref<DashboardOverview>({
    keyElderCount: 0,
    pendingRiskCount: 0,
    todayCompletionRate: 0,
    poorReviewCount: 0,
  });
  const riskDistribution = ref<RiskDistribution>({ high: 0, medium: 0, low: 0 });
  const responseTimeTrend = ref<ResponseTimeTrend[]>([]);
  const hotspots = ref<Hotspot[]>([]);
  const poorReviews = ref<Hotspot[]>([]);
  const loading = ref(false);

  async function fetchOverview() {
    const res = await dashboardApi.getOverview();
    overview.value = res.data.data;
  }

  async function fetchAll() {
    loading.value = true;
    try {
      const [ov, rd, rt, hs, pr] = await Promise.all([
        dashboardApi.getOverview(),
        dashboardApi.getRiskDistribution(),
        dashboardApi.getResponseTime(),
        dashboardApi.getHotspots(),
        dashboardApi.getPoorReviews(),
      ]);
      overview.value = ov.data.data;
      riskDistribution.value = rd.data.data;
      responseTimeTrend.value = rt.data.data;
      hotspots.value = hs.data.data;
      poorReviews.value = pr.data.data;
    } finally {
      loading.value = false;
    }
  }

  return { overview, riskDistribution, responseTimeTrend, hotspots, poorReviews, loading, fetchOverview, fetchAll };
});
