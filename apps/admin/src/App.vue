<template>
  <AppLayout v-if="authStore.isAuthenticated" />
  <router-view v-else />
</template>

<script setup lang="ts">
import { useAuthStore } from '@/stores/auth';
import AppLayout from '@/components/layout/AppLayout.vue';

const authStore = useAuthStore();
</script>
