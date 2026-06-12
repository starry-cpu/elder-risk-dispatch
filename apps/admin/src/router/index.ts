import { createRouter, createWebHistory } from 'vue-router';
import type { RouteRecordRaw } from 'vue-router';

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/login/index.vue'),
    meta: { requiresAuth: false },
  },
  {
    path: '/',
    redirect: '/dashboard',
  },
  {
    path: '/dashboard',
    name: 'Dashboard',
    component: () => import('@/views/dashboard/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/elders',
    name: 'Elders',
    component: () => import('@/views/elders/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/elders/:id',
    name: 'ElderDetail',
    component: () => import('@/views/elders/[id].vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/risk',
    name: 'Risk',
    component: () => import('@/views/risk/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/work-orders',
    name: 'WorkOrders',
    component: () => import('@/views/work-orders/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/rules',
    name: 'Rules',
    component: () => import('@/views/rules/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/users',
    name: 'Users',
    component: () => import('@/views/users/index.vue'),
    meta: { requiresAuth: true },
  },
  {
    path: '/audit',
    name: 'Audit',
    component: () => import('@/views/audit/index.vue'),
    meta: { requiresAuth: true },
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
