<template>
  <el-table :data="items" v-loading="loading" stripe>
    <el-table-column label="工单号" prop="id" width="180" show-overflow-tooltip />
    <el-table-column label="老人" prop="elderName" min-width="100" />
    <el-table-column label="类型" width="80" prop="type"><template #default="{ row }">{{ typeLabel(row.type) }}</template></el-table-column>
    <el-table-column label="等级" width="80" prop="level"><template #default="{ row }"><el-tag :type="row.level === 'HIGH' ? 'danger' : row.level === 'MEDIUM' ? 'warning' : 'info'" size="small">{{ row.level === 'HIGH' ? '高' : row.level === 'MEDIUM' ? '中' : '低' }}</el-tag></template></el-table-column>
    <el-table-column label="状态" width="100" prop="status"><template #default="{ row }">{{ statusLabel(row.status) }}</template></el-table-column>
    <el-table-column label="来源" width="100" prop="sourceFrom"><template #default="{ row }"><el-tag :type="sourceTagType(row.sourceFrom)" size="small">{{ sourceLabel(row.sourceFrom) }}</el-tag></template></el-table-column>
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
// 工单来源标签：家属请求蓝色高亮，紧急求助红色，风险派单紫色，手动默认
function sourceLabel(src?: string) {
  const map: Record<string, string> = { MANUAL: '手动', RISK_DISPATCH: '风险派单', FAMILY_REQUEST: '家属请求', SOS: '紧急求助' };
  return map[src || 'MANUAL'] || '手动';
}
function sourceTagType(src?: string) {
  const map: Record<string, '' | 'primary' | 'success' | 'warning' | 'danger' | 'info'> = { MANUAL: 'info', RISK_DISPATCH: 'warning', FAMILY_REQUEST: 'primary', SOS: 'danger' };
  return map[src || 'MANUAL'] || 'info';
}
</script>
