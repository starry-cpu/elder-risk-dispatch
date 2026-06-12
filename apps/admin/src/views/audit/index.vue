<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <div class="flex gap-3">
          <el-select
            v-model="filters.action"
            placeholder="操作类型"
            clearable
            class="w-140px"
            @change="load"
          >
            <el-option label="CREATE" value="CREATE" />
            <el-option label="UPDATE" value="UPDATE" />
            <el-option label="DELETE" value="DELETE" />
            <el-option label="LOGIN" value="LOGIN" />
          </el-select>
          <el-select
            v-model="filters.resourceType"
            placeholder="资源类型"
            clearable
            class="w-140px"
            @change="load"
          >
            <el-option label="ELDER" value="ELDER" />
            <el-option label="RISK_EVENT" value="RISK_EVENT" />
            <el-option label="WORK_ORDER" value="WORK_ORDER" />
            <el-option label="USER" value="USER" />
          </el-select>
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            range-separator="至"
            start-placeholder="开始日期"
            end-placeholder="结束日期"
            @change="load"
          />
        </div>
      </div>
      <el-table :data="logs" v-loading="loading" stripe>
        <el-table-column label="时间" width="170" prop="createdAt">
          <template #default="{ row }">
            {{ dayjs(row.createdAt).format('YYYY-MM-DD HH:mm:ss') }}
          </template>
        </el-table-column>
        <el-table-column label="操作" prop="action" width="100" />
        <el-table-column label="资源类型" prop="resourceType" width="120" />
        <el-table-column
          label="资源ID"
          prop="resourceId"
          width="200"
          show-overflow-tooltip
        />
        <el-table-column
          label="用户ID"
          prop="userId"
          width="200"
          show-overflow-tooltip
        />
        <el-table-column label="IP" prop="ip" width="140" />
      </el-table>
      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="limit"
          :total="total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import dayjs from 'dayjs';
import { auditApi } from '@/api';
import type { AuditLogRecord } from '@/api/audit';

const logs = ref<AuditLogRecord[]>([]);
const total = ref(0);
const loading = ref(false);
const page = ref(1);
const limit = ref(20);
const filters = reactive({ action: '', resourceType: '' });
const dateRange = ref<[Date, Date] | null>(null);

function load() {
  loading.value = true;
  const params: Record<string, any> = {
    page: page.value,
    limit: limit.value,
  };
  if (filters.action) params.action = filters.action;
  if (filters.resourceType) params.resourceType = filters.resourceType;
  if (dateRange.value) {
    params.from = dayjs(dateRange.value[0]).startOf('day').toISOString();
    params.to = dayjs(dateRange.value[1]).endOf('day').toISOString();
  }
  auditApi
    .list(params)
    .then((res) => {
      logs.value = res.data.data.items;
      total.value = res.data.data.total;
    })
    .finally(() => {
      loading.value = false;
    });
}

onMounted(() => {
  load();
});
</script>
