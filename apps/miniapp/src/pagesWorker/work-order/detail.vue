<template>
  <view class="page p-4" v-if="order">
    <view class="bg-white rounded-lg p-4 shadow-sm mb-4">
      <view class="text-lg font-bold mb-2">{{ TYPE_LABELS[order.type] || order.type }}</view>
      <view class="text-sm text-gray-600 space-y-1"><view>老人: {{ order.elderName || order.elderId }}</view><view>等级: {{ order.level }}</view><view>状态: {{ STATUS_LABELS[order.status] || order.status }}</view><view v-if="order.deadline">截止: {{ order.deadline }}</view></view>
    </view>
    <view class="bg-white rounded-lg p-4 shadow-sm mb-4" v-if="availableActions.length > 0">
      <view class="text-sm font-medium mb-3">可执行操作</view>
      <view class="flex flex-wrap gap-2"><wd-button v-for="action in availableActions" :key="action" size="small" :type="action === 'COMPLETE' ? 'primary' : 'info'" @click="handleAction(action)">{{ actionLabels[action] || action }}</wd-button></view>
    </view>
    <wd-message-box v-model="resultDialogVisible" title="填写处理结果"><wd-textarea v-model="resultText" :rows="3" placeholder="请描述处理结果" /><template #footer><wd-button size="small" @click="resultDialogVisible = false">取消</wd-button><wd-button size="small" type="primary" @click="submitResult">确认</wd-button></template></wd-message-box>
    <view class="bg-white rounded-lg p-4 shadow-sm"><view class="text-sm font-medium mb-3">流转时间线</view><wd-timeline v-if="timeline.length > 0"><wd-timeline-item v-for="t in timeline" :key="t.id" :title="t.action" :content="t.note || ''" :time="t.createdAt" /></wd-timeline></view>
  </view>
</template>
<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useWorkOrderFlow } from '@/composables/useWorkOrderFlow';
import { TYPE_LABELS, STATUS_LABELS } from '@/composables/useOrderProgress';
const { getAvailableActions, validateCompletion } = useWorkOrderFlow();
const order = ref<any>(null); const timeline = ref<any[]>([]); const resultText = ref(''); const resultDialogVisible = ref(false);
const availableActions = computed(() => order.value ? getAvailableActions(order.value.status) : []);
const actionLabels: Record<string, string> = { START: '开始处理', COMPLETE: '完成' };
const actionRoute: Record<string, string> = { START: 'start', COMPLETE: 'complete' };
function loadDetail() { const pages = getCurrentPages(); const id = (pages[pages.length - 1] as any)?.options?.id; if (!id) return; const token = uni.getStorageSync('token'); uni.request({ url: `/api/v1/work-orders/${id}`, header: { Authorization: `Bearer ${token}` }, success: (res: any) => { if (res.data?.data) order.value = res.data.data; } }); uni.request({ url: `/api/v1/work-orders/${id}/timeline`, header: { Authorization: `Bearer ${token}` }, success: (res: any) => { if (res.data?.data) timeline.value = res.data.data; } }); }
function handleAction(action: string) { if (action === 'COMPLETE') { resultDialogVisible.value = true; return; } if (!order.value) return; const route = actionRoute[action]; if (!route) { uni.showToast({ title: `不支持的操作: ${action}`, icon: 'none' }); return; } uni.request({ url: `/api/v1/work-orders/${order.value.id}/${route}`, method: 'POST', header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, success: () => { uni.showToast({ title: '操作成功' }); loadDetail(); } }); }
function submitResult() { if (!order.value) return; const validation = validateCompletion(resultText.value); if (!validation.valid) { uni.showToast({ title: validation.message || '请填写处理结果', icon: 'none' }); return; } uni.request({ url: `/api/v1/work-orders/${order.value.id}/complete`, method: 'POST', data: { result: resultText.value }, header: { Authorization: `Bearer ${uni.getStorageSync('token')}` }, success: () => { uni.showToast({ title: '已完成' }); resultDialogVisible.value = false; loadDetail(); } }); }
onMounted(() => { loadDetail(); });
</script>
