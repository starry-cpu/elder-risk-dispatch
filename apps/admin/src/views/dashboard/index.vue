<template>
  <div v-loading="store.loading" class="space-y-6">
    <!-- Stat Cards -->
    <el-row :gutter="16">
      <el-col :span="6">
        <StatCard label="重点老人" :value="store.keyElderCount" color="#e6a23c" suffix="人" />
      </el-col>
      <el-col :span="6">
        <StatCard label="待处理预警" :value="store.pendingRiskCount" color="#f56c6c" suffix="条" />
      </el-col>
      <el-col :span="6">
        <StatCard label="今日工单完成率" :value="`${store.todayCompletionRate}%`" color="#67c23a" />
      </el-col>
      <el-col :span="6">
        <StatCard label="超期工单" :value="store.poorReviewCount" color="#909399" suffix="条" />
      </el-col>
    </el-row>

    <!-- Charts Row 1 -->
    <el-row :gutter="16">
      <el-col :span="12">
        <ChartCard title="风险等级分布" :option="riskLevelOption" chart-height="300px" />
      </el-col>
      <el-col :span="12">
        <ChartCard title="风险趋势" :option="riskTrendOption" chart-height="300px" />
      </el-col>
    </el-row>

    <!-- Charts Row 2 -->
    <el-row :gutter="16">
      <el-col :span="12">
        <ChartCard title="风险来源分布" :option="riskSourceOption" chart-height="300px" />
      </el-col>
      <el-col :span="12">
        <ChartCard title="工单状态分布" :option="orderStatusOption" chart-height="300px" />
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

const levelLabelMap: Record<string, string> = {
  HIGH: '高风险',
  MEDIUM: '中风险',
  LOW: '低风险',
};

const riskLevelOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'item' },
  legend: { bottom: 0 },
  series: [{
    type: 'pie',
    radius: ['40%', '70%'],
    data: (store.riskOverview?.byLevel ?? []).map(item => ({
      value: item.count,
      name: levelLabelMap[item.level] ?? item.level,
    })),
    emphasis: { itemStyle: { shadowBlur: 10, shadowOffsetX: 0, shadowColor: 'rgba(0, 0, 0, 0.5)' } },
  }],
}));

const riskTrendOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: (store.riskOverview?.trend ?? []).map(t => t.date) },
  yAxis: { type: 'value', name: '条' },
  series: [{
    type: 'line',
    data: (store.riskOverview?.trend ?? []).map(t => t.count),
    smooth: true,
    areaStyle: { opacity: 0.3 },
  }],
}));

const riskSourceOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: (store.riskOverview?.bySource ?? []).map(s => s.source) },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: (store.riskOverview?.bySource ?? []).map(s => s.count) }],
}));

const orderStatusOption = computed<EChartsOption>(() => ({
  tooltip: { trigger: 'axis' },
  xAxis: { type: 'category', data: (store.workOrderEfficiency?.byStatus ?? []).map(s => statusLabelMap[s.status] ?? s.status) },
  yAxis: { type: 'value' },
  series: [{ type: 'bar', data: (store.workOrderEfficiency?.byStatus ?? []).map(s => s.count), color: '#409eff' }],
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
