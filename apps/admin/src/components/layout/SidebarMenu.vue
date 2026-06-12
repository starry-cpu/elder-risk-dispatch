<template>
  <el-menu
    :default-active="activeMenu"
    router
    class="h-full border-r-0"
    background-color="#001529"
    text-color="#ffffffb3"
    active-text-color="#fff"
  >
    <el-menu-item index="/dashboard">
      <el-icon><DataAnalysis /></el-icon>
      <span>驾驶舱</span>
    </el-menu-item>
    <el-menu-item index="/elders">
      <el-icon><User /></el-icon>
      <span>老人档案</span>
    </el-menu-item>
    <el-menu-item index="/risk">
      <el-icon><Warning /></el-icon>
      <span>预警中心</span>
    </el-menu-item>
    <el-menu-item index="/work-orders">
      <el-icon><Document /></el-icon>
      <span>工单管理</span>
    </el-menu-item>
    <el-menu-item index="/rules">
      <el-icon><Setting /></el-icon>
      <span>规则配置</span>
    </el-menu-item>
    <el-menu-item index="/users">
      <el-icon><Avatar /></el-icon>
      <span>人员排班</span>
    </el-menu-item>
    <el-menu-item index="/audit">
      <el-icon><Clock /></el-icon>
      <span>审计日志</span>
    </el-menu-item>
  </el-menu>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import { useRoute } from 'vue-router';
import {
  DataAnalysis, User, Warning, Document, Setting, Avatar, Clock,
} from '@element-plus/icons-vue';

const route = useRoute();
const activeMenu = computed(() => route.path);
</script>
