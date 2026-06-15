<template>
  <div v-loading="store.loading" class="dashboard">
    <!-- Stat Cards Row -->
    <div class="stat-row">
      <StatCard
        label="重点老人"
        :value="store.keyElderCount"
        color="#b8860b"
        suffix="人"
        hoverable
      />
      <StatCard
        label="待处理预警"
        :value="store.pendingRiskCount"
        color="#c4554d"
        suffix="条"
        hoverable
      />
      <StatCard
        label="今日工单完成率"
        :value="`${store.todayCompletionRate}%`"
        color="#6b8f71"
        hoverable
      />
      <StatCard
        label="超期工单"
        :value="store.poorReviewCount"
        color="#7b8fa1"
        suffix="条"
        hoverable
      />
    </div>

    <!-- Charts Row 1 -->
    <div class="chart-row">
      <div class="chart-col">
        <ChartCard title="风险等级分布" :option="riskLevelOption" chart-height="320px" />
      </div>
      <div class="chart-col">
        <ChartCard title="风险趋势" :option="riskTrendOption" chart-height="320px" />
      </div>
    </div>

    <!-- Charts Row 2 -->
    <div class="chart-row">
      <div class="chart-col">
        <ChartCard title="风险来源分布" :option="riskSourceOption" chart-height="320px" />
      </div>
      <div class="chart-col">
        <ChartCard title="工单状态分布" :option="orderStatusOption" chart-height="320px" />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted } from 'vue';
import type { EChartsOption } from 'echarts';
import { useDashboardStore } from '@/stores/dashboard';
import StatCard from '@/components/common/StatCard.vue';
import ChartCard from '@/components/common/ChartCard.vue';

const store = useDashboardStore();

const levelLabelMap: Record<string, string> = {
  HIGH: '高风险',
  MEDIUM: '中风险',
  LOW: '低风险',
};

/* Theme-consistent earth-tone palette for charts */
const chartColors = {
  danger: '#c4554d',
  warning: '#d4956a',
  info: '#7b8fa1',
  success: '#6b8f71',
  primary: '#b8860b',
  goldLight: '#d4a535',
  fill: '#faf6ee',
};

const riskLevelOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item' },
  legend: {
    bottom: 0,
    textStyle: { color: '#6b6b6b', fontSize: 12 },
  },
  color: [chartColors.danger, chartColors.warning, chartColors.info],
  series: [{
    type: 'pie',
    radius: ['45%', '72%'],
    center: ['50%', '45%'],
    data: (store.riskOverview?.byLevel ?? []).map(item => ({
      value: item.count,
      name: levelLabelMap[item.level] ?? item.level,
    })),
    label: { color: '#6b6b6b', fontSize: 12 },
    emphasis: {
      itemStyle: { shadowBlur: 8, shadowColor: 'rgba(0,0,0,0.08)' },
    },
    itemStyle: {
      borderColor: '#fff',
      borderWidth: 2,
      borderRadius: 2,
    },
  }],
}));

const riskTrendOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 8, right: 16, top: 12, bottom: 8 },
  xAxis: {
    type: 'category',
    data: (store.riskOverview?.trend ?? []).map(t => t.date),
    axisLine: { lineStyle: { color: '#e8e4db' } },
    axisTick: { show: false },
    axisLabel: { color: '#999', fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    name: '条',
    splitLine: { lineStyle: { color: '#f0ede6' } },
    axisLabel: { color: '#999', fontSize: 11 },
  },
  series: [{
    type: 'line',
    data: (store.riskOverview?.trend ?? []).map(t => t.count),
    smooth: true,
    lineStyle: { color: chartColors.primary, width: 2 },
    itemStyle: { color: chartColors.primary },
    areaStyle: {
      color: new echarts.graphic.LinearGradient(0, 0, 0, 1, [
        { offset: 0, color: 'rgba(184,134,11,0.12)' },
        { offset: 1, color: 'rgba(184,134,11,0.0)' },
      ]),
    },
    symbol: 'circle',
    symbolSize: 5,
  }],
}));

const riskSourceOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 8, right: 16, top: 12, bottom: 8 },
  xAxis: {
    type: 'category',
    data: (store.riskOverview?.bySource ?? []).map(s => s.source),
    axisLine: { lineStyle: { color: '#e8e4db' } },
    axisTick: { show: false },
    axisLabel: { color: '#999', fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#f0ede6' } },
    axisLabel: { color: '#999', fontSize: 11 },
  },
  series: [{
    type: 'bar',
    data: (store.riskOverview?.bySource ?? []).map(s => s.count),
    barWidth: 32,
    itemStyle: {
      color: chartColors.warning,
      borderRadius: [4, 4, 0, 0],
    },
    emphasis: {
      itemStyle: { color: chartColors.goldLight },
    },
  }],
}));

const orderStatusOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  grid: { left: 8, right: 16, top: 12, bottom: 8 },
  xAxis: {
    type: 'category',
    data: (store.workOrderEfficiency?.byStatus ?? []).map(s => statusLabelMap[s.status] ?? s.status),
    axisLine: { lineStyle: { color: '#e8e4db' } },
    axisTick: { show: false },
    axisLabel: { color: '#999', fontSize: 11 },
  },
  yAxis: {
    type: 'value',
    splitLine: { lineStyle: { color: '#f0ede6' } },
    axisLabel: { color: '#999', fontSize: 11 },
  },
  series: [{
    type: 'bar',
    data: (store.workOrderEfficiency?.byStatus ?? []).map(s => s.count),
    barWidth: 32,
    itemStyle: {
      color: chartColors.success,
      borderRadius: [4, 4, 0, 0],
    },
  }],
}));

const statusLabelMap: Record<string, string> = {
  PENDING: '待分配',
  ASSIGNED: '已分配',
  IN_PROGRESS: '处理中',
  COMPLETED: '已完成',
  CANCELLED: '已取消',
};

onMounted(() => {
  store.fetchAll();
});
</script>

<script lang="ts">
import * as echarts from 'echarts';
</script>

<style scoped>
.dashboard {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.stat-row {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 16px;
}

.chart-row {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 16px;
}

.chart-col {
  min-width: 0;
}

@media (max-width: 1200px) {
  .stat-row {
    grid-template-columns: repeat(2, 1fr);
  }
  .chart-row {
    grid-template-columns: 1fr;
  }
}
</style>
