<script setup lang="ts">
  import { computed, onMounted, reactive, ref } from 'vue'
  import { type Bucket, useRelatoriosStore } from '@/stores/relatorios'
  import { useTemplatesStore } from '@/stores/templates'

  const rel = useRelatoriosStore()
  const templates = useTemplatesStore()

  // ----- Filtros -----
  const filters = reactive<{
    bucket: Bucket
    date_from: string // YYYY-MM-DD
    date_to: string // YYYY-MM-DD
  }>({
    bucket: 'day',
    date_from: '',
    date_to: '',
  })

  // inicia com últimos 30 dias
  function setDefaultRange () {
    const to = new Date()
    const from = new Date()
    from.setDate(to.getDate() - 30)
    filters.date_to = to.toISOString().slice(0, 10)
    filters.date_from = from.toISOString().slice(0, 10)
  }
  setDefaultRange()

  const bucketItems = [
    { title: 'Dia', value: 'day' },
    { title: 'Semana', value: 'week' },
    { title: 'Mês', value: 'month' },
  ]

  // maior uso para normalizar a barra de progresso
  const maxTemplateCount = computed(() =>
    Math.max(...(rel.templatesUsage?.map(x => x.count) ?? [0]), 1),
  )

  // ----- Carregamento inicial -----
  async function fetchAll () {
    await Promise.all([
      rel.fetchTimeSeries(filters),
      rel.fetchTemplatesUsage({
        top: 10,
        date_from: filters.date_from,
        date_to: filters.date_to,
      }),
      rel.fetchDataQuality(),
      // carregar templates p/ selects (seu store suporta active: true)
      templates
        .fetch?.({ active: true })
        .catch(() => {}),
    ])
  }
  onMounted(fetchAll)

  // ----- KPIs somados no período -----
  const totalClientes = computed(() =>
    (rel.timeseries?.series ?? []).reduce((acc, p) => acc + (p.clientes || 0), 0),
  )
  const totalPeticoesCriadas = computed(() =>
    (rel.timeseries?.series ?? []).reduce(
      (acc, p) => acc + (p.peticoes_criadas || 0),
      0,
    ),
  )
  const totalPeticoesAtualizadas = computed(() =>
    (rel.timeseries?.series ?? []).reduce(
      (acc, p) => acc + (p.peticoes_atualizadas || 0),
      0,
    ),
  )

  // ----- Dados para sparklines -----
  const sparkClientes = computed(() =>
    (rel.timeseries?.series ?? []).map(p => p.clientes),
  )
  const sparkPCriadas = computed(() =>
    (rel.timeseries?.series ?? []).map(p => p.peticoes_criadas),
  )
  const sparkPAtualizadas = computed(() =>
    (rel.timeseries?.series ?? []).map(p => p.peticoes_atualizadas),
  )

  // ----- Tab control -----
  const tab = ref<'overview' | 'templates' | 'quality' | 'export'>('overview')

  // ----- Exportação -----
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

  async function doRefresh () {
    await fetchAll()
    // sincroniza export range com filtros
    exportForm.date_from = filters.date_from
    exportForm.date_to = filters.date_to
  }

  function pct (part: number, total: number) {
    if (!total) return 0
    return Math.round((part / total) * 100)
  }
</script>

