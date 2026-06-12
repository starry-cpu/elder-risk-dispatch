<template>
  <el-table :data="items" v-loading="loading" stripe>
    <el-table-column label="工单号" prop="id" width="180" show-overflow-tooltip />
    <el-table-column label="老人" prop="elderName" min-width="100" />
    <el-table-column label="类型" width="80" prop="type"><template #default="{ row }">{{ typeLabel(row.type) }}</template></el-table-column>
    <el-table-column label="等级" width="80" prop="level"><template #default="{ row }"><el-tag :type="row.level === 'HIGH' ? 'danger' : row.level === 'MEDIUM' ? 'warning' : 'info'" size="small">{{ row.level === 'HIGH' ? '高' : row.level === 'MEDIUM' ? '中' : '低' }}</el-tag></template></el-table-column>
    <el-table-column label="状态" width="100" prop="status"><template #default="{ row }">{{ statusLabel(row.status) }}</template></el-table-column>
    <el-table-column label="负责人" prop="assigneeName" min-width="100" />
    <el-table-column label="截止时间" width="170" prop="deadline"><template #default="{ row }">{{ row.deadline ? dayjs(row.deadline).format('YYYY-MM-DD HH:mm') : '-' }}</template></el-table-column>
    <el-table-column label="操作" width="240" fixed="right">
      <template #default="{ row }">
        <template v-if="row.status === 'PENDING'"><el-button type="primary" link size="small" @click="$emit('assign', row)">派单</el-button></template>
        <template v-if="row.assigneeId && row.status !== 'COMPLETED'"><el-button type="warning" link size="small" @click="$emit('reassign', row)">改派</el-button></template>
        <el-button link size="small" @click="$emit('timeline', row)">时间线</el-button>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup lang="ts">
import dayjs from 'dayjs';
import type { WorkOrderRecord } from '@/api/work-orders';
defineProps<{ items: WorkOrderRecord[]; loading: boolean; }>();
defineEmits<{ assign: [row: WorkOrderRecord]; reassign: [row: WorkOrderRecord]; timeline: [row: WorkOrderRecord]; }>();
function typeLabel(type: string) { const map: Record<string, string> = { HEALTH: '健康', LIFE: '生活', REPAIR: '维修', ESCORT: '陪诊', COMPANION: '陪伴', ERRAND: '代购' }; return map[type] || type; }
function statusLabel(status: string) { const map: Record<string, string> = { PENDING: '待分配', ASSIGNED: '已分配', IN_PROGRESS: '处理中', COMPLETED: '已完成', CANCELLED: '已取消' }; return map[status] || status; }
</script>
