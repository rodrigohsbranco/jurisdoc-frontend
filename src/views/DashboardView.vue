<script setup lang="ts">
  import { computed, onMounted } from 'vue'
  import { useClientesStore } from '@/stores/clientes'
  import { usePeticoesStore } from '@/stores/peticoes'
  import { useTemplatesStore } from '@/stores/templates'

  // ---------- stores ----------
  const clientes = useClientesStore()
  const peticoes = usePeticoesStore()
  const templates = useTemplatesStore()

  // ---------- carregar dados ----------
  async function loadDashboard () {
    // Clientes: últimos cadastrados (e já nos dá count)
    await clientes.fetchList({ page: 1, page_size: 5, ordering: '-criado_em' })

    // Petições: últimas criadas (e já nos dá count)
    await peticoes.fetch({ page: 1, page_size: 5, ordering: '-created_at' })

    // Templates: só precisamos da contagem
    // (seu store de templates já existia; usamos page_size=1 p/ economizar)
    await templates.fetch({ page: 1, page_size: 1 })
  }
  onMounted(loadDashboard)

  // ---------- KPIs (valores reais) ----------
  const kpis = computed(() => {
    const list = [
      {
        label: 'Clientes',
        value: clientes.count || 0,
        icon: 'mdi-account-group',
        color: 'primary',
      },
      {
        label: 'Petições',
        value: peticoes.count || 0,
        icon: 'mdi-file-document',
        color: 'secondary',
      },
      {
        label: 'Templates',
        // alguns stores não expõem count; caímos no length como fallback
        value: (templates as any).count ?? templates.items.length ?? 0,
        icon: 'mdi-file-word',
        color: 'indigo',
      },
    // {
    //   label: 'Pendências',
    //   value: 0,
    //   icon: 'mdi-alert-circle',
    //   color: 'warning',
    // },
    ]
    return list
  })

  // ---------- ações rápidas ----------
  const quickActions = [
    {
      label: 'Novo Cliente',
      icon: 'mdi-account-plus',
      color: 'primary',
      to: { name: 'clientes' },
    },
    {
      label: 'Nova Petição',
      icon: 'mdi-file-plus',
      color: 'secondary',
      to: { name: 'peticoes' },
    },
    {
      label: 'Novo Template',
      icon: 'mdi-file-word',
      color: 'indigo',
      to: { name: 'templates' },
    },
    { label: 'Relatórios', icon: 'mdi-chart-bar', color: 'success' },
  ]

  // ---------- helpers ----------
  function rt (dateIso?: string | null) {
    if (!dateIso) return ''
    const d = new Date(dateIso)
    if (Number.isNaN(d.getTime())) return ''
    const diff = d.getTime() - Date.now()
    const abs = Math.abs(diff)
    const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })

    const sec = 1000
    const min = 60 * sec
    const hour = 60 * min
    const day = 24 * hour

    if (abs < 30 * sec) return 'agora'
    if (abs < hour) return rtf.format(Math.round(diff / min), 'minute')
    if (abs < day) return rtf.format(Math.round(diff / hour), 'hour')
    return rtf.format(Math.round(diff / day), 'day')
  }

  function clienteNome (clienteId?: number, fallback?: string | null) {
    const c = clientes.items.find(x => x.id === Number(clienteId))
    return c?.nome_completo || fallback || `#${clienteId ?? ''}`
  }

  // ---------- atividade recente ----------
  type Activity = {
    icon: string
    title: string
    subtitle: string
    when: string // ISO
  }

  const recentActivities = computed<Activity[]>(() => {
    const events: Activity[] = []

    // Petições criadas
    for (const p of peticoes.items) {
      if (p.created_at) {
        events.push({
          icon: 'mdi-file-document',
          title: 'Petição criada',
          subtitle: `${clienteNome(p.cliente, p.cliente_nome || null)} — ${rt(
            p.created_at,
          )}`,
          when: p.created_at,
        })
      }
      // Petições atualizadas
      if (p.updated_at) {
        events.push({
          icon: 'mdi-pencil',
          title: 'Petição atualizada',
          subtitle: `${clienteNome(p.cliente, p.cliente_nome || null)} — ${rt(
            p.updated_at,
          )}`,
          when: p.updated_at,
        })
      }
    }

    // Novos clientes
    for (const c of clientes.items) {
      if (c.criado_em) {
        events.push({
          icon: 'mdi-account-plus',
          title: 'Novo cliente',
          subtitle: `${c.nome_completo} — ${rt(c.criado_em)}`,
          when: c.criado_em,
        })
      }
    }

    // Ordena por data desc e limita
    return events
      .sort((a, b) => new Date(b.when).getTime() - new Date(a.when).getTime())
      .slice(0, 8)
  })
</script>

<template>
  <v-container fluid>
    <!-- KPIs -->
    <v-row class="mb-4" dense>
      <v-col
        v-for="k in kpis"
        :key="k.label"
        cols="12"
        md="4"
        sm="6"
      >
        <v-card
          class="text-white rounded-xl"
          :color="k.color"
          elevation="2"
          variant="flat"
        >
          <v-card-item>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption opacity-80">{{ k.label }}</div>
                <div class="text-h5 font-weight-bold">{{ k.value }}</div>
              </div>
              <v-avatar class="bg-white bg-opacity-20" size="40">
                <v-icon color="white" :icon="k.icon" size="26" />
              </v-avatar>
            </div>
          </v-card-item>
        </v-card>
      </v-col>
    </v-row>

    <v-row dense>
      <!-- Ações rápidas -->
      <v-col cols="12" md="8">
        <v-card class="rounded-xl" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-flash" /> Ações rápidas
          </v-card-title>
          <v-card-text>
            <v-row dense>
              <v-col
                v-for="a in quickActions"
                :key="a.label"
                cols="12"
                md="6"
                sm="6"
              >
                <v-btn
                  block
                  class="text-none py-6"
                  :color="a.color"
                  size="large"
                  :to="a.to"
                  variant="tonal"
                >
                  <v-icon :icon="a.icon" start /> {{ a.label }}
                </v-btn>
              </v-col>
            </v-row>
          </v-card-text>
        </v-card>
      </v-col>

      <!-- Atividade recente -->
      <v-col cols="12" md="4">
        <v-card class="rounded-xl" elevation="2">
          <v-card-title class="d-flex align-center">
            <v-icon class="mr-2" icon="mdi-history" /> Atividade recente
          </v-card-title>
          <v-divider />
          <v-list v-if="recentActivities.length > 0">
            <v-list-item
              v-for="(ev, i) in recentActivities"
              :key="i"
              :subtitle="ev.subtitle"
              :title="ev.title"
            >
              <template #prepend>
                <v-avatar
                  class="mr-2"
                  color="primary"
                  size="28"
                  variant="tonal"
                >
                  <v-icon :icon="ev.icon" size="18" />
                </v-avatar>
              </template>
            </v-list-item>
          </v-list>
          <v-sheet v-else class="pa-6 text-center text-medium-emphasis">
            Sem atividade recente.
          </v-sheet>
        </v-card>
      </v-col>
    </v-row>
  </v-container>
</template>
