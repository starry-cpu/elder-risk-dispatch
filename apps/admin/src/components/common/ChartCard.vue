<template>
  <el-card shadow="hover" class="h-full">
    <template #header>
      <span class="font-medium">{{ title }}</span>
    </template>
    <div ref="chartRef" :style="{ height: chartHeight }" />
  </el-card>
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
