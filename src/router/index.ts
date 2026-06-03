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
        meta: { title: 'Usuários', requiresCapability: 'pagina.usuarios' },
      },
      {
        path: 'clientes',
        name: 'clientes',
        component: () => import('../views/ClientesView.vue'),
        meta: { title: 'Clientes', requiresCapability: 'pagina.clientes' },
      },
      {
        path: 'clientes/:id/contas',
        name: 'contas',
        component: () => import('@/views/ContasView.vue'),
        meta: { title: 'Contas bancárias', requiresCapability: 'pagina.contas' },
      },
      {
        path: 'conta-reu',
        name: 'conta-reu',
        component: () => import('@/views/ContaReuView.vue'),
        meta: { title: 'Bancos Réus', requiresCapability: 'pagina.conta_reu' },
      },
      {
        path: 'templates',
        name: 'templates',
        component: () => import('../views/TemplatesView.vue'),
        meta: { title: 'Templates', requiresCapability: 'pagina.templates' },
      },
      {
        path: 'peticoes',
        name: 'peticoes',
        component: () => import('../views/PetitionsView.vue'),
        meta: { title: 'Petições', requiresCapability: 'pagina.peticoes' },
      },
      {
        path: 'contratos',
        name: 'contratos',
        component: () => import('../views/ContratosView.vue'),
        meta: { title: 'Contratos', requiresCapability: 'pagina.contratos' },
      },
      {
        path: 'producao-kits',
        name: 'producao-kits',
        component: () => import('../views/ProducaoKitsView.vue'),
        meta: { title: 'Produção de Kits', requiresCapability: 'pagina.kits' },
      },
      {
        path: 'producao-kits/novo',
        name: 'producao-kits-novo',
        component: () => import('../views/NovoKitView.vue'),
        meta: { title: 'Novo Kit', requiresCapability: 'pagina.kits' },
      },
      {
        path: 'producao-kits/:id',
        name: 'producao-kits-editar',
        component: () => import('../views/NovoKitView.vue'),
        meta: { title: 'Editar Kit', requiresCapability: 'pagina.kits' },
      },
      {
        path: 'bancos-tarifas',
        name: 'bancos-tarifas',
        component: () => import('../views/BancosTarifasView.vue'),
        meta: { title: 'Bancos e Tarifas', requiresCapability: 'pagina.bancos_tarifas' },
      },
      {
        path: 'advogados',
        name: 'advogados',
        component: () => import('../views/AdvogadosView.vue'),
        meta: { title: 'Advogados', requiresCapability: 'pagina.advogados' },
      },
      {
        path: 'relatorios',
        name: 'reports',
        component: () => import('../views/ReportsView.vue'),
        meta: { title: 'Relatórios', requiresCapability: 'pagina.relatorios' },
      },
      {
        path: 'permissoes',
        name: 'permissoes',
        component: () => import('../views/PermissoesView.vue'),
        meta: { title: 'Permissões', requiresCapability: 'pagina.permissoes' },
      },
      {
        path: 'clausula-porcentagem',
        name: 'clausula-porcentagem',
        component: () => import('../views/ClausulaPorcentagemView.vue'),
        meta: { title: 'Cláusula por UF', requiresAdmin: true },
      },
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

  // rotas que exigem is_admin estrito (sem capacidades)
  if (to.meta?.requiresAdmin && !auth.isAdmin) {
    return { path: '/' }
  }

  // rotas gateadas por capacidade (admin sempre passa via auth.can())
  const requiredCap = to.meta?.requiresCapability as string | undefined
  if (requiredCap && !auth.can(requiredCap)) {
    return { path: '/' }
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
