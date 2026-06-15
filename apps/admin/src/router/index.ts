import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { requiresAuth: false, title: '登录' },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/index.vue'),
    meta: { requiresAuth: true, title: '驾驶舱' },
  },
  {
    path: '/elders',
    name: 'Elders',
    component: () => import('@/views/elders/index.vue'),
    meta: { requiresAuth: true, title: '老人档案' },
  },
  {
    path: '/elders/:id',
    name: 'ElderDetail',
    component: () => import('@/views/elders/[id].vue'),
    meta: { requiresAuth: true, title: '老人详情' },
  },
  {
    path: '/risk',
    name: 'Risk',
    component: () => import('@/views/risk/index.vue'),
    meta: { requiresAuth: true, title: '预警中心' },
  },
  {
    path: '/work-orders',
    name: 'WorkOrders',
    component: () => import('@/views/work-orders/index.vue'),
    meta: { requiresAuth: true, title: '工单管理' },
  },
  {
    path: '/rules',
    name: 'Rules',
    component: () => import('@/views/rules/index.vue'),
    meta: { requiresAuth: true, title: '规则配置' },
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/users/index.vue'),
    meta: { requiresAuth: true, title: '人员排班' },
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('@/views/audit/index.vue'),
    meta: { requiresAuth: true, title: '审计日志' },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token');
  if (to.meta.requiresAuth !== false && !token) {
    next('/login');
  } else if (to.path === '/login' && token) {
    next('/dashboard');
  } else {
    next();
  }
});

export default router;
