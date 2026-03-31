<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { type Bucket, useRelatoriosStore } from '@/stores/relatorios'
  import { useTemplatesStore } from '@/stores/templates'
  import { useSnackbar } from '@/composables/useSnackbar'

  const rel = useRelatoriosStore()
  const templates = useTemplatesStore()
  const { showSuccess, showError } = useSnackbar()

  // ─── Filtros ───
  const filters = reactive<{
    bucket: Bucket
    date_from: string
    date_to: string
  }>({
    bucket: 'day',
    date_from: '',
    date_to: '',
  })

  function setDefaultRange () {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 30)
    filters.date_to = to.toISOString().slice(0, 10)
    filters.date_from = from.toISOString().slice(0, 10)
  }
  setDefaultRange()

  const bucketItems = [
    { title: 'Diário', value: 'day' },
    { title: 'Semanal', value: 'week' },
    { title: 'Mensal', value: 'month' },
  ]

  // ─── Carregamento ───
  const initialLoading = ref(true)

  async function fetchAll () {
    await Promise.allSettled([
      rel.fetchTimeSeries(filters),
      rel.fetchTemplatesUsage({
        top: 10,
        date_from: filters.date_from,
        date_to: filters.date_to,
      }),
      rel.fetchDataQuality(),
      templates.fetch({ active: true }),
    ])
    initialLoading.value = false
  }
  onMounted(fetchAll)

  async function doRefresh () {
    await fetchAll()
    exportForm.date_from = filters.date_from
    exportForm.date_to = filters.date_to
  }

  // ─── KPIs ───
  const totalClientes = computed(() =>
    (rel.timeseries?.series ?? []).reduce((acc, p) => acc + (p.clientes || 0), 0),
  )
  const totalPeticoesCriadas = computed(() =>
    (rel.timeseries?.series ?? []).reduce((acc, p) => acc + (p.peticoes_criadas || 0), 0),
  )
  const totalPeticoesAtualizadas = computed(() =>
    (rel.timeseries?.series ?? []).reduce((acc, p) => acc + (p.peticoes_atualizadas || 0), 0),
  )

  const kpis = computed(() => [
    { label: 'Clientes', value: totalClientes.value, icon: 'mdi-account-group-outline', color: '#0F2B46', bg: 'rgba(15, 43, 70, 0.08)' },
    { label: 'Petições criadas', value: totalPeticoesCriadas.value, icon: 'mdi-file-document-plus-outline', color: '#CDA660', bg: 'rgba(205, 166, 96, 0.10)' },
    { label: 'Petições atualizadas', value: totalPeticoesAtualizadas.value, icon: 'mdi-file-edit-outline', color: '#2196F3', bg: 'rgba(33, 150, 243, 0.08)' },
  ])

  // ─── Bar chart data ───
  const chartSeries = computed(() => {
    const series = rel.timeseries?.series ?? []
    if (!series.length) return []
    const maxVal = Math.max(
      ...series.map(s => Math.max(s.clientes, s.peticoes_criadas, s.peticoes_atualizadas)),
      1,
    )
    return series.map(s => ({
      period: s.period,
      label: formatPeriodShort(s.period),
      clientes: s.clientes,
      criadas: s.peticoes_criadas,
      atualizadas: s.peticoes_atualizadas,
      total: s.clientes + s.peticoes_criadas + s.peticoes_atualizadas,
      hClientes: Math.max((s.clientes / maxVal) * 100, s.clientes > 0 ? 4 : 0),
      hCriadas: Math.max((s.peticoes_criadas / maxVal) * 100, s.peticoes_criadas > 0 ? 4 : 0),
      hAtualizadas: Math.max((s.peticoes_atualizadas / maxVal) * 100, s.peticoes_atualizadas > 0 ? 4 : 0),
    }))
  })

  // Show max ~15 bars, sample evenly if more
  const visibleBars = computed(() => {
    const all = chartSeries.value
    if (all.length <= 15) return all
    const step = Math.ceil(all.length / 15)
    return all.filter((_, i) => i % step === 0)
  })

  const hoveredBar = ref<number | null>(null)

  function formatPeriodShort (period: string) {
    if (!period) return ''
    if (period.length === 10) {
      const [, m, d] = period.split('-')
      return `${d}/${m}`
    }
    if (period.length === 7) {
      const [, m] = period.split('-')
      const months = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez']
      return months[parseInt(m, 10) - 1] || period
    }
    return period
  }

  function formatPeriodFull (period: string) {
    if (!period) return '—'
    if (period.length === 10) {
      const [y, m, d] = period.split('-')
      return `${d}/${m}/${y}`
    }
    return period
  }

  // ─── Templates ───
  const maxTemplateCount = computed(() =>
    Math.max(...(rel.templatesUsage?.map(x => x.count) ?? [0]), 1),
  )

  const topTemplates = computed(() =>
    (rel.templatesUsage ?? []).map(t => ({
      ...t,
      pct: Math.round((t.count / maxTemplateCount.value) * 100),
    })),
  )

  // ─── Qualidade ───
  const qualityMetrics = computed(() => {
    const dq = rel.dataQuality
    if (!dq || !dq.total_clientes) return []
    const t = dq.total_clientes
    const comCpf = t - dq.sem_cpf
    const comEnd = t - dq.sem_endereco
    const comConta = dq.com_conta_principal
    return [
      { label: 'Com CPF', value: comCpf, missing: dq.sem_cpf, total: t, pct: Math.round((comCpf / t) * 100), color: comCpf / t > 0.85 ? '#4CAF50' : '#FF9800', icon: 'mdi-card-account-details-outline' },
      { label: 'Endereço completo', value: comEnd, missing: dq.sem_endereco, total: t, pct: Math.round((comEnd / t) * 100), color: comEnd / t > 0.85 ? '#4CAF50' : '#FF9800', icon: 'mdi-map-marker-check-outline' },
      { label: 'Conta principal', value: comConta, missing: t - comConta, total: t, pct: Math.round((comConta / t) * 100), color: comConta / t > 0.85 ? '#4CAF50' : '#FF9800', icon: 'mdi-bank-check' },
    ]
  })

  const overallQuality = computed(() => {
    if (!qualityMetrics.value.length) return 0
    return Math.round(qualityMetrics.value.reduce((s, m) => s + m.pct, 0) / qualityMetrics.value.length)
  })

  // ─── Export ───
  const exportExpanded = ref(false)
  const exportForm = reactive<{
    date_from: string
    date_to: string
    template?: number | null
    clienteId?: number | null
  }>({
    date_from: filters.date_from,
    date_to: filters.date_to,
    template: undefined,
    clienteId: undefined,
  })

  function templateItems () {
    return templates.items.map(t => ({ title: t.name, value: Number(t.id) }))
  }

  async function doExport () {
    try {
      await rel.exportPetitionsCSV({
        date_from: exportForm.date_from || undefined,
        date_to: exportForm.date_to || undefined,
        template: exportForm.template || undefined,
        cliente: exportForm.clienteId || undefined,
      })
      showSuccess('Arquivo CSV exportado com sucesso!')
    } catch {
      showError('Erro ao exportar CSV.')
    }
  }

  const anyLoading = computed(() =>
    rel.loading.timeseries || rel.loading.templates || rel.loading.quality,
  )
