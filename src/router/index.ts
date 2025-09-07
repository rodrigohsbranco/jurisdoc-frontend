import { createRouter, createWebHistory, type RouteRecordRaw } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const routes: RouteRecordRaw[] = [
  {
    path: '/login',
    name: 'login',
    component: () => import('../views/LoginView.vue'),
    meta: { public: true, title: 'Login' },
  },
  {
    path: '/',
    component: () => import('../layouts/MainLayout.vue'),
    children: [
      { path: '', name: 'dashboard', component: () => import('../views/DashboardView.vue'), meta: { title: 'Dashboard' } },
      { path: 'usuarios', name: 'usuarios', component: () => import('../views/UsersView.vue'), meta: { title: 'Usuários' } },
      { path: 'clientes', name: 'clientes', component: () => import('../views/ClientesView.vue'), meta: { title: 'Clientes' } },
      { path: 'clientes/:id/contas', name: 'contas', component: () => import('@/views/ContasView.vue'), meta: { title: 'Contas bancárias' } },
      { path: 'templates', name: 'templates', component: () => import('../views/TemplatesView.vue'), meta: { title: 'Templates' } },

      // { path: 'clientes', name: 'clientes', component: () => import('../views/ClientesView.vue'), meta: { title: 'Clientes' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL), // <- melhora para deploys em subpath
  routes,
  scrollBehavior () {
    return { top: 0 }
  },
})

router.beforeEach(to => {
  const auth = useAuthStore()

  // já logado e tentando ir para /login? manda pro destino ou dashboard
  if (to.name === 'login' && auth.isAuthenticated) {
    return { path: (to.query.redirect as string) || '/' }
  }

  // rotas públicas passam direto
  // eslint-disable-next-line curly
  if (to.meta.public) return true

  // demais rotas exigem login
  if (!auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
})

export default router
