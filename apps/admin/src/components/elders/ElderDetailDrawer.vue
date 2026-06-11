<template>
  <el-drawer
    :model-value="visible"
    title="老人详情"
    size="480px"
    @update:model-value="$emit('update:visible', $event)"
  >
    <template v-if="elder">
      <el-descriptions title="基本信息" :column="2" border>
        <el-descriptions-item label="姓名">
          {{ elder.name }}
        </el-descriptions-item>
        <el-descriptions-item label="性别">
          {{ elder.gender === 'M' ? '男' : '女' }}
        </el-descriptions-item>
        <el-descriptions-item label="出生日期">
          {{
            elder.birthDate
              ? dayjs(elder.birthDate).format('YYYY-MM-DD')
              : '-'
          }}
        </el-descriptions-item>
        <el-descriptions-item label="片区">
          {{ elder.district }}
        </el-descriptions-item>
        <el-descriptions-item label="地址" :span="2">
          {{ elder.address || '-' }}
        </el-descriptions-item>
        <el-descriptions-item label="健康标签" :span="2">
          <el-tag
            v-for="tag in elder.healthTags"
            :key="tag"
            size="small"
            class="mr-1"
          >
            {{ tag }}
          </el-tag>
        </el-descriptions-item>
      </el-descriptions>

      <el-descriptions
        title="紧急联系人"
        :column="1"
        border
        class="mt-6"
      >
        <el-descriptions-item
          v-for="c in elder.contacts"
          :key="c.id"
          :label="c.relation"
        >
          {{ c.name }} — {{ c.phone }}
          {{ c.isPrimary ? '(主要)' : '' }}
        </el-descriptions-item>
        <el-descriptions-item v-if="elder.contacts.length === 0" label="暂无">
          无紧急联系人
        </el-descriptions-item>
      </el-descriptions>

      <div class="mt-6">
        <div class="text-base font-medium mb-3">风险画像</div>
        <el-timeline v-if="riskProfile.length > 0">
          <el-timeline-item
            v-for="r in riskProfile"
            :key="r.id"
            :timestamp="dayjs(r.createdAt).format('YYYY-MM-DD HH:mm')"
            :type="
              r.level === 'HIGH'
                ? 'danger'
                : r.level === 'MEDIUM'
                  ? 'warning'
                  : 'primary'
            "
          >
            [{{ r.level }}] {{ r.reason }} (分数: {{ r.score }})
          </el-timeline-item>
        </el-timeline>
        <div v-else class="text-center text-gray-400 py-4">
          暂无风险记录
        </div>
      </div>
    </template>
  </el-drawer>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue';
import dayjs from 'dayjs';
import { eldersApi } from '@/api';
import type { ElderDetail } from '@/api/elders';

const props = defineProps<{
  visible: boolean;
  elder: ElderDetail | null;
}>();

defineEmits<{
  'update:visible': [value: boolean];
}>();

const riskProfile = ref<
  Array<{
    id: string;
    level: string;
    source: string;
    score: number;
    reason: string;
    createdAt: string;
  }>
>([]);

watch(
  () => [props.visible, props.elder],
  async ([v, elder]) => {
    if (v && elder) {
      const res = await eldersApi.getRiskProfile(elder.id);
      riskProfile.value = res.data.data;
    }
  },
);
</script>
