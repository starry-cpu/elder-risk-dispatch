<template>
  <view
    class="app-card"
    :class="{ 'app-card--clickable': clickable }"
    @click="handleClick"
  >
    <view
      v-if="accentColor"
      class="app-card__accent"
      :style="{ backgroundColor: accentColor }"
    />
    <view class="app-card__body">
      <slot />
    </view>
  </view>
</template>

<script setup lang="ts">
const props = withDefaults(defineProps<{
  accentColor?: string;
  clickable?: boolean;
}>(), {
  clickable: false,
});

const emit = defineEmits<{
  click: [];
}>();

function handleClick() {
  if (!props.clickable) return;
  emit('click');
}
</script>

<style scoped>
.app-card {
  display: flex;
  flex-direction: row;
  background-color: #FEFDFB;
  border-radius: 12rpx;
  margin: 0 20rpx 20rpx 20rpx;
  box-shadow: 0 1rpx 0 #E8E3DA;
  overflow: hidden;
  position: relative;
}
.app-card--clickable:active {
  filter: brightness(0.97);
}
.app-card__accent {
  width: 4rpx;
  flex-shrink: 0;
  align-self: stretch;
}
.app-card__body {
  flex: 1;
  padding: 20rpx;
  min-width: 0;
}
</style>
