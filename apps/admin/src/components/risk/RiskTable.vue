<template>
  <el-table :data="items" v-loading="loading" stripe>
    <el-table-column label="等级" width="80" prop="level">
      <template #default="{ row }">
        <el-tag :type="row.level === 'HIGH' ? 'danger' : 'warning'" size="small">
          {{ row.level === 'HIGH' ? '高' : '中' }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="老人" prop="elderName" min-width="100" />
    <el-table-column label="来源" prop="source" width="120" />
    <el-table-column label="分数" prop="score" width="70" />
    <el-table-column label="原因" prop="reason" min-width="180" show-overflow-tooltip />
    <el-table-column label="状态" width="100" prop="status">
      <template #default="{ row }">
        {{ row.status === 'PENDING_REVIEW' ? '待复核' : row.status === 'CONFIRMED' ? '已确认' : '已忽略' }}
      </template>
    </el-table-column>
    <el-table-column label="时间" width="170" prop="createdAt">
      <template #default="{ row }">{{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm') }}</template>
    </el-table-column>
    <el-table-column label="操作" width="150" fixed="right">
      <template #default="{ row }">
        <template v-if="row.status === 'PENDING_REVIEW'">
          <el-button type="primary" link size="small" @click="$emit('confirm', row)">确认</el-button>
          <el-button type="danger" link size="small" @click="$emit('ignore', row)">忽略</el-button>
        </template>
        <span v-else class="text-gray-400">-</span>
      </template>
    </el-table-column>
  </el-table>
</template>
<script setup lang="ts">
import dayjs from 'dayjs';
import type { RiskEventRecord } from '@/api/risk';
defineProps<{ items: RiskEventRecord[]; loading: boolean; }>();
defineEmits<{ confirm: [row: RiskEventRecord]; ignore: [row: RiskEventRecord]; }>();
</script>
