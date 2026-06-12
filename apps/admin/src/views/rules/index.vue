<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <span class="text-lg font-medium">风险规则配置</span>
        <el-button type="primary" @click="openCreate">新增规则</el-button>
      </div>
      <el-table :data="rules" v-loading="loading" stripe>
        <el-table-column label="规则名称" prop="name" min-width="140" />
        <el-table-column label="权重" prop="weight" width="80" />
        <el-table-column label="等级" width="80" prop="level">
          <template #default="{ row }">
            <el-tag
              :type="
                row.level === 'HIGH'
                  ? 'danger'
                  : row.level === 'MEDIUM'
                    ? 'warning'
                    : 'info'
              "
              size="small"
            >
              {{ row.level }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="版本" prop="version" width="70" />
        <el-table-column label="启用" width="70" prop="enabled">
          <template #default="{ row }">
            <el-switch :model-value="row.enabled" disabled size="small" />
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{ row }">
            <el-button
              type="primary"
              link
              size="small"
              @click="openEdit(row)"
            >
              编辑
            </el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <el-dialog
      :model-value="dialogVisible"
      :title="editingRule ? '编辑规则' : '新增规则'"
      width="480px"
      @update:model-value="dialogVisible = $event"
    >
      <el-form ref="formRef" :model="form" label-position="top">
        <el-form-item label="规则名称" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="条件 (JSON)" required>
          <el-input
            v-model="form.conditionStr"
            type="textarea"
            :rows="4"
            placeholder='{"key": "value"}'
          />
        </el-form-item>
        <el-form-item label="权重" required>
          <el-input-number v-model="form.weight" :min="1" :max="100" />
        </el-form-item>
        <el-form-item label="等级" required>
          <el-select v-model="form.level" class="w-full">
            <el-option label="HIGH" value="HIGH" />
            <el-option label="MEDIUM" value="MEDIUM" />
            <el-option label="LOW" value="LOW" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSave">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup lang="ts">
import { ref, reactive, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { rulesApi } from '@/api';
import type { RiskRuleRecord } from '@/api/rules';

const rules = ref<RiskRuleRecord[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingRule = ref<RiskRuleRecord | null>(null);
const form = reactive({
  name: '',
  conditionStr: '{}',
  weight: 10,
  level: 'MEDIUM' as string,
});

function load() {
  loading.value = true;
  rulesApi
    .list()
    .then((res) => {
      rules.value = res.data.data;
    })
    .finally(() => {
      loading.value = false;
    });
}

function openCreate() {
  editingRule.value = null;
  form.name = '';
  form.conditionStr = '{}';
  form.weight = 10;
  form.level = 'MEDIUM';
  dialogVisible.value = true;
}

function openEdit(row: RiskRuleRecord) {
  editingRule.value = row;
  form.name = row.name;
  form.conditionStr = JSON.stringify(row.condition, null, 2);
  form.weight = row.weight;
  form.level = row.level;
  dialogVisible.value = true;
}

async function handleSave() {
  try {
    const data = {
      name: form.name,
      condition: JSON.parse(form.conditionStr),
      weight: form.weight,
      level: form.level,
      enabled: true,
    };
    if (editingRule.value) {
      await rulesApi.update(editingRule.value.id, data);
    } else {
      await rulesApi.create(data as any);
    }
    ElMessage.success('保存成功');
    dialogVisible.value = false;
    load();
  } catch {
    ElMessage.error('保存失败，请检查条件 JSON 格式');
  }
}

onMounted(() => {
  load();
});
</script>