<template>
  <v-container fluid>
    <!-- Header / Filtros -->
    <v-card class="rounded mb-4" elevation="2">
      <v-card-title class="d-flex align-center">
        <div>
          <div class="text-subtitle-1">Relatórios</div>
          <div class="text-body-2 text-medium-emphasis">
            Visão geral e análises
          </div>
        </div>
        <v-spacer />
        <v-btn
          color="primary"
          :loading="
            rel.loading.timeseries ||
              rel.loading.templates ||
              rel.loading.quality
          "
          prepend-icon="mdi-refresh"
          @click="doRefresh"
        >
          Atualizar
        </v-btn>
      </v-card-title>

      <v-card-text>
        <v-row dense>
          <v-col cols="12" sm="3">
            <v-select
              v-model="filters.bucket"
              density="compact"
              hide-details
              :items="bucketItems"
              label="Agrupar por"
              class="h-100"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="filters.date_from"
              density="compact"
              hide-details
              label="Início"
              type="date"
            />
          </v-col>
          <v-col cols="12" sm="3">
            <v-text-field
              v-model="filters.date_to"
              density="compact"
              hide-details
              label="Fim"
              type="date"
            />
          </v-col>
          <v-col class="d-flex align-end" cols="12" sm="3">
            <v-btn
              block
              color="secondary"
              @click="doRefresh"
              class="h-100"
            >Aplicar filtros</v-btn>
          </v-col>
        </v-row>

        <v-alert v-if="rel.hasError" class="mt-3" type="error" variant="tonal">
          {{ rel.error }}
        </v-alert>
      </v-card-text>
    </v-card>

    <!-- KPIs -->
    <v-row class="mb-4" dense>
      <v-col cols="12" sm="4">
        <v-card class="rounded" elevation="2">
          <v-card-item>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption text-medium-emphasis">
                  Clientes no período
                </div>
                <div class="text-h5 font-weight-bold">{{ totalClientes }}</div>
              </div>
              <v-avatar color="primary" size="40" variant="tonal">
                <v-icon icon="mdi-account-group" />
              </v-avatar>
            </div>
          </v-card-item>
          <v-card-text>
            <v-sparkline auto-draw :value="sparkClientes" />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="4">
        <v-card class="rounded" elevation="2">
          <v-card-item>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption text-medium-emphasis">
                  Petições criadas
                </div>
                <div class="text-h5 font-weight-bold">
                  {{ totalPeticoesCriadas }}
                </div>
              </div>
              <v-avatar color="secondary" size="40" variant="tonal">
                <v-icon icon="mdi-file-document" />
              </v-avatar>
            </div>
          </v-card-item>
          <v-card-text>
            <v-sparkline auto-draw :value="sparkPCriadas" />
          </v-card-text>
        </v-card>
      </v-col>

      <v-col cols="12" sm="4">
        <v-card class="rounded" elevation="2">
          <v-card-item>
            <div class="d-flex align-center justify-space-between">
              <div>
                <div class="text-caption text-medium-emphasis">
                  Petições atualizadas
                </div>
                <div class="text-h5 font-weight-bold">
                  {{ totalPeticoesAtualizadas }}
                </div>
              </div>
              <v-avatar color="indigo" size="40" variant="tonal">
                <v-icon icon="mdi-pencil" />
              </v-avatar>
            </div>
          </v-card-item>
          <v-card-text>
            <v-sparkline auto-draw :value="sparkPAtualizadas" />
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>

    <!-- Tabs -->
    <v-card class="rounded" elevation="2">
      <v-tabs v-model="tab" bg-color="transparent" slider-color="primary">
        <v-tab value="overview"><v-icon icon="mdi-chart-line" start /> Visão Geral</v-tab>
        <v-tab value="templates"><v-icon icon="mdi-file-word" start /> Templates</v-tab>
        <v-tab value="quality"><v-icon icon="mdi-clipboard-check" start /> Qualidade de Dados</v-tab>
        <v-tab value="export"><v-icon icon="mdi-download" start /> Exportar</v-tab>
      </v-tabs>
      <v-divider />

      <v-window v-model="tab">
        <!-- Visão Geral: tabela da série -->
        <v-window-item value="overview">
          <v-card-text>
            <v-skeleton-loader v-if="rel.loading.timeseries" type="table" />
            <v-data-table
              v-else
              class="rounded-lg"
              density="comfortable"
              :headers="[
                { title: 'Período', key: 'period' },
                { title: 'Clientes', key: 'clientes' },
                { title: 'Petições criadas', key: 'peticoes_criadas' },
                { title: 'Petições atualizadas', key: 'peticoes_atualizadas' },
              ]"
              item-key="period"
              :items="rel.timeseries?.series ?? []"
            />
          </v-card-text>
        </v-window-item>

        <!-- Templates: Top N -->
        <v-window-item value="templates">
          <v-card-text>
            <v-skeleton-loader v-if="rel.loading.templates" type="table" />
            <v-data-table
              v-else
              class="rounded-lg"
              density="comfortable"
              :headers="[
                { title: 'Template', key: 'template' },
                { title: 'Uso', key: 'count' },
                { title: 'Indicador', key: 'bar', sortable: false },
              ]"
              item-key="template_id"
              :items="rel.templatesUsage"
            >
              <template #item.bar="{ item }">
                <div class="d-flex align-center" style="gap: 12px">
                  <v-progress-linear
                    class="flex-grow-1"
                    :color="
                      item.count === maxTemplateCount ? 'success' : 'primary'
                    "
                    height="10"
                    :model-value="(item.count / maxTemplateCount) * 100"
                    rounded
                  />
                  <span class="text-caption">
                    {{ Math.round((item.count / maxTemplateCount) * 100) }}%
                  </span>
                </div>
              </template>
            </v-data-table>
          </v-card-text>
        </v-window-item>

        <!-- Qualidade de Dados -->
        <v-window-item value="quality">
          <v-card-text>
            <v-skeleton-loader v-if="rel.loading.quality" type="card" />
            <v-row v-else dense>
              <v-col cols="12" md="3" sm="6">
                <v-card class="rounded" elevation="1">
                  <v-card-item>
                    <div class="text-caption text-medium-emphasis">
                      Total de clientes
                    </div>
                    <div class="text-h5 font-weight-bold">
                      {{ rel.dataQuality?.total_clientes ?? 0 }}
                    </div>
                  </v-card-item>
                </v-card>
              </v-col>
              <v-col cols="12" md="3" sm="6">
                <v-card class="rounded" elevation="1">
                  <v-card-item>
                    <div class="text-caption text-medium-emphasis">Sem CPF</div>
                    <div class="text-h5 font-weight-bold">
                      {{ rel.dataQuality?.sem_cpf ?? 0 }}
                      <span class="text-caption text-medium-emphasis">
                        ({{
                          pct(
                            rel.dataQuality?.sem_cpf ?? 0,
                            rel.dataQuality?.total_clientes ?? 0
                          )
                        }}%)
                      </span>
                    </div>
                  </v-card-item>
                </v-card>
              </v-col>
              <v-col cols="12" md="3" sm="6">
                <v-card class="rounded" elevation="1">
                  <v-card-item>
                    <div class="text-caption text-medium-emphasis">
                      Sem endereço completo
                    </div>
                    <div class="text-h5 font-weight-bold">
                      {{ rel.dataQuality?.sem_endereco ?? 0 }}
                      <span class="text-caption text-medium-emphasis">
                        ({{
                          pct(
                            rel.dataQuality?.sem_endereco ?? 0,
                            rel.dataQuality?.total_clientes ?? 0
                          )
                        }}%)
                      </span>
                    </div>
                  </v-card-item>
                </v-card>
              </v-col>
              <v-col cols="12" md="3" sm="6">
                <v-card class="rounded" elevation="1">
                  <v-card-item>
                    <div class="text-caption text-medium-emphasis">
                      Com conta principal
                    </div>
                    <div class="text-h5 font-weight-bold">
                      {{ rel.dataQuality?.com_conta_principal ?? 0 }}
                      <span class="text-caption text-medium-emphasis">
                        ({{
                          pct(
                            rel.dataQuality?.com_conta_principal ?? 0,
                            rel.dataQuality?.total_clientes ?? 0
                          )
                        }}%)
                      </span>
                    </div>
                  </v-card-item>
                </v-card>
              </v-col>
            </v-row>
          </v-card-text>
        </v-window-item>

        <!-- Exportar -->
        <v-window-item value="export">
          <v-card-text>
            <v-row dense>
              <v-col cols="12" md="3" sm="6">
                <v-text-field
                  v-model="exportForm.date_from"
                  density="comfortable"
                  hide-details
                  label="Início"
                  type="date"
                />
              </v-col>
              <v-col cols="12" md="3" sm="6">
                <v-text-field
                  v-model="exportForm.date_to"
                  density="comfortable"
                  hide-details
                  label="Fim"
                  type="date"
                />
              </v-col>
              <v-col cols="12" md="3" sm="6">
                <v-select
                  v-model="exportForm.template"
                  clearable
                  density="comfortable"
                  hide-details
                  :items="templateItems()"
                  label="Template (opcional)"
                />
              </v-col>
              <v-col cols="12" md="3" sm="6">
                <v-text-field
                  v-model.number="exportForm.clienteId"
                  density="comfortable"
                  hide-details
                  label="Cliente ID (opcional)"
                  min="1"
                  type="number"
                />
              </v-col>
            </v-row>

            <div class="mt-3 d-flex gap-2">
              <v-btn
                color="primary"
                :loading="rel.loading.export"
                prepend-icon="mdi-download"
                @click="
                  rel.exportPetitionsCSV({
                    date_from: exportForm.date_from || undefined,
                    date_to: exportForm.date_to || undefined,
                    template: exportForm.template || undefined,
                    cliente: exportForm.clienteId || undefined,
                  })
                "
              >
                Exportar CSV
              </v-btn>
              <v-btn
                variant="text"
                @click="
                  () => {
                    exportForm.template = undefined;
                    exportForm.clienteId = undefined;
                  }
                "
              >
                Limpar filtros
              </v-btn>
            </div>
          </v-card-text>
        </v-window-item>
      </v-window>
    </v-card>
  </v-container>
</template>
