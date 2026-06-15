<template>
  <text class="app-tag" :class="tagClass">{{ label }}</text>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = defineProps<{
  level: 'high' | 'medium' | 'low';
  label?: string;
}>();

const LEVEL_MAP: Record<string, { cls: string; defaultLabel: string }> = {
  high: { cls: 'app-tag--high', defaultLabel: 'HIGH' },
  medium: { cls: 'app-tag--medium', defaultLabel: 'MEDIUM' },
  low: { cls: 'app-tag--low', defaultLabel: 'LOW' },
};

const tagClass = computed(() => LEVEL_MAP[props.level]?.cls || 'app-tag--low');
const label = computed(() => props.label || LEVEL_MAP[props.level]?.defaultLabel || '');
</script>

<style scoped>
.app-tag {
  display: inline-block;
  font-size: 20rpx;
  font-weight: 500;
  padding: 4rpx 10rpx;
  border-radius: 6rpx;
  letter-spacing: 1rpx;
  line-height: 1.4;
}
.app-tag--high {
  background-color: #F5EBE4;
  color: #A86B53;
}
.app-tag--medium {
  background-color: #F7F0E5;
  color: #A87B4E;
}
.app-tag--low {
  background-color: #ECF0F3;
  color: #5A707A;
}
</style>
