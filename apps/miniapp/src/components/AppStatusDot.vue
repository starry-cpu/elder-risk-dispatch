<template>
  <view
    class="app-status-dot"
    :class="[statusClass, { 'app-status-dot--hollow': !filled }]"
    :style="{ width: size + 'rpx', height: size + 'rpx' }"
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  status: string;
  filled?: boolean;
  size?: number;
}>(), {
  filled: true,
  size: 12,
});

const STATUS_COLORS: Record<string, string> = {
  high: 'app-status-dot--high',
  medium: 'app-status-dot--medium',
  low: 'app-status-dot--low',
  success: 'app-status-dot--success',
  info: 'app-status-dot--info',
  warning: 'app-status-dot--warning',
};

const statusClass = computed(() => STATUS_COLORS[props.status] || STATUS_COLORS.info);
</script>

<style scoped>
.app-status-dot {
  border-radius: 9999rpx;
  flex-shrink: 0;
  display: inline-block;
}
.app-status-dot--high { background-color: #C4856B; }
.app-status-dot--medium { background-color: #C49B5E; }
.app-status-dot--low { background-color: #6E8A9A; }
.app-status-dot--success { background-color: #7A9A6E; }
.app-status-dot--info { background-color: #6E8A9A; }
.app-status-dot--warning { background-color: #C49B5E; }

.app-status-dot--hollow {
  background-color: transparent;
  border: 2rpx solid currentColor;
}
.app-status-dot--hollow.app-status-dot--high { border-color: #C4856B; color: #C4856B; }
.app-status-dot--hollow.app-status-dot--medium { border-color: #C49B5E; color: #C49B5E; }
.app-status-dot--hollow.app-status-dot--low { border-color: #6E8A9A; color: #6E8A9A; }
.app-status-dot--hollow.app-status-dot--success { border-color: #7A9A6E; color: #7A9A6E; }
.app-status-dot--hollow.app-status-dot--info { border-color: #6E8A9A; color: #6E8A9A; }
.app-status-dot--hollow.app-status-dot--warning { border-color: #C49B5E; color: #C49B5E; }
</style>
