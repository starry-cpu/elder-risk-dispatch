<template>
  <view
    class="app-button"
    :class="[typeClass, sizeClass, { 'app-button--disabled': disabled, 'app-button--loading': loading }]"
    @click="handleClick"
  >
    <text v-if="loading" class="app-button__loading-icon">⟳</text>
    <slot />
  </view>
</template>

<script setup lang="ts">
import { computed } from 'vue';

const props = withDefaults(defineProps<{
  type?: 'primary' | 'secondary' | 'text' | 'danger';
  size?: 'full' | 'auto' | 'compact';
  disabled?: boolean;
  loading?: boolean;
}>(), {
  type: 'primary',
  size: 'auto',
  disabled: false,
  loading: false,
});

const emit = defineEmits<{
  click: [];
}>();

const typeClass = computed(() => `app-button--${props.type}`);
const sizeClass = computed(() => `app-button--${props.size}`);

function handleClick() {
  if (props.disabled || props.loading) return;
  emit('click');
}
</script>

<style scoped>
.app-button {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8rpx;
  border-radius: 12rpx;
  font-weight: 500;
  font-size: 28rpx;
  transition: filter 0.15s;
  cursor: pointer;
}

/* Sizes */
.app-button--full {
  width: 100%;
  height: 88rpx;
  font-size: 32rpx;
}
.app-button--auto {
  padding: 20rpx 28rpx;
  height: 64rpx;
}
.app-button--compact {
  padding: 14rpx 20rpx;
  height: 48rpx;
  font-size: 24rpx;
}

/* Types */
.app-button--primary {
  background-color: #7A8B6E;
  color: #FEFDFB;
}
.app-button--secondary {
  background-color: transparent;
  color: #2C2B29;
  border: 1.5rpx solid #E8E3DA;
}
.app-button--text {
  background-color: transparent;
  color: #6B6760;
}
.app-button--danger {
  background-color: #C4856B;
  color: #FEFDFB;
}

/* States */
.app-button:active:not(.app-button--disabled):not(.app-button--loading) {
  filter: brightness(0.92);
}
.app-button--disabled {
  opacity: 0.45;
}
.app-button--loading {
  opacity: 0.7;
}

.app-button__loading-icon {
  font-size: 28rpx;
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
</style>
