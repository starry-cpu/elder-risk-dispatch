<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <div class="flex gap-3">
          <el-select v-model="filters.level" placeholder="风险等级" clearable class="w-120px" @change="load">
            <el-option label="高风险" value="HIGH" /><el-option label="中风险" value="MEDIUM" />
          </el-select>
          <el-select v-model="filters.status" placeholder="状态" clearable class="w-120px" @change="load">
            <el-option label="待复核" value="PENDING_REVIEW" /><el-option label="已确认" value="CONFIRMED" /><el-option label="已忽略" value="IGNORED" />
          </el-select>
        </div>
      </div>
      <RiskTable :items="store.items" :loading="store.loading" @confirm="openReview($event, 'confirm')" @ignore="openReview($event, 'ignore')" />
      <div class="mt-4 flex justify-end">
        <el-pagination v-model:current-page="page" v-model:page-size="limit" :total="store.total" :page-sizes="[20, 50, 100]" layout="total, sizes, prev, pager, next" @change="load" />
      </div>
    </el-card>
    <ReviewDialog :visible="dialogVisible" :event="selectedEvent" :action="reviewAction" @update:visible="dialogVisible = $event" @submit="handleReviewSubmit" />
  </div>
</template>
<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { useRiskStore } from '@/stores/risk';
import RiskTable from '@/components/risk/RiskTable.vue';
import ReviewDialog from '@/components/risk/ReviewDialog.vue';
import type { RiskEventRecord } from '@/api/risk';

const store = useRiskStore();
const page = ref(1);
const limit = ref(20);
const filters = reactive({ level: '', status: '' });
const dialogVisible = ref(false);
const selectedEvent = ref<RiskEventRecord | null>(null);
const reviewAction = ref<'confirm' | 'ignore'>('confirm');

function load() {
  const params: { page: number; limit: number; level?: string; status?: string } = { page: page.value, limit: limit.value };
  if (filters.level) params.level = filters.level;
  if (filters.status) params.status = filters.status;
  store.fetchList(params);
}
function openReview(event: RiskEventRecord, action: 'confirm' | 'ignore') { selectedEvent.value = event; reviewAction.value = action; dialogVisible.value = true; }
async function handleReviewSubmit(status: string, note?: string) {
  if (!selectedEvent.value) return;
  await store.review(selectedEvent.value.id, status, note);
  ElMessage.success(status === 'CONFIRMED' ? '已确认' : '已忽略');
  dialogVisible.value = false;
  load();
}
onMounted(() => { load(); });
</script>
