<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <div class="flex gap-3">
          <el-input
            v-model="filters.search"
            placeholder="搜索老人姓名"
            clearable
            class="w-200px"
            @change="load"
          />
          <el-select
            v-model="filters.district"
            placeholder="片区"
            clearable
            class="w-120px"
            @change="load"
          >
            <el-option label="东城" value="东城" />
            <el-option label="西城" value="西城" />
          </el-select>
          <el-select
            v-model="filters.serviceLevel"
            placeholder="服务等级"
            clearable
            class="w-120px"
            @change="load"
          >
            <el-option label="高风险" value="HIGH" />
            <el-option label="重点关注" value="KEY" />
            <el-option label="普通" value="NORMAL" />
          </el-select>
        </div>
      </div>

      <ElderTable
        :items="store.items"
        :loading="store.loading"
        @detail="openDetail"
      />

      <div class="mt-4 flex justify-end">
        <el-pagination
          v-model:current-page="page"
          v-model:page-size="limit"
          :total="store.total"
          :page-sizes="[20, 50, 100]"
          layout="total, sizes, prev, pager, next"
          @change="load"
        />
      </div>
    </el-card>

    <ElderDetailDrawer
      :visible="drawerVisible"
      :elder="store.currentElder"
      @update:visible="drawerVisible = $event"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { useElderStore } from '@/stores/elders';
import ElderTable from '@/components/elders/ElderTable.vue';
import ElderDetailDrawer from '@/components/elders/ElderDetailDrawer.vue';
import type { ElderRecord } from '@/api/elders';

const store = useElderStore();
const page = ref(1);
const limit = ref(20);
const filters = reactive({ search: '', district: '', serviceLevel: '' });
const drawerVisible = ref(false);

function load() {
  store.fetchList({ page: page.value, limit: limit.value, ...filters });
}

async function openDetail(row: ElderRecord) {
  await store.fetchDetail(row.id);
  drawerVisible.value = true;
}

onMounted(() => {
  load();
});
</script>
