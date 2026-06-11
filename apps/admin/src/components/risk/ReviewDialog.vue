<template>
  <el-dialog :model-value="visible" :title="title" width="480px" @update:model-value="$emit('update:visible', $event)" @close="resetForm">
    <el-form ref="formRef" :model="form" :rules="rules" label-position="top">
      <el-form-item label="复核备注" prop="note">
        <el-input v-model="form.note" type="textarea" :rows="3" :placeholder="isHighRisk ? '高风险事件必须填写复核备注' : '选填'" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="$emit('update:visible', false)">取消</el-button>
      <el-button :type="actionType" @click="submit">{{ actionLabel }}</el-button>
    </template>
  </el-dialog>
</template>
<script setup lang="ts">
import { ref, computed } from 'vue';
import type { FormInstance, FormRules } from 'element-plus';
import type { RiskEventRecord } from '@/api/risk';
const props = defineProps<{ visible: boolean; event: RiskEventRecord | null; action: 'confirm' | 'ignore'; }>();
const emit = defineEmits<{ 'update:visible': [value: boolean]; submit: [status: string, note?: string]; }>();
const formRef = ref<FormInstance>();
const form = ref({ note: '' });
const isHighRisk = computed(() => props.event?.level === 'HIGH');
const title = computed(() => props.action === 'confirm' ? '确认预警' : '忽略预警');
const actionType = computed(() => props.action === 'confirm' ? 'primary' : 'danger');
const actionLabel = computed(() => props.action === 'confirm' ? '确认' : '忽略');
const rules: FormRules = { note: [{ required: isHighRisk.value, message: '高风险事件必须填写复核备注', trigger: 'blur' }] };
function resetForm() { form.value.note = ''; formRef.value?.resetFields(); }
async function submit() {
  const valid = await formRef.value?.validate().catch(() => false);
  if (!valid) return;
  emit('submit', props.action === 'confirm' ? 'CONFIRMED' : 'IGNORED', form.value.note || undefined);
}
</script>
