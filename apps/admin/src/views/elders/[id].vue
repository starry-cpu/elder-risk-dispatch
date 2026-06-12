<template>
  <div class="space-y-4" v-loading="loading">
    <el-page-header @back="$router.back()">
      <template #content>
        {{ elder?.name || '老人详情' }}
      </template>
    </el-page-header>
    <ElderDetailDrawer
      :visible="true"
      :elder="elder"
      @update:visible="$router.back()"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import { useElderStore } from '@/stores/elders';
import ElderDetailDrawer from '@/components/elders/ElderDetailDrawer.vue';

const route = useRoute();
const store = useElderStore();
const loading = ref(false);
const elder = store.currentElder;

onMounted(async () => {
  loading.value = true;
  await store.fetchDetail(route.params.id as string);
  loading.value = false;
});
</script>
