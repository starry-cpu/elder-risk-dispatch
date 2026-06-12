<template>
  <el-dialog :model-value="visible" :title="isReassign ? '改派工单' : '派单'" width="560px" @update:model-value="$emit('update:visible', $event)">
    <div v-if="recommendations.length > 0" class="mb-4">
      <div class="text-sm text-gray-500 mb-2">推荐人员 (按匹配度排序)</div>
      <el-table :data="recommendations" max-height="300" @row-click="selectRec" highlight-current-row>
        <el-table-column label="姓名" prop="assignee.name" width="100" />
        <el-table-column label="片区" prop="assignee.district" width="80" />
        <el-table-column label="技能" width="180"><template #default="{ row }">{{ row.assignee.skills.join(', ') }}</template></el-table-column>
        <el-table-column label="在岗" width="70" prop="assignee.dutyStatus"><template #default="{ row }"><el-tag :type="row.assignee.dutyStatus === 'ON_DUTY' ? 'success' : 'info'" size="small">{{ row.assignee.dutyStatus === 'ON_DUTY' ? '在岗' : '离岗' }}</el-tag></template></el-table-column>
        <el-table-column label="匹配分" width="80" prop="score" />
      </el-table>
    </div>
    <el-form v-if="isReassign" ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="改派原因" prop="reason"><el-input v-model="form.reason" type="textarea" :rows="2" placeholder="请填写改派原因" /></el-form-item>
    </el-form>
    <div v-if="selected" class="mt-2 text-sm">已选择: <el-tag>{{ selected.assignee.name }}</el-tag></div>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button type="primary" :disabled="!selected" :loading="submitting" @click="handleSubmit">确认{{ isReassign ? '改派' : '派单' }}</el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { ref, reactive, watch } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import type { DispatchRecommendation } from '@/api/work-orders';
const props = defineProps<{ visible: boolean; isReassign: boolean; recommendations: DispatchRecommendation[]; }>();
const emit = defineEmits<{ 'update:visible': [value: boolean]; submit: [assigneeId: string, reason?: string]; }>();
const formRef = ref<FormInstance>();
const selected = ref<DispatchRecommendation | null>(null);
const submitting = ref(false);
const form = reactive({ reason: '' });
const rules: FormRules = { reason: [{ required: true, message: '请填写改派原因', trigger: 'blur' }] };
watch(() => props.visible, (v) => { if (!v) { selected.value = null; form.reason = ''; } });
function selectRec(rec: DispatchRecommendation) { selected.value = rec; }
async function handleSubmit() { if (!selected.value) return; if (props.isReassign && formRef.value) { const valid = await formRef.value.validate().catch(() => false); if (!valid) return; } submitting.value = true; try { emit('submit', selected.value.assignee.id, form.reason || undefined); } finally { submitting.value = false; } }
</script>
