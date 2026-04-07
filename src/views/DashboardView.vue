<script setup lang="ts">
  import { computed, onMounted, ref } from 'vue'
  import { useRouter } from 'vue-router'
  import { useAuthStore } from '@/stores/auth'
  import { useClientesStore } from '@/stores/clientes'
  import { usePeticoesStore } from '@/stores/peticoes'
  import { useTemplatesStore } from '@/stores/templates'
  import { useContratosStore } from '@/stores/contratos'
  import { useRelatoriosStore } from '@/stores/relatorios'

  const router = useRouter()
  const auth = useAuthStore()
  const clientes = useClientesStore()
  const peticoes = usePeticoesStore()
  const templates = useTemplatesStore()
  const contratos = useContratosStore()
  const relatorios = useRelatoriosStore()

  const dashLoading = ref(true)

  const greeting = computed(() => {
    const h = new Date().getHours()
    if (h < 12) return 'Bom dia'
    if (h < 18) return 'Boa tarde'
    return 'Boa noite'
  })

  const todayFormatted = computed(() =>
    new Date().toLocaleDateString('pt-BR', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }),
  )

  // Last 30 days range for timeseries
  function getDateRange () {
    const to = new Date()
    const from = new Date()
    from.setDate(from.getDate() - 29)
    return {
      date_from: from.toISOString().slice(0, 10),
      date_to: to.toISOString().slice(0, 10),
    }
  }

  async function loadDashboard () {
    dashLoading.value = true
    const range = getDateRange()
    await Promise.allSettled([
      clientes.fetchList({ ordering: '-criado_em' }),
      peticoes.fetch({ ordering: '-created_at' }),
      templates.fetchAll().then(all => { templates.items = all }),
      contratos.fetchList({ ordering: '-criado_em' }),
      relatorios.fetchDataQuality(),
      relatorios.fetchTemplatesUsage({ top: 5 }),
      relatorios.fetchTimeSeries({ bucket: 'day', ...range }),
    ])
    dashLoading.value = false
  }
  onMounted(loadDashboard)

  // ─── Sparkline data from timeseries ───
  const sparkClientes = computed(() =>
    relatorios.timeseries?.series.map(s => s.clientes) || [],
  )
  const sparkPeticoes = computed(() =>
    relatorios.timeseries?.series.map(s => s.peticoes_criadas) || [],
  )

  // ─── KPIs ───
  const kpis = computed(() => [
    {
      label: 'Clientes',
      value: clientes.items.length,
      icon: 'mdi-account-group-outline',
      color: '#0F2B46',
      bg: 'rgba(15, 43, 70, 0.08)',
      spark: sparkClientes.value,
      sparkColor: '#0F2B46',
      to: { name: 'clientes' },
    },
    {
      label: 'Petições',
      value: peticoes.items.length,
      icon: 'mdi-file-document-outline',
      color: '#CDA660',
      bg: 'rgba(205, 166, 96, 0.10)',
      spark: sparkPeticoes.value,
      sparkColor: '#CDA660',
      to: { name: 'peticoes' },
    },
    {
      label: 'Contratos',
      value: contratos.items.length,
      icon: 'mdi-file-sign',
      color: '#4CAF50',
      bg: 'rgba(76, 175, 80, 0.08)',
      spark: [],
      sparkColor: '#4CAF50',
      to: { name: 'contratos' },
    },
    {
      label: 'Templates',
      value: templates.items.length,
      icon: 'mdi-file-word-outline',
      color: '#2196F3',
      bg: 'rgba(33, 150, 243, 0.08)',
      spark: [],
      sparkColor: '#2196F3',
      to: { name: 'templates' },
    },
  ])

  // ─── Data quality ───
  const qualityMetrics = computed(() => {
    const dq = relatorios.dataQuality
    if (!dq || !dq.total_clientes) return []
    const t = dq.total_clientes
    const comCpf = t - dq.sem_cpf
    const comEnd = t - dq.sem_endereco
    const comConta = dq.com_conta_principal
    return [
      { label: 'CPF', value: comCpf, total: t, pct: Math.round((comCpf / t) * 100), color: comCpf / t > 0.85 ? '#4CAF50' : '#FF9800', icon: 'mdi-card-account-details-outline' },
      { label: 'Endereço', value: comEnd, total: t, pct: Math.round((comEnd / t) * 100), color: comEnd / t > 0.85 ? '#4CAF50' : '#FF9800', icon: 'mdi-map-marker-check-outline' },
      { label: 'Conta bancária', value: comConta, total: t, pct: Math.round((comConta / t) * 100), color: comConta / t > 0.85 ? '#4CAF50' : '#FF9800', icon: 'mdi-bank-check' },
    ]
  })

  const overallQuality = computed(() => {
    if (!qualityMetrics.value.length) return 0
    const avg = qualityMetrics.value.reduce((s, m) => s + m.pct, 0) / qualityMetrics.value.length
    return Math.round(avg)
  })

  // ─── Top templates ───
  const topTemplates = computed(() => {
    const items = relatorios.templatesUsage
    if (!items.length) return []
    const max = items[0]?.count || 1
    return items.map(t => ({
      ...t,
      pct: Math.round((t.count / max) * 100),
    }))
  })

  // ─── Recent documents (petitions + contracts merged) ───
  type RecentDoc = {
    id: number
    type: 'petition' | 'contract'
    typeLabel: string
    typeColor: string
    typeIcon: string
    client: string
    template: string
    date: string
    dateRaw: string
  }

  function formatDate (iso?: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' })
  }

  function formatDateTime (iso?: string | null) {
    if (!iso) return '—'
    const d = new Date(iso)
    if (Number.isNaN(d.getTime())) return '—'
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' }) + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  }

  const recentDocs = computed<RecentDoc[]>(() => {
    const docs: RecentDoc[] = []

    for (const p of peticoes.items) {
      const c = clientes.items.find(x => x.id === p.cliente)
      docs.push({
        id: p.id,
        type: 'petition',
        typeLabel: 'Petição',
        typeColor: 'secondary',
        typeIcon: 'mdi-file-document-outline',
        client: c?.nome_completo || p.cliente_nome || `#${p.cliente}`,
        template: (templates.items.find(t => t.id === p.template) as any)?.name || `Template #${p.template}`,
        date: formatDate(p.created_at),
        dateRaw: p.created_at || '',
      })
    }

    for (const ct of contratos.items) {
      const c = clientes.items.find(x => x.id === ct.cliente)
      docs.push({
        id: ct.id,
        type: 'contract',
        typeLabel: 'Contrato',
        typeColor: 'success',
        typeIcon: 'mdi-file-sign',
        client: c?.nome_completo || ct.cliente_nome || `#${ct.cliente}`,
        template: ct.template_nome || `Template #${ct.template}`,
        date: formatDate(ct.criado_em),
        dateRaw: ct.criado_em || '',
      })
    }

    return docs
      .sort((a, b) => new Date(b.dateRaw).getTime() - new Date(a.dateRaw).getTime())
      .slice(0, 7)
  })

  // ─── Activity timeline ───
  type TimelineEvent = {
    icon: string
    title: string
    subtitle: string
    time: string
    dotColor: string
    dateRaw: string
  }

  function relativeTime (dateIso?: string | null) {
    if (!dateIso) return ''
    const d = new Date(dateIso)
    if (Number.isNaN(d.getTime())) return ''
    const diff = d.getTime() - Date.now()
    const abs = Math.abs(diff)
    const rtf = new Intl.RelativeTimeFormat('pt-BR', { numeric: 'auto' })
    const min = 60000
    const hour = 3600000
    const day = 86400000
    if (abs < 30000) return 'agora'
    if (abs < hour) return rtf.format(Math.round(diff / min), 'minute')
    if (abs < day) return rtf.format(Math.round(diff / hour), 'hour')
    if (abs < 7 * day) return rtf.format(Math.round(diff / day), 'day')
    return formatDateTime(dateIso)
  }

  const timeline = computed<TimelineEvent[]>(() => {
    const events: TimelineEvent[] = []

    for (const p of peticoes.items) {
      if (p.created_at) {
        const c = clientes.items.find(x => x.id === p.cliente)
        events.push({
          icon: 'mdi-file-document-plus-outline',
          title: 'Petição criada',
          subtitle: c?.nome_completo || p.cliente_nome || '',
          time: relativeTime(p.created_at),
          dotColor: '#CDA660',
          dateRaw: p.created_at,
        })
      }
    }

    for (const c of clientes.items) {
      if (c.criado_em) {
        events.push({
          icon: 'mdi-account-plus-outline',
          title: 'Cliente cadastrado',
          subtitle: c.nome_completo,
          time: relativeTime(c.criado_em),
          dotColor: '#0F2B46',
          dateRaw: c.criado_em,
        })
      }
    }

    for (const ct of contratos.items) {
      if (ct.criado_em) {
        const c = clientes.items.find(x => x.id === ct.cliente)
        events.push({
          icon: 'mdi-file-sign',
          title: 'Contrato registrado',
          subtitle: c?.nome_completo || ct.cliente_nome || '',
          time: relativeTime(ct.criado_em),
          dotColor: '#4CAF50',
          dateRaw: ct.criado_em,
        })
      }
    }

    return events
      .sort((a, b) => new Date(b.dateRaw).getTime() - new Date(a.dateRaw).getTime())
      .slice(0, 8)
  })

  // ─── Quick actions ───
  const quickActions = [
    { label: 'Novo Cliente', desc: 'Cadastrar pessoa física', icon: 'mdi-account-plus-outline', color: 'primary', to: { name: 'clientes' } },
    { label: 'Nova Petição', desc: 'Gerar documento jurídico', icon: 'mdi-file-document-plus-outline', color: 'secondary', to: { name: 'peticoes' } },
    { label: 'Novo Contrato', desc: 'Registrar contrato', icon: 'mdi-file-sign', color: 'success', to: { name: 'contratos' } },
    { label: 'Novo Template', desc: 'Enviar modelo .docx', icon: 'mdi-file-word-outline', color: 'info', to: { name: 'templates' } },
  ]
</script>

<template>
  <v-container class="dashboard" fluid>
    <!-- ━━━ Loading overlay ━━━ -->
    <div v-if="dashLoading" class="d-flex justify-center align-center" style="min-height: 400px">
      <div class="text-center">
        <v-progress-circular color="primary" indeterminate size="48" width="4" />
        <div class="text-body-2 text-medium-emphasis mt-4">Carregando dashboard...</div>
      </div>
    </div>

    <template v-else>
      <!-- ━━━ Welcome banner ━━━ -->
      <v-card class="welcome-card mb-6" variant="flat">
        <v-card-text class="d-flex align-center flex-wrap pa-6">
          <div class="flex-grow-1">
            <div class="text-h5 font-weight-bold text-white mb-1">
              {{ greeting }}, {{ auth.username }}
            </div>
            <div class="text-body-2" style="color: rgba(255,255,255,0.7)">
              {{ todayFormatted }}
            </div>
          </div>
          <div class="d-flex ga-2 flex-wrap">
            <v-btn
              v-for="qa in quickActions"
              :key="qa.label"
              class="text-none"
              :color="qa.color"
              :prepend-icon="qa.icon"
              size="small"
              :to="qa.to"
              variant="flat"
            >
              {{ qa.label }}
            </v-btn>
          </div>
        </v-card-text>
      </v-card>

      <!-- ━━━ KPI Cards ━━━ -->
      <v-row class="mb-2">
        <v-col
          v-for="k in kpis"
          :key="k.label"
          cols="12"
          lg="3"
          sm="6"
        >
          <v-card class="kpi-card" :to="k.to">
            <v-card-text class="pa-5">
              <div class="d-flex align-center mb-3">
                <div
                  class="kpi-icon-wrap d-flex align-center justify-center rounded-lg"
                  :style="{ background: k.bg }"
                >
                  <v-icon :color="k.color" :icon="k.icon" size="22" />
                </div>
                <v-spacer />
                <v-sparkline
                  v-if="k.spark.length > 1"
                  auto-draw
                  :auto-draw-duration="800"
                  :color="k.sparkColor"
                  :fill="false"
                  :line-width="2"
                  :model-value="k.spark"
                  padding="4"
                  :smooth="6"
                  style="max-width: 90px; max-height: 36px"
                />
              </div>
              <div class="text-h4 font-weight-bold" :style="{ color: k.color }">{{ k.value }}</div>
              <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing: 0.06em">
                {{ k.label }}
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- ━━━ Main content ━━━ -->
      <v-row>
        <!-- LEFT COLUMN -->
        <v-col cols="12" lg="8">
          <!-- Recent documents table -->
          <v-card class="mb-4">
            <v-card-title class="section-header">
              <v-icon class="mr-2" color="secondary" icon="mdi-file-clock-outline" size="20" />
              Documentos recentes
              <v-spacer />
              <v-btn
                class="text-none"
                color="primary"
                size="small"
                variant="text"
                @click="router.push({ name: 'peticoes' })"
              >
                Ver todos
              </v-btn>
            </v-card-title>
            <v-divider />

            <v-table v-if="recentDocs.length" class="recent-docs-table" density="comfortable" hover>
              <thead>
                <tr>
                  <th>Tipo</th>
                  <th>Cliente</th>
                  <th>Template</th>
                  <th class="text-right">Data</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="doc in recentDocs" :key="`${doc.type}-${doc.id}`">
                  <td>
                    <v-chip
                      :color="doc.typeColor"
                      :prepend-icon="doc.typeIcon"
                      size="small"
                      variant="tonal"
                    >
                      {{ doc.typeLabel }}
                    </v-chip>
                  </td>
                  <td class="text-body-2">{{ doc.client }}</td>
                  <td class="text-body-2 text-medium-emphasis text-truncate" style="max-width: 200px">{{ doc.template }}</td>
                  <td class="text-body-2 text-medium-emphasis text-right">{{ doc.date }}</td>
                </tr>
              </tbody>
            </v-table>

            <div v-else class="pa-8 text-center text-medium-emphasis">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-file-outline" size="36" />
              <div class="text-body-2">Nenhum documento encontrado</div>
            </div>
          </v-card>

          <!-- Top templates + Data quality side by side -->
          <v-row>
            <!-- Top templates -->
            <v-col cols="12" md="7">
              <v-card class="fill-height">
                <v-card-title class="section-header">
                  <v-icon class="mr-2" color="secondary" icon="mdi-trophy-outline" size="20" />
                  Templates mais usados
                </v-card-title>
                <v-divider />
                <v-card-text v-if="topTemplates.length" class="pt-4">
                  <div
                    v-for="(t, i) in topTemplates"
                    :key="t.template_id"
                    class="mb-4"
                    :class="{ 'mb-0': i === topTemplates.length - 1 }"
                  >
                    <div class="d-flex align-center mb-1">
                      <span
                        class="rank-badge d-flex align-center justify-center mr-2 rounded font-weight-bold"
                        :class="i === 0 ? 'rank-gold' : 'rank-default'"
                      >
                        {{ i + 1 }}
                      </span>
                      <span class="text-body-2 text-truncate" style="max-width: 220px" :title="t.template">
                        {{ t.template }}
                      </span>
                      <v-spacer />
                      <span class="text-body-2 font-weight-bold">{{ t.count }}</span>
                    </div>
                    <v-progress-linear
                      :color="i === 0 ? 'secondary' : 'primary'"
                      height="8"
                      :model-value="t.pct"
                      rounded
                    />
                  </div>
                </v-card-text>
                <div v-else class="pa-6 text-center text-medium-emphasis">
                  <div class="text-body-2">Sem dados de uso</div>
                </div>
              </v-card>
            </v-col>

            <!-- Data quality -->
            <v-col cols="12" md="5">
              <v-card class="fill-height">
                <v-card-title class="section-header">
                  <v-icon class="mr-2" color="secondary" icon="mdi-shield-check-outline" size="20" />
                  Qualidade dos dados
                </v-card-title>
                <v-divider />
                <v-card-text v-if="qualityMetrics.length" class="d-flex flex-column align-center pt-5">
                  <!-- Overall gauge -->
                  <v-progress-circular
                    :color="overallQuality > 85 ? '#4CAF50' : overallQuality > 70 ? '#FF9800' : '#F44336'"
                    :model-value="overallQuality"
                    :size="100"
                    :width="8"
                  >
                    <div class="text-center">
                      <div class="text-h5 font-weight-bold">{{ overallQuality }}%</div>
                      <div class="text-caption text-medium-emphasis" style="font-size: 0.6rem !important">GERAL</div>
                    </div>
                  </v-progress-circular>

                  <div class="mt-5 w-100">
                    <div
                      v-for="m in qualityMetrics"
                      :key="m.label"
                      class="d-flex align-center py-2"
                    >
                      <v-icon class="mr-2" :color="m.color" :icon="m.icon" size="18" />
                      <span class="text-body-2 flex-grow-1">{{ m.label }}</span>
                      <v-chip :color="m.color" size="x-small" variant="tonal">
                        {{ m.pct }}%
                      </v-chip>
                    </div>
                  </div>
                </v-card-text>
                <div v-else class="pa-6 text-center text-medium-emphasis">
                  <div class="text-body-2">Sem dados</div>
                </div>
              </v-card>
            </v-col>
          </v-row>
        </v-col>

        <!-- RIGHT COLUMN - Timeline -->
        <v-col cols="12" lg="4">
          <v-card class="fill-height">
            <v-card-title class="section-header">
              <v-icon class="mr-2" color="secondary" icon="mdi-timeline-clock-outline" size="20" />
              Linha do tempo
            </v-card-title>
            <v-divider />

            <v-card-text v-if="timeline.length" class="pt-4 pb-2 timeline-container">
              <v-timeline align="start" density="compact" side="end">
                <v-timeline-item
                  v-for="(ev, i) in timeline"
                  :key="i"
                  :dot-color="ev.dotColor"
                  size="x-small"
                >
                  <div class="mb-4">
                    <div class="d-flex align-center">
                      <v-icon class="mr-1" :color="ev.dotColor" :icon="ev.icon" size="14" />
                      <span class="text-body-2 font-weight-medium">{{ ev.title }}</span>
                    </div>
                    <div class="text-caption text-medium-emphasis text-truncate" style="max-width: 200px">
                      {{ ev.subtitle }}
                    </div>
                    <div class="text-caption" style="color: #CDA660">{{ ev.time }}</div>
                  </div>
                </v-timeline-item>
              </v-timeline>
            </v-card-text>

            <div v-else class="pa-8 text-center text-medium-emphasis">
              <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-timeline-outline" size="36" />
              <div class="text-body-2">Sem atividade recente</div>
            </div>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<style scoped>
/* Welcome banner */
.welcome-card {
  background: linear-gradient(135deg, #0F2B46 0%, #1a3d5c 50%, #0F2B46 100%) !important;
  border-radius: 16px !important;
}

/* KPI cards */
.kpi-card {
  transition: transform 0.2s ease, box-shadow 0.2s ease;
  cursor: pointer;
  border: 1px solid rgba(0, 0, 0, 0.04);
}
.kpi-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 12px 28px rgba(0, 0, 0, 0.1) !important;
}
.kpi-icon-wrap {
  width: 42px;
  height: 42px;
}

/* Section headers */
.section-header {
  display: flex;
  align-items: center;
  padding: 16px 20px 12px !important;
  font-size: 0.875rem !important;
  font-weight: 600 !important;
}

/* Rank badges */
.rank-badge {
  width: 22px;
  height: 22px;
  font-size: 0.7rem;
  flex-shrink: 0;
}
.rank-gold {
  background: rgba(205, 166, 96, 0.15);
  color: #CDA660;
}
.rank-default {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.5);
}

/* Table */
.recent-docs-table th {
  font-size: 0.75rem !important;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: rgba(0, 0, 0, 0.5) !important;
}

/* Timeline */
.timeline-container {
  max-height: 520px;
  overflow-y: auto;
}
.timeline-container::-webkit-scrollbar {
  width: 4px;
}
.timeline-container::-webkit-scrollbar-thumb {
  background: rgba(0, 0, 0, 0.12);
  border-radius: 4px;
}

/* Fill height utility */
.fill-height {
  height: 100%;
}
</style>