</script>

<template>
  <v-container fluid>
    <!-- ━━━ Header ━━━ -->
    <div class="d-flex align-center flex-wrap ga-4 mb-6">
      <div class="flex-grow-1">
        <h1 class="text-h5 font-weight-bold text-primary">Relatórios</h1>
        <p class="text-body-2 text-medium-emphasis mt-1">Visão geral, análises e exportação de dados</p>
      </div>
      <v-btn
        class="text-none"
        color="primary"
        prepend-icon="mdi-download-outline"
        variant="tonal"
        @click="exportExpanded = !exportExpanded"
      >
        Exportar CSV
      </v-btn>
      <v-btn
        color="primary"
        icon="mdi-refresh"
        :loading="anyLoading"
        variant="text"
        @click="doRefresh"
      />
    </div>

    <!-- ━━━ Export panel (colapsável) ━━━ -->
    <v-expand-transition>
      <v-card v-show="exportExpanded" class="mb-4" variant="outlined">
        <v-card-text class="pa-4">
          <div class="d-flex align-center mb-3">
            <v-icon class="mr-2" color="primary" icon="mdi-file-export-outline" size="20" />
            <span class="text-body-2 font-weight-medium">Exportar petições em CSV</span>
          </div>
          <v-row align="center" dense>
            <v-col cols="12" sm="3">
              <v-text-field v-model="exportForm.date_from" density="compact" hide-details label="Data inicial" type="date" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-text-field v-model="exportForm.date_to" density="compact" hide-details label="Data final" type="date" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-select v-model="exportForm.template" clearable density="compact" hide-details :items="templateItems()" label="Template" />
            </v-col>
            <v-col cols="12" sm="3">
              <v-btn block color="primary" :loading="rel.loading.export" prepend-icon="mdi-download" @click="doExport">
                Baixar
              </v-btn>
            </v-col>
          </v-row>
        </v-card-text>
      </v-card>
    </v-expand-transition>

    <!-- ━━━ Filters ━━━ -->
    <v-card class="mb-6">
      <v-card-text class="d-flex align-center flex-wrap ga-3 pa-4">
        <v-select
          v-model="filters.bucket"
          density="compact"
          hide-details
          :items="bucketItems"
          style="max-width: 140px"
        />
        <v-text-field v-model="filters.date_from" density="compact" hide-details label="De" style="max-width: 160px" type="date" />
        <v-text-field v-model="filters.date_to" density="compact" hide-details label="Até" style="max-width: 160px" type="date" />
        <v-btn color="secondary" prepend-icon="mdi-filter-check-outline" size="small" @click="doRefresh">
          Aplicar
        </v-btn>
      </v-card-text>
    </v-card>

    <!-- ━━━ Loading ━━━ -->
    <div v-if="initialLoading" class="d-flex justify-center align-center" style="min-height: 300px">
      <div class="text-center">
        <v-progress-circular color="primary" indeterminate size="48" width="4" />
        <div class="text-body-2 text-medium-emphasis mt-4">Carregando relatórios...</div>
      </div>
    </div>

    <template v-else>
      <!-- ━━━ Error ━━━ -->
      <v-alert v-if="rel.hasError" class="mb-4" type="error">{{ rel.error }}</v-alert>

      <!-- ━━━ KPIs ━━━ -->
      <v-row class="mb-2">
        <v-col v-for="k in kpis" :key="k.label" cols="12" md="4">
          <v-card>
            <v-card-text class="d-flex align-center pa-5">
              <div
                class="kpi-icon-wrap d-flex align-center justify-center rounded-lg mr-4"
                :style="{ background: k.bg }"
              >
                <v-icon :color="k.color" :icon="k.icon" size="22" />
              </div>
              <div>
                <div class="text-h4 font-weight-bold" :style="{ color: k.color }">{{ k.value }}</div>
                <div class="text-caption text-medium-emphasis text-uppercase" style="letter-spacing: 0.05em">{{ k.label }}</div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>

      <!-- ━━━ Bar chart ━━━ -->
      <v-card class="mb-4">
        <v-card-text class="pa-5">
          <div class="d-flex align-center mb-4">
            <div class="section-title">Evolução no período</div>
            <v-spacer />
            <div class="d-flex ga-4">
              <div class="d-flex align-center ga-1">
                <div class="legend-dot" style="background: #0F2B46" />
                <span class="text-caption text-medium-emphasis">Clientes</span>
              </div>
              <div class="d-flex align-center ga-1">
                <div class="legend-dot" style="background: #CDA660" />
                <span class="text-caption text-medium-emphasis">Petições criadas</span>
              </div>
              <div class="d-flex align-center ga-1">
                <div class="legend-dot" style="background: #2196F3" />
                <span class="text-caption text-medium-emphasis">Atualizadas</span>
              </div>
            </div>
          </div>

          <div v-if="visibleBars.length" class="bar-chart">
            <div
              v-for="(bar, i) in visibleBars"
              :key="bar.period"
              class="bar-group"
              @mouseenter="hoveredBar = i"
              @mouseleave="hoveredBar = null"
            >
              <div class="bars-container">
                <div class="bar bar-clientes" :style="{ height: bar.hClientes + '%' }">
                  <span v-if="hoveredBar === i && bar.clientes" class="bar-value">{{ bar.clientes }}</span>
                </div>
                <div class="bar bar-criadas" :style="{ height: bar.hCriadas + '%' }">
                  <span v-if="hoveredBar === i && bar.criadas" class="bar-value">{{ bar.criadas }}</span>
                </div>
                <div class="bar bar-atualizadas" :style="{ height: bar.hAtualizadas + '%' }">
                  <span v-if="hoveredBar === i && bar.atualizadas" class="bar-value">{{ bar.atualizadas }}</span>
                </div>
              </div>
              <div class="bar-label">{{ bar.label }}</div>
            </div>
          </div>
          <div v-else class="pa-6 text-center text-medium-emphasis">
            <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-chart-bar" size="36" />
            <div class="text-body-2">Sem dados no período</div>
          </div>
        </v-card-text>
      </v-card>

      <!-- ━━━ Templates + Qualidade side by side ━━━ -->
      <v-row class="mb-4">
        <!-- Templates ranking -->
        <v-col cols="12" md="7">
          <v-card class="fill-height">
            <v-card-text class="pa-5">
              <div class="section-title mb-4">Templates mais usados</div>

              <template v-if="topTemplates.length">
                <div
                  v-for="(t, i) in topTemplates"
                  :key="t.template_id"
                  class="d-flex align-center py-3"
                  :class="{ 'border-b': i < topTemplates.length - 1 }"
                >
                  <span
                    class="rank-badge d-flex align-center justify-center mr-3 rounded-lg font-weight-bold"
                    :class="i === 0 ? 'rank-gold' : i < 3 ? 'rank-silver' : 'rank-default'"
                  >
                    {{ i + 1 }}
                  </span>
                  <div class="flex-grow-1" style="min-width: 0">
                    <div class="d-flex align-center justify-space-between mb-1">
                      <span class="text-body-2 font-weight-medium text-truncate" style="max-width: 280px">{{ t.template }}</span>
                      <span class="text-body-2 font-weight-bold ml-2">{{ t.count }}</span>
                    </div>
                    <v-progress-linear
                      :color="i === 0 ? 'secondary' : 'primary'"
                      height="6"
                      :model-value="t.pct"
                      rounded
                    />
                  </div>
                </div>
              </template>
              <div v-else class="pa-6 text-center text-medium-emphasis">
                <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-file-outline" size="36" />
                <div class="text-body-2">Nenhum template utilizado</div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>

        <!-- Data quality -->
        <v-col cols="12" md="5">
          <v-card class="fill-height">
            <v-card-text class="pa-5">
              <div class="section-title mb-4">Qualidade dos dados</div>

              <template v-if="qualityMetrics.length">
                <!-- Gauge central -->
                <div class="d-flex justify-center mb-5">
                  <v-progress-circular
                    :color="overallQuality > 85 ? '#4CAF50' : overallQuality > 70 ? '#FF9800' : '#F44336'"
                    :model-value="overallQuality"
                    :size="120"
                    :width="8"
                  >
                    <div class="text-center">
                      <div class="text-h4 font-weight-bold">{{ overallQuality }}%</div>
                      <div class="text-caption text-medium-emphasis" style="font-size: 0.6rem !important">GERAL</div>
                    </div>
                  </v-progress-circular>
                </div>

                <!-- Métricas -->
                <div
                  v-for="m in qualityMetrics"
                  :key="m.label"
                  class="d-flex align-center py-3 border-b"
                >
                  <v-avatar :color="m.color" class="mr-3" size="32" variant="tonal">
                    <v-icon :icon="m.icon" size="16" />
                  </v-avatar>
                  <div class="flex-grow-1">
                    <div class="text-body-2">{{ m.label }}</div>
                    <v-progress-linear
                      class="mt-1"
                      :color="m.color"
                      height="4"
                      :model-value="m.pct"
                      rounded
                    />
                  </div>
                  <div class="text-right ml-3">
                    <div class="text-body-2 font-weight-bold" :style="{ color: m.color }">{{ m.pct }}%</div>
                    <div class="text-caption text-medium-emphasis">{{ m.missing }} sem</div>
                  </div>
                </div>

                <div class="text-center mt-3">
                  <v-chip color="primary" size="small" variant="tonal">
                    {{ rel.dataQuality?.total_clientes ?? 0 }} clientes analisados
                  </v-chip>
                </div>
              </template>
              <div v-else class="pa-6 text-center text-medium-emphasis">
                <v-icon class="mb-2" color="grey-lighten-1" icon="mdi-database-off-outline" size="36" />
                <div class="text-body-2">Sem dados disponíveis</div>
              </div>
            </v-card-text>
          </v-card>
        </v-col>
      </v-row>
    </template>
  </v-container>
