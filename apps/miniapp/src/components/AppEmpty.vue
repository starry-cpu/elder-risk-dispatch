<template>
  <view class="app-empty">
    <text class="app-empty__message">{{ message }}</text>
    <text v-if="hint" class="app-empty__hint">{{ hint }}</text>
    <AppButton
      v-if="actionLabel"
      type="text"
      size="compact"
      @click="handleAction"
    >
      {{ actionLabel }}
    </AppButton>
  </view>
</template>

<script setup lang="ts">
import AppButton from './AppButton.vue';

withDefaults(defineProps<{
  message: string;
  hint?: string;
  actionLabel?: string;
}>(), {
  hint: '',
  actionLabel: '',
});

const emit = defineEmits<{
  action: [];
}>();

function handleAction() {
  emit('action');
}
</script>

<style scoped>
.app-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 80rpx 48rpx;
  gap: 12rpx;
}
.app-empty__message {
  font-size: 32rpx;
  font-weight: 500;
  color: #2C2B29;
}
.app-empty__hint {
  font-size: 28rpx;
  color: #6B6760;
  text-align: center;
  line-height: 1.6;
}
</style>
