<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <el-select v-model="filters.status" placeholder="状态" clearable class="w-120px" @change="load">
          <el-option label="待分配" value="PENDING" /><el-option label="已分配" value="ASSIGNED" /><el-option label="处理中" value="IN_PROGRESS" /><el-option label="已完成" value="COMPLETED" />
        </el-select>
      </div>
      <OrderTable :items="store.items" :loading="store.loading" @assign="openAssign($event, false)" @reassign="openAssign($event, true)" @timeline="openTimeline($event)" />
      <div class="mt-4 flex justify-end">
        <el-pagination v-model:current-page="page" v-model:page-size="limit" :total="store.total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next" @change="load" />
      </div>
    </el-card>
    <AssignDialog :visible="assignVisible" :is-reassign="isReassign" :recommendations="recommendations" @update:visible="assignVisible = $event" @submit="handleAssignSubmit" />
    <TimelinePopover :visible="timelineVisible" :timeline="timelineData" @update:visible="timelineVisible = $event" />
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useWorkOrderStore } from '@/stores/work-orders';
import OrderTable from '@/components/work-orders/OrderTable.vue';
import AssignDialog from '@/components/work-orders/AssignDialog.vue';
import TimelinePopover from '@/components/work-orders/TimelinePopover.vue';
import type { WorkOrderRecord, DispatchRecommendation } from '@/api/work-orders';

const store = useWorkOrderStore();
const page = ref(1); const limit = ref(20);
const filters = reactive({ status: '' });
const assignVisible = ref(false); const isReassign = ref(false);
const selectedOrder = ref<WorkOrderRecord | null>(null);
const recommendations = ref<DispatchRecommendation[]>([]);
const timelineVisible = ref(false);
const timelineData = ref<Array<{ id: string; action: string; note?: string; createdAt: string }>>([]);

function load() { store.fetchList({ page: page.value, limit: limit.value, ...filters }); }
async function openAssign(order: WorkOrderRecord, reassign: boolean) { selectedOrder.value = order; isReassign.value = reassign; recommendations.value = await store.fetchRecommendations(order.id); assignVisible.value = true; }
async function handleAssignSubmit(assigneeId: string, reason?: string) {
  if (!selectedOrder.value) return;
  if (isReassign.value) { await store.reassign(selectedOrder.value.id, assigneeId, reason || ''); ElMessage.success('改派成功'); }
  else { await store.assign(selectedOrder.value.id, assigneeId); ElMessage.success('派单成功'); }
  assignVisible.value = false; load();
}
async function openTimeline(order: WorkOrderRecord) { timelineData.value = await store.fetchTimeline(order.id); timelineVisible.value = true; }
onMounted(() => { load(); });
</script>
