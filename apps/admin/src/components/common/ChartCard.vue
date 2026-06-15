<template>
  <div class="chart-card">
    <div class="chart-header">
      <h3 class="chart-title">{{ title }}</h3>
    </div>
    <div class="chart-body">
      <div ref="chartRef" :style="{ height: chartHeight }" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch } from 'vue';
import * as echarts from 'echarts';
import type { EChartsOption } from 'echarts';

const props = defineProps<{
  title: string;
  option: EChartsOption;
  chartHeight?: string;
}>();

const chartRef = ref<HTMLDivElement>();
let instance: echarts.ECharts | null = null;

function initChart() {
  if (!chartRef.value) return;
  instance = echarts.init(chartRef.value);
  instance.setOption(props.option);
}

function handleResize() {
  instance?.resize();
}

onMounted(() => {
  initChart();
  window.addEventListener('resize', handleResize);
});

onUnmounted(() => {
  window.removeEventListener('resize', handleResize);
  instance?.dispose();
});

watch(() => props.option, (newOpt) => {
  instance?.setOption(newOpt);
}, { deep: true });
</script>

<style scoped>
.chart-card {
  background: var(--surface-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-card);
  overflow: hidden;
  transition: box-shadow 0.2s ease;
}

.chart-card:hover {
  box-shadow: var(--shadow-card-hover);
}

.chart-header {
  padding: 16px 24px 0;
}

.chart-title {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 500;
  color: var(--text-primary);
  margin: 0;
  letter-spacing: 0.03em;
}

.chart-body {
  padding: 8px 8px 16px;
}
</style>
