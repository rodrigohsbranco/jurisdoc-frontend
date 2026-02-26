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
      {
        path: '',
        name: 'dashboard',
        component: () => import('../views/DashboardView.vue'),
        meta: { title: 'Dashboard' },
      },
      {
        path: 'usuarios',
        name: 'usuarios',
        component: () => import('../views/UsersView.vue'),
        meta: { title: 'Usuários' },
      },
      {
        path: 'clientes',
        name: 'clientes',
        component: () => import('../views/ClientesView.vue'),
        meta: { title: 'Clientes' },
      },
      {
        path: 'clientes/:id/contas',
        name: 'contas',
        component: () => import('@/views/ContasView.vue'),
        meta: { title: 'Contas bancárias' },
      },
      {
        path: 'conta-reu',
        name: 'conta-reu',
        component: () => import('@/views/ContaReuView.vue'),
        meta: { title: 'Bancos Réus' },
      },
      {
        path: 'templates',
        name: 'templates',
        component: () => import('../views/TemplatesView.vue'),
        meta: { title: 'Templates' },
      },
      {
        path: 'peticoes',
        name: 'peticoes',
        component: () => import('../views/PetitionsView.vue'),
        meta: { title: 'Petições' },
      },
      {
        path: 'contratos',
        name: 'contratos',
        component: () => import('../views/ContratosView.vue'),
        meta: { title: 'Contratos' },
      },
      { path: 'relatorios', name: 'reports', component: () => import('../views/ReportsView.vue'), meta: { title: 'Relatórios' } },
    ],
  },
  { path: '/:pathMatch(.*)*', redirect: '/' },
]

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes,
  scrollBehavior () {
    return { top: 0 }
  },
})

router.beforeEach(async to => {
  const auth = useAuthStore()

  // Aguarda o bootstrap após F5 (se ainda não tiver acontecido)
  if (!auth.initialized) {
    try {
      await auth.bootstrap()
    } catch {
      // silencioso
    }
  }

  // já logado e tentando ir para /login? manda pro destino ou dashboard
  if (to.name === 'login' && auth.isAuthenticated) {
    return { path: (to.query.redirect as string) || '/' }
  }

  // rotas públicas passam direto
  if (to.meta?.public) {
    return true
  }

  // demais rotas exigem login
  if (!auth.isAuthenticated) {
    return { path: '/login', query: { redirect: to.fullPath } }
  }
  return true
})

// (opcional) título da página
router.afterEach(to => {
  const base = 'Seu Sistema' // ajuste se quiser
  const title = (to.meta?.title as string) || ''
  document.title = title ? `${title} · ${base}` : base
})

export default router
