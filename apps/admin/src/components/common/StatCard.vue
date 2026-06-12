<template>
  <el-card shadow="hover" class="text-center">
    <div class="text-4xl font-bold" :style="{ color }">{{ value }}</div>
    <div class="text-sm text-gray-500 mt-2">{{ label }}</div>
    <div v-if="suffix" class="text-xs text-gray-400 mt-1">{{ suffix }}</div>
  </el-card>
</template>

<script setup lang="ts">
defineProps<{
  value: string | number;
  label: string;
  color?: string;
  suffix?: string;
}>();
</script>
