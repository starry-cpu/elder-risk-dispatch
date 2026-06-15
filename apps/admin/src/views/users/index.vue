<template>
  <div class="space-y-4">
    <el-card>
      <div class="flex-between mb-4">
        <el-select
          v-model="filters.role"
          placeholder="角色"
          clearable
          class="w-120px"
          @change="load"
        >
          <el-option label="网格员" value="GRID_WORKER" />
          <el-option label="社区医生" value="COMMUNITY_DOCTOR" />
          <el-option label="物业" value="PROPERTY" />
          <el-option label="志愿者" value="VOLUNTEER" />
        </el-select>
        <el-button type="primary" @click="openCreate">新增人员</el-button>
      </div>
      <el-table :data="users" v-loading="loading" stripe>
        <el-table-column label="姓名" prop="name" />
        <el-table-column label="手机号" prop="phone" width="130" />
        <el-table-column label="角色" width="100" prop="role">
          <template #default="{ row }">
            {{ roleLabel(row.role) }}
          </template>
        </el-table-column>
        <el-table-column label="技能" min-width="150">
          <template #default="{ row }">
            {{ row.skills.join(', ') || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="片区" prop="district" />
        <el-table-column label="在岗" width="80" prop="dutyStatus">
          <template #default="{ row }">
            <el-tag
              :type="row.dutyStatus === 'ON_DUTY' ? 'success' : 'info'"
              size="small"
            >
              {{ row.dutyStatus === 'ON_DUTY' ? '在岗' : '离岗' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80">
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
      :title="editingUser ? '编辑人员' : '新增人员'"
      width="480px"
      @update:model-value="dialogVisible = $event"
    >
      <el-form :model="form" label-position="top">
        <el-form-item label="姓名" required>
          <el-input v-model="form.name" />
        </el-form-item>
        <el-form-item label="手机号" required>
          <el-input v-model="form.phone" />
        </el-form-item>
        <el-form-item label="角色" required>
          <el-select v-model="form.role" class="w-full">
            <el-option label="网格员" value="GRID_WORKER" />
            <el-option label="社区医生" value="COMMUNITY_DOCTOR" />
            <el-option label="物业" value="PROPERTY" />
            <el-option label="志愿者" value="VOLUNTEER" />
          </el-select>
        </el-form-item>
        <el-form-item label="片区" required>
          <el-input v-model="form.district" />
        </el-form-item>
        <el-form-item label="在岗状态">
          <el-switch
            v-model="form.onDuty"
            active-text="在岗"
            inactive-text="离岗"
          />
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
import { usersApi } from '@/api';
import type { UserRecord } from '@/api/users';

const users = ref<UserRecord[]>([]);
const loading = ref(false);
const dialogVisible = ref(false);
const editingUser = ref<UserRecord | null>(null);
const filters = reactive({ role: '' });
const form = reactive({
  name: '',
  phone: '',
  role: 'GRID_WORKER',
  district: '',
  onDuty: true,
});

const roleMap: Record<string, string> = {
  GRID_WORKER: '网格员',
  COMMUNITY_DOCTOR: '医生',
  PROPERTY: '物业',
  VOLUNTEER: '志愿者',
  ADMIN: '管理员',
  FAMILY: '家属',
};

function roleLabel(role: string) {
  return roleMap[role] || role;
}

function load() {
  loading.value = true;
  usersApi
    .list(filters.role ? { role: filters.role } : {})
    .then((res) => {
      users.value = res.data.data.items ?? [];
    })
    .finally(() => {
      loading.value = false;
    });
}

function openCreate() {
  editingUser.value = null;
  form.name = '';
  form.phone = '';
  form.role = 'GRID_WORKER';
  form.district = '';
  form.onDuty = true;
  dialogVisible.value = true;
}

function openEdit(row: UserRecord) {
  editingUser.value = row;
  form.name = row.name;
  form.phone = row.phone;
  form.role = row.role;
  form.district = row.district || '';
  form.onDuty = row.dutyStatus === 'ON_DUTY';
  dialogVisible.value = true;
}

async function handleSave() {
  const data = {
    name: form.name,
    phone: form.phone,
    role: form.role,
    skills: [] as string[],
    district: form.district,
    dutyStatus: form.onDuty ? 'ON_DUTY' : 'OFF_DUTY',
  };
  if (editingUser.value) {
    await usersApi.update(editingUser.value.id, data as any);
  } else {
    await usersApi.create(data as any);
  }
  ElMessage.success('保存成功');
  dialogVisible.value = false;
  load();
}

onMounted(() => {
  load();
});
</script>
