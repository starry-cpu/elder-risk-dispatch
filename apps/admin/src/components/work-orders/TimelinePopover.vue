<template>
  <el-popover :visible="visible" placement="left" :width="300" @hide="$emit('update:visible', false)">
    <template #reference><span /></template>
    <el-timeline v-if="timeline.length > 0">
      <el-timeline-item v-for="item in timeline" :key="item.id" :timestamp="dayjs(item.createdAt).format('MM-DD HH:mm')">{{ item.action }} {{ item.note ? `— ${item.note}` : '' }}</el-timeline-item>
    </el-timeline>
    <div v-else class="text-center text-gray-400 py-4">暂无流转记录</div>
  </el-popover>
</template>
<script setup lang="ts">
import dayjs from 'dayjs';
defineProps<{ visible: boolean; timeline: Array<{ id: string; action: string; note?: string; createdAt: string }>; }>();
defineEmits<{ 'update:visible': [value: boolean]; }>();
</script>