</template>

<style scoped>
.section-title {
  font-size: 0.875rem;
  font-weight: 600;
  color: #0F2B46;
}

.kpi-icon-wrap {
  width: 48px;
  height: 48px;
  flex-shrink: 0;
}

/* ─── Bar Chart ─── */
.bar-chart {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  height: 200px;
  padding-top: 16px;
}

.bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-width: 0;
  cursor: default;
}

.bar-group:hover .bars-container {
  opacity: 1;
}

.bars-container {
  display: flex;
  align-items: flex-end;
  gap: 2px;
  width: 100%;
  height: 170px;
  opacity: 0.85;
  transition: opacity 0.15s;
}

.bar {
  flex: 1;
  border-radius: 3px 3px 0 0;
  transition: height 0.5s ease;
  position: relative;
  min-height: 0;
}

.bar-clientes { background: #0F2B46; }
.bar-criadas { background: #CDA660; }
.bar-atualizadas { background: #2196F3; }

.bar-value {
  position: absolute;
  top: -18px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.6rem;
  font-weight: 700;
  white-space: nowrap;
  color: rgba(0, 0, 0, 0.6);
}

.bar-label {
  font-size: 0.6rem;
  color: rgba(0, 0, 0, 0.45);
  margin-top: 6px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 100%;
  text-align: center;
}

/* ─── Misc ─── */
.legend-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.rank-badge {
  width: 28px;
  height: 28px;
  font-size: 0.75rem;
  flex-shrink: 0;
}
.rank-gold {
  background: rgba(205, 166, 96, 0.15);
  color: #CDA660;
}
.rank-silver {
  background: rgba(15, 43, 70, 0.08);
  color: #0F2B46;
}
.rank-default {
  background: rgba(0, 0, 0, 0.05);
  color: rgba(0, 0, 0, 0.4);
}

.border-b {
  border-bottom: 1px solid rgba(0, 0, 0, 0.06);
}
.border-b:last-child {
  border-bottom: none;
}

.fill-height {
  height: 100%;
}
</style>
