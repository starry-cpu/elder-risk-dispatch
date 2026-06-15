<template>
  <el-table
    :data="items"
    v-loading="loading"
    stripe
    @row-click="(row: ElderRecord) => $emit('detail', row)"
  >
    <el-table-column label="姓名" prop="name" min-width="80" />
    <el-table-column label="性别" width="60" prop="gender">
      <template #default="{ row }">
        {{ genderLabel(row.gender) }}
      </template>
    </el-table-column>
    <el-table-column label="年龄" width="60">
      <template #default="{ row }">
        {{ calcAge(row.birthDate) }}
      </template>
    </el-table-column>
    <el-table-column label="片区" prop="district" width="100" />
    <el-table-column label="健康标签" min-width="140">
      <template #default="{ row }">
        <el-tag
          v-for="tag in row.healthTags"
          :key="tag"
          size="small"
          class="mr-1"
        >
          {{ tag }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="服务等级" width="90" prop="serviceLevel">
      <template #default="{ row }">
        <el-tag
          :type="
            row.serviceLevel === 'HIGH'
              ? 'danger'
              : row.serviceLevel === 'KEY'
                ? 'warning'
                : 'info'
          "
          size="small"
        >
          {{
            row.serviceLevel === 'HIGH'
              ? '高风险'
              : row.serviceLevel === 'KEY'
                ? '重点关注'
                : '普通'
          }}
        </el-tag>
      </template>
    </el-table-column>
    <el-table-column label="最近报平安" width="170">
      <template #default="{ row }">
        {{
          row.lastCheckInTime
            ? dayjs(row.lastCheckInTime).format('YYYY-MM-DD HH:mm')
            : '-'
        }}
      </template>
    </el-table-column>
    <el-table-column label="操作" width="80" fixed="right">
      <template #default="{ row }">
        <el-button
          type="primary"
          link
          size="small"
          @click.stop="$emit('detail', row)"
        >
          详情
        </el-button>
      </template>
    </el-table-column>
  </el-table>
</template>

<script setup lang="ts">
import dayjs from 'dayjs';
import type { ElderRecord } from '@/api/elders';
import { genderLabel } from '@/utils/elders';

defineProps<{
  items: ElderRecord[];
  loading: boolean;
}>();

defineEmits<{
  detail: [row: ElderRecord];
}>();

function calcAge(birthDate?: string): number | string {
  if (!birthDate) return '-';
  return dayjs().diff(dayjs(birthDate), 'year');
}
</script>
