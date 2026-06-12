<template>
  <div class="space-y-6">
    <!-- Stat Cards -->
    <el-row :gutter="16">
      <el-col :span="6">
        <StatCard label="重点老人" :value="store.overview.keyElderCount" color="#e6a23c" suffix="人" />
      </el-col>
      <el-col :span="6">
        <StatCard label="待处理预警" :value="store.overview.pendingRiskCount" color="#f56c6c" suffix="条" />
      </el-col>
      <el-col :span="6">
        <StatCard label="今日工单完成率" :value="`${store.overview.todayCompletionRate}%`" color="#67c23a" />
      </el-col>
      <el-col :span="6">
        <StatCard label="近期差评" :value="store.overview.poorReviewCount" color="#909399" suffix="条" />
      </el-col>
    </el-row>

    <!-- Charts -->
    <el-row :gutter="16">
      <el-col :span="12">
        <ChartCard title="风险分布" :option="riskPieOption" chart-height="300px" />
      </el-col>
      <el-col :span="12">
        <ChartCard title="响应时长趋势" :option="responseTimeOption" chart-height="300px" />
      </el-col>
    </el-row>

    <el-row :gutter="16">
      <el-col :span="12">
        <ChartCard title="高发问题" :option="hotspotsOption" chart-height="300px" />
      </el-col>
      <el-col :span="12">
        <ChartCard title="差评分析" :option="poorReviewsOption" chart-height="300px" />
      </el-col>
    </el-row>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { EChartsOption } from 'echarts';
import { useDashboardStore } from '@/stores/dashboard';
import StatCard from '@/components/common/StatCard.vue';
import ChartCard from '@/components/common/ChartCard.vue';

const store = useDashboardStore();

const riskPieOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    data: [
      { value: store.riskDistribution.high, name: '高风险' },
      { value: store.riskDistribution.medium, name: '中风险' },
      { value: store.riskDistribution.low, name: '低风险' },
    ],
    emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
  }],
}));

const responseTimeOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: store.responseTimeTrend.map(r => r.date) },
  yAxis: { type: 'value', name: '分钟' },
  series: [{
    type: 'line',
    data: store.responseTimeTrend.map(r => r.avgMinutes),
    smooth: true,
    areaStyle: { opacity: 0.3 },
  }],
}));

const hotspotsOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: store.hotspots.map(h => h.category) },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: store.hotspots.map(h => h.count) }],
}));

const poorReviewsOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: store.poorReviews.map(p => p.category) },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: store.poorReviews.map(p => p.count), color: '#f56c6c' }],
}));

onMounted(() => {
  store.fetchAll();
});
</script>
